import type { CrmState } from "./model.ts";
import type { Lesson } from "./fitness-model.ts";
import { availabilityLessons } from "./availability-lessons.ts";
import { bookingRestriction } from "./tier-access.ts";

/**
 * A team member enrols or removes a student. A bookable period that nobody
 * has booked yet becomes a saved lesson with its first reservation, exactly
 * as when a student books it. The caller saves the result: the server checks
 * capacity, overlaps and the tier rules.
 */
export function staffBooking(
  state: CrmState,
  lessonId: string,
  studentId: string,
  cancelled: boolean,
  now = Date.now(),
): CrmState {
  const saved = state.lessons?.find((lesson) => lesson.id === lessonId);
  const lesson =
    saved ??
    (!cancelled
      ? availabilityLessons(state, now).find((item) => item.id === lessonId)
      : undefined);
  if (!lesson)
    throw new Error(
      "Questa fascia non è più disponibile. Aggiorna il calendario.",
    );
  const old = state.bookings?.find(
    (booking) =>
      booking.lessonId === lessonId && booking.studentId === studentId,
  );
  const booking = {
    id: old?.id ?? crypto.randomUUID(),
    lessonId,
    studentId,
    createdAt: old?.createdAt ?? new Date(now).toISOString(),
    cancelled,
  };
  return {
    ...state,
    lessons: saved ? state.lessons : [...(state.lessons ?? []), lesson],
    bookings: old
      ? (state.bookings ?? []).map((item) =>
          item.id === old.id ? booking : item,
        )
      : [...(state.bookings ?? []), booking],
  };
}

/** Students who can be enrolled: active, with lessons in their tier and within the monthly limit. */
export function bookableStudents(
  state: CrmState,
  lesson: Lesson,
  alreadyEnrolled: readonly string[] = [],
) {
  const known = state.lessons?.some((item) => item.id === lesson.id);
  const withLesson = known
    ? state
    : { ...state, lessons: [...(state.lessons ?? []), lesson] };
  return state.students.filter(
    (student) =>
      !student.archived &&
      !alreadyEnrolled.includes(student.id) &&
      !bookingRestriction(withLesson, student.id, lesson.id),
  );
}
