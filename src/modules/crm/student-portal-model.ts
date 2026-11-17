import { lessonWallet, type LessonWallet } from "./lesson-wallet.ts";
import {
  assignedStudentCoach,
  teamMemberCoach,
  isStudentCoach,
  type StudentCoach,
} from "./student-coach.ts";
import { isWorkoutEntries } from "./workout-entry-schema.ts";
import {
  availabilityIsPublished,
  availabilityLessons,
  withAvailabilityCapacity,
} from "./availability-lessons.ts";
import type { PlanAssignment, Lesson } from "./fitness-model.ts";
import { validDate, type CrmState, type TierAccess } from "./model.ts";
import {
  bookingClosedMessage,
  bookingWindowClosed,
  cancelClosedMessage,
} from "./student-booking.ts";
import { isFitnessData, todayRome } from "./fitness-logic.ts";
import { maxRecords, type MaxRecord } from "./workout-log.ts";
import {
  cycleFeedbacks,
  races as raceList,
  type CycleFeedback,
  type Race,
} from "./cycle-feedback.ts";
import {
  assignmentCoachId,
  coachingOutstanding,
  currentSubscription,
  onlineReceipts as onlineReceiptList,
} from "./online-coaching.ts";
import {
  studentAccess,
  bookingRestriction,
  isTierAccess,
} from "./tier-access.ts";
export interface StudentPortalData {
  student: { id: string; firstName: string; lastName: string; status: string };
  services: TierAccess;
  coach?: StudentCoach;
  /** Coach of each monthly plan, by assignment ID. */
  planCoaches?: Record<string, StudentCoach>;
  workoutEntries?: import("./fitness-model.ts").WorkoutEntry[];
  maxes?: MaxRecord[];
  cycleFeedback?: CycleFeedback[];
  races?: Race[];
  assignments: PlanAssignment[];
  lessonWallet?: LessonWallet;
  coaching?: StudentCoaching;
  /** Still to pay for online coaching and the receipts sent for it. */
  coachingOutstanding?: number;
  onlineReceipts?: import("./lesson-wallet.ts").Receipt[];
  lessons: (Lesson & {
    enrolled: boolean;
    occupied: number;
    restriction: string;
    /** Why an existing booking can no longer be cancelled. */
    cancelRestriction?: string;
  })[];
}
/** The student's current online coaching subscription, without staff-only data. */
export interface StudentCoaching {
  durationMonths: number;
  startsOn: string;
  endsOn: string;
  coachName: string;
}
function isStudentCoaching(value: unknown): value is StudentCoaching {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    [3, 6, 12].includes(Number(v.durationMonths)) &&
    typeof v.startsOn === "string" &&
    validDate(v.startsOn) &&
    typeof v.endsOn === "string" &&
    validDate(v.endsOn) &&
    typeof v.coachName === "string"
  );
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
    ("coach" in value &&
      value.coach !== undefined &&
      !isStudentCoach(value.coach)) ||
    ("lessonWallet" in value &&
      value.lessonWallet !== undefined &&
      !lessonWallet.safeParse(value.lessonWallet).success) ||
    ("workoutEntries" in value && !isWorkoutEntries(value.workoutEntries)) ||
    ("cycleFeedback" in value &&
      value.cycleFeedback !== undefined &&
      !cycleFeedbacks.safeParse(value.cycleFeedback).success) ||
    ("races" in value &&
      value.races !== undefined &&
      !raceList.safeParse(value.races).success) ||
    ("maxes" in value &&
      value.maxes !== undefined &&
      !maxRecords.safeParse(value.maxes).success) ||
    ("planCoaches" in value &&
      value.planCoaches !== undefined &&
      (!value.planCoaches ||
        typeof value.planCoaches !== "object" ||
        !Object.values(value.planCoaches).every(isStudentCoach))) ||
    ("onlineReceipts" in value &&
      value.onlineReceipts !== undefined &&
      !onlineReceiptList.safeParse(value.onlineReceipts).success) ||
    ("coachingOutstanding" in value &&
      value.coachingOutstanding !== undefined &&
      !(
        Number.isInteger(value.coachingOutstanding) &&
        Number(value.coachingOutstanding) >= 0
      )) ||
    ("coaching" in value &&
      value.coaching !== undefined &&
      !isStudentCoaching(value.coaching)) ||
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
      ...(state.lessons ?? []).map((lesson) =>
        withAvailabilityCapacity(state, lesson),
      ),
      ...(services.lessons ? availabilityLessons(state) : []),
    ],
  };
  const own = (state.bookings ?? []).filter(
    (booking) => booking.studentId === id,
  );
  const assignments = services.plans
    ? (state.assignments ?? []).filter((a) => a.studentId === id)
    : [];
  const planCoaches = Object.fromEntries(
    assignments.flatMap((a) => {
      const coachId = assignmentCoachId(state, a);
      const coach = coachId ? teamMemberCoach(state, coachId) : undefined;
      return coach ? [[a.id, coach]] : [];
    }),
  );
  const subscription = currentSubscription(
    student.onlineSubscriptions,
    todayRome(),
  );
  return {
    services,
    lessonWallet: student.lessonWallet,
    coachingOutstanding: coachingOutstanding(student),
    onlineReceipts: student.onlineReceipts ?? [],
    ...(subscription
      ? {
          coaching: {
            durationMonths: subscription.durationMonths,
            startsOn: subscription.startsOn,
            endsOn: subscription.endsOn,
            coachName:
              state.admins.find((a) => a.id === subscription.coachId)?.name ??
              "",
          },
        }
      : {}),
    coach: assignedStudentCoach(state, student),
    workoutEntries: services.plans ? (student.workoutEntries ?? []) : [],
    maxes: services.plans ? (student.maxes ?? []) : [],
    cycleFeedback: services.plans ? (student.cycleFeedback ?? []) : [],
    races: student.races ?? [],
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      status: student.status,
    },
    assignments,
    planCoaches,
    lessons: (projectedState.lessons ?? [])
      .filter(
        (l) =>
          (services.lessons &&
            !l.cancelled &&
            availabilityIsPublished(state, l)) ||
          own.some((b) => b.lessonId === l.id),
      )
      .map((l) => {
        const enrolled = (state.bookings ?? []).some(
          (b) => b.lessonId === l.id && b.studentId === id && !b.cancelled,
        );
        const closed = bookingWindowClosed(l.startsAt);
        return {
          ...l,
          restriction:
            bookingRestriction(
              state.lessons?.some((item) => item.id === l.id)
                ? state
                : { ...state, lessons: [...(state.lessons ?? []), l] },
              id,
              l.id,
            ) || (closed && !enrolled ? bookingClosedMessage : ""),
          ...(closed && enrolled
            ? { cancelRestriction: cancelClosedMessage }
            : {}),
          enrolled,
          occupied: (state.bookings ?? []).filter(
            (b) => b.lessonId === l.id && !b.cancelled,
          ).length,
        };
      }),
  };
}
