import {
  requireAccess,
  checkOrigin,
  readJsonInput,
  errorResponse,
  HttpError,
} from "@/modules/crm/server/auth";
import { readCrm, removeCrm } from "@/modules/crm/server/repository";
import { validateStaffUpdate } from "@/modules/crm/server/validation";
import { isRemovalTarget, removalState } from "@/modules/crm/removal";
import { seesStudent, staffScope } from "@/modules/crm/permissions";
import { visibleEnvelope } from "@/modules/crm/server/commands";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess(true);
    const input = await readJsonInput(request, 2_000);
    if (!isRemovalTarget(input))
      throw new HttpError(400, "Richiesta di rimozione non valida.");
    // The target is identified by id, so retrying on the latest state is safe.
    for (let attempt = 0; ; attempt++) {
      const current = await readCrm(user.id);
      const scope = staffScope(current.state, access.record_id);
      if (!scope.can("plans"))
        throw new HttpError(
          403,
          "Il tuo ruolo non include i piani di allenamento.",
        );
      if ("assignmentId" in input) {
        const assignment = current.state.assignments?.find(
          (a) => a.id === input.assignmentId,
        );
        if (assignment && !seesStudent(scope, assignment.studentId))
          throw new HttpError(403, "Non segui questo studente.");
      }
      let removal;
      try {
        removal = removalState(current.state, input);
      } catch (error) {
        throw new HttpError(409, (error as Error).message);
      }
      const state = validateStaffUpdate(current.state, removal.state, access, {
        assignments: removal.assignments,
        plans: removal.plans,
      });
      try {
        const saved = await removeCrm(user.id, current.revision, state, {
          assignments: removal.assignments,
          plans: removal.plans,
        });
        return Response.json(visibleEnvelope(saved, scope), {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (error) {
        if (error instanceof HttpError && error.status === 409 && attempt < 2)
          continue;
        throw error;
      }
    }
  } catch (e) {
    return errorResponse(e);
  }
}
