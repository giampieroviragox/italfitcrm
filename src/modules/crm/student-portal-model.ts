import type { PlanAssignment, Lesson } from "./fitness-model.ts";
import type { CrmState } from "./model.ts";
import { isFitnessData } from "./fitness-logic.ts";
export interface StudentPortalData {
  student: { id: string; firstName: string; lastName: string; status: string };
  assignments: PlanAssignment[];
  lessons: (Lesson & { enrolled: boolean; occupied: number })[];
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
    !("lessons" in value) ||
    !Array.isArray(value.lessons) ||
    !isFitnessData(value as Record<string, unknown>) ||
    !value.lessons.every(
      (lesson) =>
        typeof lesson.enrolled === "boolean" &&
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
  return {
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      status: student.status,
    },
    assignments: (state.assignments ?? []).filter((a) => a.studentId === id),
    lessons: (state.lessons ?? [])
      .filter(
        (l) =>
          !l.cancelled ||
          (state.bookings ?? []).some(
            (b) => b.lessonId === l.id && b.studentId === id,
          ),
      )
      .map((l) => ({
        ...l,
        enrolled: (state.bookings ?? []).some(
          (b) => b.lessonId === l.id && b.studentId === id && !b.cancelled,
        ),
        occupied: (state.bookings ?? []).filter(
          (b) => b.lessonId === l.id && !b.cancelled,
        ).length,
      })),
  };
}
