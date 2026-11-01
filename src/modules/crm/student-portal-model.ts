import { availabilityLessons } from "./availability-lessons.ts";
import type { PlanAssignment, Lesson } from "./fitness-model.ts";
import type { CrmState, TierAccess } from "./model.ts";
import { isFitnessData } from "./fitness-logic.ts";
import {
  studentAccess,
  bookingRestriction,
  isTierAccess,
} from "./tier-access.ts";
export interface StudentPortalData {
  student: { id: string; firstName: string; lastName: string; status: string };
  services: TierAccess;
  assignments: PlanAssignment[];
  lessons: (Lesson & {
    enrolled: boolean;
    occupied: number;
    restriction: string;
  })[];
}
export function parseStudentPortalData(value: unknown): StudentPortalData {
  if (
    !value ||
    typeof value !== "object" ||
    !("student" in value) ||
    !value.student ||
    typeof value.student !== "object" ||
    !["id", "firstName", "lastName", "status"].every(
      (key) =>
        typeof (value.student as Record<string, unknown>)[key] === "string",
    ) ||
    !("assignments" in value) ||
    !Array.isArray(value.assignments) ||
    !("services" in value) ||
    !isTierAccess(value.services) ||
    !("lessons" in value) ||
    !Array.isArray(value.lessons) ||
    !isFitnessData(value as Record<string, unknown>) ||
    !value.lessons.every(
      (lesson) =>
        typeof lesson.enrolled === "boolean" &&
        typeof lesson.restriction === "string" &&
        Number.isInteger(lesson.occupied) &&
        lesson.occupied >= 0 &&
        Number.isFinite(Date.parse(lesson.startsAt)),
    )
  )
    throw new Error(
      "Dati dell’area studente non validi. Riprova l’aggiornamento.",
    );
  return value as StudentPortalData;
}
export function studentProjection(
  state: CrmState,
  id: string,
): StudentPortalData {
  const student = state.students.find((s) => s.id === id && !s.archived);
  if (!student) throw new Error("Studente non disponibile.");
  const services = studentAccess(state, student);
  const projectedState = {
    ...state,
    lessons: [
      ...(state.lessons ?? []),
      ...(services.lessons ? availabilityLessons(state) : []),
    ],
  };
  const own = (state.bookings ?? []).filter(
    (booking) => booking.studentId === id,
  );
  return {
    services,
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      status: student.status,
    },
    assignments: services.plans
      ? (state.assignments ?? []).filter((a) => a.studentId === id)
      : [],
    lessons: (projectedState.lessons ?? [])
      .filter(
        (l) =>
          (services.lessons && !l.cancelled) ||
          own.some((b) => b.lessonId === l.id),
      )
      .map((l) => ({
        ...l,
        restriction: bookingRestriction(
          state.lessons?.some((item) => item.id === l.id)
            ? state
            : { ...state, lessons: [...(state.lessons ?? []), l] },
          id,
          l.id,
        ),
        enrolled: (state.bookings ?? []).some(
          (b) => b.lessonId === l.id && b.studentId === id && !b.cancelled,
        ),
        occupied: (state.bookings ?? []).filter(
          (b) => b.lessonId === l.id && !b.cancelled,
        ).length,
      })),
  };
}
