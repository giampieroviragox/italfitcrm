import {
  requireAccess,
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
} from "@/modules/crm/server/auth";
import {
  readStudentScopeForUser,
  writeCrm,
} from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";
import { prepareStudentBooking } from "@/modules/crm/student-booking";
import { scheduleCalendarSync } from "@/modules/crm/server/calendar-sync";
import { adjustOccupancy } from "@/modules/crm/sync";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  try {
    const { access, preloaded } = await requireAccess(
      false,
      readStudentScopeForUser,
    );
    if (access.role !== "student" || !preloaded)
      throw new HttpError(403, "Usa l’anteprima studente dell’admin.");
    return Response.json(
      studentProjection(preloaded.state, access.record_id, preloaded.occupancy),
      noStore,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access, preloaded } = await requireAccess(
      false,
      readStudentScopeForUser,
    );
    if (access.role !== "student" || !preloaded)
      throw new HttpError(403, "Usa la gestione iscritti dell’admin.");
    const input = await readJsonInput(request);
    if (
      typeof input.lessonId !== "string" ||
      typeof input.cancelled !== "boolean"
    )
      throw new HttpError(400, "Prenotazione non valida.");
    let current = preloaded;
    for (let attempt = 0; attempt < 3; attempt++) {
      let next;
      try {
        next = prepareStudentBooking(
          current.state,
          access.record_id,
          input.lessonId,
          input.cancelled,
          Date.now(),
          current.occupancy,
        );
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
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
    throw new HttpError(409, "Disponibilità cambiata. Riprova.");
  } catch (e) {
    return errorResponse(e);
  }
}
