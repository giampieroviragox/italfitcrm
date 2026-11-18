import {
  requireAccess,
  checkOrigin,
  errorResponse,
  HttpError,
} from "@/modules/crm/server/auth";
import {
  applyChanges,
  readChanges,
  readCrm,
} from "@/modules/crm/server/repository";
import { isPatch, stageStaffPatch } from "@/modules/crm/server/staff-patch";
import { projectState, staffScope } from "@/modules/crm/permissions";
import { deltaResponse, visibleEnvelope } from "@/modules/crm/server/commands";
import { scheduleCalendarSync } from "@/modules/crm/server/calendar-sync";
import { projectDelta } from "@/modules/crm/sync-projection";

const noStore = { headers: { "Cache-Control": "no-store" } };

/**
 * Without `since`: the whole state. With `since=<revision>`: only what changed
 * after it (a delta), so a tab regaining focus costs almost nothing.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sinceParam = url.searchParams.get("since");
    const since = sinceParam === null ? null : Number(sinceParam);
    if (since !== null && !(Number.isSafeInteger(since) && since >= 0))
      throw new HttpError(400, "Richiesta non valida.");
    const { user, access, preloaded } = await requireAccess(
      true,
      since === null ? readCrm : async () => null,
    );
    if (since === null) {
      const scope = staffScope(preloaded!.state, access.record_id);
      return Response.json(visibleEnvelope(preloaded!, scope), noStore);
    }
    const changes = await readChanges(user.id, since);
    const owner = access.role === "owner";
    // Anyone but the owner sees a subset: filter against the whole state.
    const delta = owner
      ? changes.delta
      : projectDelta(await readCrm(user.id), changes.delta, access.record_id);
    return Response.json({ revision: changes.revision, delta }, noStore);
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * The browser sends the records it changed, each with the version it saw.
 * They are laid over the latest state, validated like any update, and only
 * the records that really differ are written.
 */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access, preloaded } = await requireAccess(true, readCrm);
    const text = await request.text();
    if (text.length > 2_000_000)
      throw new HttpError(413, "I dati superano la dimensione consentita.");
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      throw new HttpError(400, "Richiesta non valida.");
    }
    const patch = (input as { patch?: unknown } | null)?.patch;
    if (!isPatch(patch)) throw new HttpError(400, "Dati CRM non validi.");
    let current = preloaded;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { next, changes, scope } = stageStaffPatch(
        current,
        patch,
        access,
        projectState,
      );
      try {
        const saved = await applyChanges(user.id, current, changes, next);
        scheduleCalendarSync(saved.state);
        return deltaResponse(current, saved, scope);
      } catch (e) {
        if (e instanceof HttpError && e.status === 409 && attempt < 1) {
          current = await readCrm(user.id);
          continue;
        }
        throw e;
      }
    }
    throw new HttpError(409, "Il CRM è cambiato. Riprova.");
  } catch (e) {
    return errorResponse(e);
  }
}
