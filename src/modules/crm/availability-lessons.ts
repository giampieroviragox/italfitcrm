import { normalize, type CrmState } from "./model.ts";
import type { Lesson } from "./fitness-model.ts";
import { availabilitySlotCount, slotDurationMinutes } from "./availability.ts";

export function availabilityLessonId(
  adminId: string,
  startsAt: string,
  duration: number,
) {
  return `availability:${encodeURIComponent(adminId)}:${Date.parse(startsAt)}:${duration}`;
}
export function availabilityIsPublished(
  state: CrmState,
  lesson: Lesson,
): boolean {
  if (!lesson.availability) return true;
  const admin = state.admins.find(
    (item) =>
      item.id === lesson.availability?.adminId && item.status === "active",
  );
  const start = Date.parse(lesson.startsAt);
  return Boolean(
    admin?.availability?.some((period) => {
      const duration = slotDurationMinutes(period);
      const offset = start - Date.parse(period.start);
      return (
        duration === lesson.durationMinutes &&
        offset >= 0 &&
        offset % (duration * 60000) === 0 &&
        start + duration * 60000 <= Date.parse(period.end)
      );
    }),
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
    (normalize(a.coach) === normalize(b.coach) ||
      normalize(a.location) === normalize(b.location))
  );
}
/** Published slots are projected as lessons and persisted only when first booked. */
export function availabilityLessons(
  state: CrmState,
  now = Date.now(),
): Lesson[] {
  const saved = state.lessons ?? [];
  const result: Lesson[] = [];
  for (const admin of state.admins) {
    if (admin.status !== "active") continue;
    for (const period of admin.availability ?? []) {
      const durationMinutes = slotDurationMinutes(period);
      for (let index = 0; index < availabilitySlotCount(period); index++) {
        const start =
          Date.parse(period.start) + index * durationMinutes * 60000;
        if (start <= now) continue;
        const startsAt = new Date(start).toISOString();
        const lesson: Lesson = {
          id: availabilityLessonId(admin.id, startsAt, durationMinutes),
          title: "Allenamento in sede",
          startsAt,
          durationMinutes,
          capacity: 1,
          coach: admin.name,
          location: "Sala principale",
          cancelled: false,
          availability: { adminId: admin.id },
        };
        if (
          saved.some(
            (item) =>
              item.id === lesson.id ||
              (availabilityBlocksTime(state, item) && collides(item, lesson)),
          )
        )
          continue;
        result.push(lesson);
      }
    }
  }
  return result;
}
