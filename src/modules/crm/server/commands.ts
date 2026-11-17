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
import type { CrmEnvelope } from "../envelope";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
  requireAccess,
} from "./auth";
import { readCrm, writeCrm } from "./repository";

type Input = Record<string, unknown>;

/**
 * A student changes their own data. The command is re-applied on the latest
 * state up to three times, and the response is the student projection.
 */
export async function studentCommand(
  request: Request,
  apply: (state: CrmState, studentId: string, input: Input) => CrmState,
  { maxLength = 20_000, plans = true } = {},
) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess();
    if (access.role !== "student")
      throw new HttpError(403, "Questa operazione è riservata agli studenti.");
    const input = await readJsonInput(request, maxLength);
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await readCrm(user.id);
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
        const saved = await writeCrm(user.id, current.revision, next);
        return Response.json(studentProjection(saved.state, access.record_id), {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (e) {
        if (e instanceof HttpError && e.status === 409 && attempt < 2) continue;
        throw e;
      }
    }
    throw new HttpError(409, "Dati aggiornati altrove. Riprova.");
  } catch (e) {
    return errorResponse(e);
  }
}

/** The envelope a staff member may see, filtered by their permissions. */
export const visibleEnvelope = (
  envelope: CrmEnvelope,
  scope: StaffScope,
): CrmEnvelope => ({ ...envelope, state: projectState(envelope.state, scope) });

/** A staff member applies a command against the revision they saw. */
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
    const { user, access } = await requireAccess(true);
    const input = await readJsonInput(request, maxLength);
    if (!Number.isSafeInteger(input.revision))
      throw new HttpError(400, "Richiesta non valida.");
    const current = await readCrm(user.id);
    const scope = staffScope(current.state, access.record_id);
    try {
      if (permission) requirePermission(scope, permission);
    } catch (e) {
      throw new HttpError(403, (e as Error).message);
    }
    if (input.revision !== current.revision)
      throw new HttpError(409, "Il CRM è cambiato. Verifica i dati e riprova.");
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
    const saved = await writeCrm(user.id, current.revision, next);
    return Response.json(visibleEnvelope(saved, scope), {
      headers: { "Cache-Control": "no-store" },
    });
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
