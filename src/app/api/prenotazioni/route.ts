import {
  requireAccess,
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";
import { prepareStudentBooking } from "@/modules/crm/student-booking";
export async function GET() {
  try {
    const { user, access } = await requireAccess();
    if (access.role !== "student")
      throw new HttpError(403, "Usa l’anteprima studente dell’admin.");
    const current = await readCrm(user.id);
    return Response.json(studentProjection(current.state, access.record_id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess();
    if (access.role !== "student")
      throw new HttpError(403, "Usa la gestione iscritti dell’admin.");
    const input = await readJsonInput(request);
    if (
      typeof input.lessonId !== "string" ||
      typeof input.cancelled !== "boolean"
    )
      throw new HttpError(400, "Prenotazione non valida.");
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await readCrm(user.id);
      let next;
      try {
        next = prepareStudentBooking(
          current.state,
          access.record_id,
          input.lessonId,
          input.cancelled,
        );
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
    throw new HttpError(409, "Disponibilità cambiata. Riprova.");
  } catch (e) {
    return errorResponse(e);
  }
}
