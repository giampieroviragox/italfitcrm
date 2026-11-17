import { normalize, type CrmState } from "./model.ts";
import type { Lesson } from "./fitness-model.ts";
import {
  availabilityCapacity,
  availabilityDurationMinutes,
} from "./availability.ts";
import { coachName } from "./student-coach.ts";

export function availabilityLessonId(
  adminId: string,
  startsAt: string,
  duration: number,
) {
  return `availability:${encodeURIComponent(adminId)}:${Date.parse(startsAt)}:${duration}`;
}

/** Existing appointments are bookable only if they cover a published period exactly. */
export function publishedAvailabilityCapacity(state: CrmState, lesson: Lesson) {
  if (!lesson.availability) return undefined;
  const admin = state.admins.find(
    (item) =>
      item.id === lesson.availability?.adminId && item.status === "active",
  );
  const start = Date.parse(lesson.startsAt);
  const period = admin?.availability?.find(
    (item) =>
      Date.parse(item.start) === start &&
      availabilityDurationMinutes(item) === lesson.durationMinutes,
  );
  return period ? availabilityCapacity(period) : undefined;
}

export function withAvailabilityCapacity(
  state: CrmState,
  lesson: Lesson,
): Lesson {
  if (lesson.settlement) return lesson;
  const capacity = publishedAvailabilityCapacity(state, lesson);
  return capacity === undefined || capacity === lesson.capacity
    ? lesson
    : { ...lesson, capacity };
}

export function availabilityIsPublished(state: CrmState, lesson: Lesson) {
  return (
    !lesson.availability ||
    publishedAvailabilityCapacity(state, lesson) !== undefined
  );
}

export function availabilityBlocksTime(
  state: CrmState,
  lesson: Lesson,
): boolean {
  return (
    !lesson.cancelled &&
    (availabilityIsPublished(state, lesson) ||
      (state.bookings ?? []).some(
        (booking) => booking.lessonId === lesson.id && !booking.cancelled,
      ))
  );
}
function collides(a: Lesson, b: Lesson) {
  return (
    Date.parse(a.startsAt) <
      Date.parse(b.startsAt) + b.durationMinutes * 60000 &&
    Date.parse(b.startsAt) <
      Date.parse(a.startsAt) + a.durationMinutes * 60000 &&
    (normalize(coachName(a.coach)) === normalize(coachName(b.coach)) ||
      normalize(a.location) === normalize(b.location))
  );
}
/** One bookable lesson per period, persisted on the first reservation. */
export function availabilityLessons(
  state: CrmState,
  now = Date.now(),
): Lesson[] {
  const saved = state.lessons ?? [];
  const savedIds = new Set(saved.map((lesson) => lesson.id));
  const occupied = saved.filter((lesson) =>
    availabilityBlocksTime(state, lesson),
  );
  const result: Lesson[] = [];
  for (const admin of state.admins) {
    if (admin.status !== "active") continue;
    for (const period of admin.availability ?? []) {
      const start = Date.parse(period.start);
      if (start <= now) continue;
      const startsAt = new Date(start).toISOString();
      const durationMinutes = availabilityDurationMinutes(period);
      const lesson: Lesson = {
        id: availabilityLessonId(admin.id, startsAt, durationMinutes),
        title: "Allenamento in sede",
        startsAt,
        durationMinutes,
        capacity: availabilityCapacity(period),
        coach: coachName(admin.name),
        location: "Sala principale",
        cancelled: false,
        availability: { adminId: admin.id },
      };
      if (
        savedIds.has(lesson.id) ||
        occupied.some((item) => collides(item, lesson))
      )
        continue;
      result.push(lesson);
    }
  }
  return result;
}
