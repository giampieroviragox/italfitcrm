import "server-only";
import type { CrmState } from "../model";
import { studentProjection } from "../student-portal-model";
import { studentAccess } from "../tier-access";
import { prepareTransition } from "../transition";
import {
  projectState,
  requirePermission,
  staffScope,
  type Permission,
  type StaffScope,
} from "../permissions";
import {
  adjustOccupancy,
  changedIds,
  collections,
  deltaBetween,
  type CrmDelta,
  type Versions,
} from "../sync";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
  requireAccess,
} from "./auth";
import {
  readCrm,
  readStudentScopeForUser,
  writeCrm,
  type Committed,
  type CrmEnvelope,
} from "./repository";
import { scheduleCalendarSync } from "./calendar-sync";

type Input = Record<string, unknown>;
const noStore = { headers: { "Cache-Control": "no-store" } };

/**
 * A student changes their own data. Only that student's slice of the CRM is
 * read; the command is re-applied on a fresh read if the record changed in
 * between, and the answer is the student projection.
 */
export async function studentCommand(
  request: Request,
  apply: (state: CrmState, studentId: string, input: Input) => CrmState,
  { maxLength = 20_000, plans = true } = {},
) {
  try {
    checkOrigin(request);
    const { user, access, preloaded } = await requireAccess(
      false,
      readStudentScopeForUser,
    );
    if (access.role !== "student" || !preloaded)
      throw new HttpError(403, "Questa operazione è riservata agli studenti.");
    const input = await readJsonInput(request, maxLength);
    let current = preloaded;
    for (let attempt = 0; attempt < 3; attempt++) {
      const student = current.state.students.find(
        (s) => s.id === access.record_id,
      );
      let next;
      try {
        if (!student) throw new Error("Studente non disponibile.");
        if (plans && !studentAccess(current.state, student).plans)
          throw new Error("Il tuo accesso non include i piani.");
        next = prepareTransition(
          current.state,
          apply(current.state, student.id, input),
          { id: student.id, name: `${student.firstName} ${student.lastName}` },
        );
      } catch (e) {
        throw e instanceof HttpError
          ? e
          : new HttpError(400, (e as Error).message);
      }
      try {
        const saved = await writeCrm(user.id, current, next);
        scheduleCalendarSync();
        return Response.json(
          studentProjection(
            saved.state,
            access.record_id,
            adjustOccupancy(
              current.occupancy,
              current.state,
              saved.state,
              access.record_id,
            ),
          ),
          noStore,
        );
      } catch (e) {
        if (e instanceof HttpError && e.status === 409 && attempt < 2) {
          const fresh = await readStudentScopeForUser(user.id);
          if (fresh) current = fresh;
          continue;
        }
        throw e;
      }
    }
    throw new HttpError(409, "Dati aggiornati altrove. Riprova.");
  } catch (e) {
    return errorResponse(e);
  }
}

/** The envelope a member may see: state and versions limited to their scope. */
export function visibleEnvelope(
  envelope: CrmEnvelope,
  scope: StaffScope,
): CrmEnvelope {
  const state = projectState(envelope.state, scope);
  if (state === envelope.state) return envelope;
  const versions: Versions = {};
  for (const collection of collections) {
    const ids = new Set(
      ((state[collection] ?? []) as { id: string }[]).map((r) => r.id),
    );
    versions[collection] = Object.fromEntries(
      Object.entries(envelope.versions[collection] ?? {}).filter(([id]) =>
        ids.has(id),
      ),
    );
  }
  return { revision: envelope.revision, versions, state };
}

/** What a write changed, for the browser of the member who made it. */
export function writeDelta(
  before: CrmEnvelope,
  saved: Committed,
  scope: StaffScope,
): { revision: number; delta: CrmDelta } {
  return {
    revision: saved.revision,
    delta: deltaBetween(
      projectState(before.state, scope),
      projectState(saved.state, scope),
      saved.versions,
      changedIds(saved.changes),
    ),
  };
}
export const deltaResponse = (
  before: CrmEnvelope,
  saved: Committed,
  scope: StaffScope,
) => Response.json(writeDelta(before, saved, scope), noStore);

/**
 * A team member applies a command to the latest state. Commands describe an
 * operation (not a screen), so a conflict is retried on a fresh read.
 */
export async function staffCommand(
  request: Request,
  apply: (
    state: CrmState,
    input: Input,
    actorName: string,
    scope: StaffScope,
  ) => CrmState,
  {
    maxLength = 20_000,
    permission,
  }: { maxLength?: number; permission?: Permission } = {},
) {
  try {
    checkOrigin(request);
    const { user, access, preloaded } = await requireAccess(true, readCrm);
    const input = await readJsonInput(request, maxLength);
    let current = preloaded;
    for (let attempt = 0; attempt < 3; attempt++) {
      const scope = staffScope(current.state, access.record_id);
      try {
        if (permission) requirePermission(scope, permission);
      } catch (e) {
        throw new HttpError(403, (e as Error).message);
      }
      const actor = {
        id: access.record_id,
        name:
          current.state.admins.find((a) => a.id === access.record_id)?.name ??
          "Amministratore",
      };
      let next;
      try {
        next = prepareTransition(
          current.state,
          apply(current.state, input, actor.name, scope),
          actor,
        );
      } catch (e) {
        throw e instanceof HttpError
          ? e
          : new HttpError(400, (e as Error).message);
      }
      try {
        const saved = await writeCrm(user.id, current, next);
        scheduleCalendarSync(saved.state);
        return deltaResponse(current, saved, scope);
      } catch (e) {
        if (e instanceof HttpError && e.status === 409 && attempt < 2) {
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

/** Throws a 400 with a readable message when the input does not parse. */
export function parsed<T>(
  result: { success: true; data: T } | { success: false },
  message: string,
): T {
  if (!result.success) throw new HttpError(400, message);
  return result.data;
}
