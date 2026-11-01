import {
  requireAccess,
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";
import { prepareTransition } from "@/modules/crm/transition";
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
      const old = current.state.bookings?.find(
        (b) =>
          b.studentId === access.record_id && b.lessonId === input.lessonId,
      );
      const booking = {
        id: old?.id ?? crypto.randomUUID(),
        studentId: access.record_id,
        lessonId: input.lessonId,
        cancelled: input.cancelled,
        createdAt: old?.createdAt ?? new Date().toISOString(),
      };
      let next;
      try {
        const student = current.state.students.find(
          (s) => s.id === access.record_id,
        );
        if (!student) throw new HttpError(404, "Studente non trovato.");
        next = prepareTransition(
          current.state,
          {
            ...current.state,
            bookings: old
              ? (current.state.bookings ?? []).map((b) =>
                  b.id === old.id ? booking : b,
                )
              : [...(current.state.bookings ?? []), booking],
          },
          { id: student.id, name: `${student.firstName} ${student.lastName}` },
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
