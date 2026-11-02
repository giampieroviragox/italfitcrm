import {
  requireAccess,
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";
import { prepareWorkoutEntry } from "@/modules/crm/workout-progress";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess();
    if (access.role !== "student")
      throw new HttpError(
        403,
        "I progressi vengono registrati dall’account studente.",
      );
    const input = await readJsonInput(request);
    if (
      typeof input.assignmentId !== "string" ||
      typeof input.assignmentCreatedAt !== "string" ||
      typeof input.sessionId !== "string" ||
      typeof input.notes !== "string" ||
      typeof input.completed !== "boolean"
    )
      throw new HttpError(400, "Allenamento non valido.");
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await readCrm(user.id);
      let next;
      try {
        next = prepareWorkoutEntry(current.state, access.record_id, {
          assignmentId: input.assignmentId,
          assignmentCreatedAt: input.assignmentCreatedAt,
          sessionId: input.sessionId,
          notes: input.notes,
          completed: input.completed,
        });
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
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
    throw new HttpError(409, "Piano aggiornato altrove. Riprova.");
  } catch (e) {
    return errorResponse(e);
  }
}
