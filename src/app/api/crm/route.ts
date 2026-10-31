import {
  requireAccess,
  checkOrigin,
  errorResponse,
  HttpError,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { validateStaffUpdate } from "@/modules/crm/server/validation";
import { isCrmState } from "@/modules/crm/schema";
export async function GET() {
  try {
    const { user } = await requireAccess(true);
    return Response.json(await readCrm(user.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess(true);
    const text = await request.text();
    if (text.length > 2_000_000)
      throw new HttpError(413, "I dati superano la dimensione consentita.");
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      throw new HttpError(400, "Richiesta non valida.");
    }
    if (
      !input ||
      typeof input !== "object" ||
      !("state" in input) ||
      !("revision" in input) ||
      !Number.isSafeInteger(input.revision) ||
      !isCrmState(input.state)
    )
      throw new HttpError(400, "Dati CRM non validi.");
    const current = await readCrm(user.id);
    if (input.revision !== current.revision)
      throw new HttpError(
        409,
        "Il CRM è cambiato altrove. Ricarica prima di salvare.",
      );
    const state = validateStaffUpdate(current.state, input.state, access);
    return Response.json(await writeCrm(user.id, current.revision, state), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
