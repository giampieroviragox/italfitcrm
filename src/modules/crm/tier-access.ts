import type { CrmState, CrmStudent, TierAccess } from "./model.ts";

export function isTierAccess(value: unknown): value is TierAccess {
  if (!value || typeof value !== "object") return false;
  const access = value as Record<string, unknown>;
  return (
    typeof access.plans === "boolean" &&
    typeof access.lessons === "boolean" &&
    (access.monthlyBookingLimit === null ||
      (typeof access.monthlyBookingLimit === "number" &&
        Number.isInteger(access.monthlyBookingLimit) &&
        access.monthlyBookingLimit >= 1 &&
        access.monthlyBookingLimit <= 200))
  );
}

export function studentAccess(
  state: CrmState,
  student: CrmStudent,
): TierAccess {
  const tier = state.tiers.find((item) => item.id === student.tierId);
  if (!tier || tier.archived || student.archived)
    return { plans: false, lessons: false, monthlyBookingLimit: null };
  // Compatibility for stored tiers; new tiers always save an explicit policy.
  return (
    tier.entitlements ?? {
      plans: true,
      lessons: true,
      monthlyBookingLimit: null,
    }
  );
}

export function lessonMonth(startsAt: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(startsAt));
}

export function bookingRestriction(
  state: CrmState,
  studentId: string,
  lessonId: string,
  excludeBookingId?: string,
): string {
  const student = state.students.find((item) => item.id === studentId);
  const lesson = state.lessons?.find((item) => item.id === lessonId);
  if (!student || !lesson) return "Studente o lezione non disponibile.";
  const access = studentAccess(state, student);
  if (!access.lessons)
    return "Le lezioni in sede non sono incluse in questo tier.";
  if (access.monthlyBookingLimit !== null) {
    const month = lessonMonth(lesson.startsAt);
    const lessons = new Map(
      (state.lessons ?? []).map((item) => [item.id, item]),
    );
    const used = (state.bookings ?? []).filter((booking) => {
      const item = lessons.get(booking.lessonId);
      return (
        booking.id !== excludeBookingId &&
        booking.studentId === studentId &&
        !booking.cancelled &&
        item &&
        !item.cancelled &&
        lessonMonth(item.startsAt) === month
      );
    }).length;
    if (used >= access.monthlyBookingLimit)
      return `Limite di ${access.monthlyBookingLimit} ${access.monthlyBookingLimit === 1 ? "lezione" : "lezioni"} per mese raggiunto. Annulla una prenotazione per liberare disponibilità nel mese.`;
  }
  return "";
}
