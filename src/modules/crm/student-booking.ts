import type { CrmState } from "./model.ts";
import { availabilityLessons } from "./availability-lessons.ts";
import { prepareTransition } from "./transition.ts";

export function prepareStudentBooking(
  state: CrmState,
  studentId: string,
  lessonId: string,
  cancelled: boolean,
): CrmState {
  const student = state.students.find(
    (item) => item.id === studentId && !item.archived,
  );
  if (!student) throw new Error("Studente non trovato.");
  const saved = state.lessons?.find((lesson) => lesson.id === lessonId);
  const lesson =
    saved ??
    (!cancelled
      ? availabilityLessons(state).find((item) => item.id === lessonId)
      : undefined);
  if (!lesson)
    throw new Error(
      "Questo slot non è più disponibile. Aggiorna il calendario.",
    );
  const old = state.bookings?.find(
    (booking) =>
      booking.studentId === studentId && booking.lessonId === lessonId,
  );
  if (cancelled && !old) throw new Error("Prenotazione non trovata.");
  const booking = {
    id: old?.id ?? crypto.randomUUID(),
    studentId,
    lessonId,
    cancelled,
    createdAt: old?.createdAt ?? new Date().toISOString(),
  };
  return prepareTransition(
    state,
    {
      ...state,
      lessons: saved ? state.lessons : [...(state.lessons ?? []), lesson],
      bookings: old
        ? (state.bookings ?? []).map((item) =>
            item.id === old.id ? booking : item,
          )
        : [...(state.bookings ?? []), booking],
    },
    { id: student.id, name: `${student.firstName} ${student.lastName}` },
  );
}
