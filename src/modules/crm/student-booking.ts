import type { CrmState } from "./model.ts";
import { availabilityLessons } from "./availability-lessons.ts";
import { prepareTransition } from "./transition.ts";

/** Students book and cancel up to this many hours before the start. */
export const bookingCutoffHours = 12;
export function bookingWindowClosed(startsAt: string, now = Date.now()) {
  return Date.parse(startsAt) - bookingCutoffHours * 3_600_000 <= now;
}
export const bookingClosedMessage = `Le prenotazioni si chiudono ${bookingCutoffHours} ore prima della lezione.`;
export const cancelClosedMessage = `Puoi disdire fino a ${bookingCutoffHours} ore prima della lezione. Per imprevisti contatta il team.`;

export function prepareStudentBooking(
  state: CrmState,
  studentId: string,
  lessonId: string,
  cancelled: boolean,
  now = Date.now(),
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
      "Questa fascia non è più disponibile. Aggiorna il calendario.",
    );
  if (lesson.settlement) throw new Error("La lezione è già conclusa.");
  const old = state.bookings?.find(
    (booking) =>
      booking.studentId === studentId && booking.lessonId === lessonId,
  );
  if (cancelled && !old) throw new Error("Prenotazione non trovata.");
  const changing = cancelled ? old && !old.cancelled : !old || old.cancelled;
  if (changing && bookingWindowClosed(lesson.startsAt, now))
    throw new Error(cancelled ? cancelClosedMessage : bookingClosedMessage);
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
