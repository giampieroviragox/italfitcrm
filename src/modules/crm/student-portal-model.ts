import type { PlanAssignment, Lesson } from "./fitness-model.ts";
import type { CrmState } from "./model.ts";
export interface StudentPortalData {
  student: { id: string; firstName: string; lastName: string; status: string };
  assignments: PlanAssignment[];
  lessons: (Lesson & { enrolled: boolean; occupied: number })[];
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
            (b) => b.lessonId === l.id && b.studentId === id && !b.cancelled,
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
