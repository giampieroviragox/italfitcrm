import { z } from "zod";
import {
  normalize,
  validDate,
  type CrmState,
  type CrmStudent,
} from "./model.ts";
import type { PlanAssignment } from "./fitness-model.ts";
import { coachName } from "./student-coach.ts";

/** Online coaching subscriptions: each month of the period includes one four-week plan. */
const cents = z.number().int().min(0).max(10_000_000);
const identifier = z.string().min(1).max(200);
const timestamp = z.iso.datetime({ offset: true });
const day = z.string().refine(validDate, "Data non valida.");
export const coachingDurations = [3, 6, 12] as const;
export type CoachingDuration = (typeof coachingDurations)[number];
const duration = z.union([z.literal(3), z.literal(6), z.literal(12)]);
/** Listino Coaching online, in centesimi. */
export const coachingPrices: Record<CoachingDuration, number> = {
  3: 39_000,
  6: 69_000,
  12: 129_000,
};

const subscriptionFields = {
  durationMonths: duration,
  startsOn: day,
  endsOn: day,
  coachId: identifier,
  price: cents,
};
const subscriptionPayment = z.object({
  amount: cents.min(1),
  date: timestamp,
  /** Team member who registered it. */
  by: z.string().max(120).optional(),
});
export const onlineSubscription = z.object({
  ...subscriptionFields,
  id: identifier,
  createdAt: timestamp,
  payments: z.array(subscriptionPayment).max(200).optional(),
});
export type OnlineSubscription = z.infer<typeof onlineSubscription>;
export const onlineSubscriptions = z.array(onlineSubscription).max(200);
const subscriptionInput = z.object(subscriptionFields);
export type OnlineSubscriptionInput = z.infer<typeof subscriptionInput>;

export const coachingCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    studentId: identifier,
    subscription: subscriptionInput,
  }),
  z.object({
    action: z.literal("update"),
    studentId: identifier,
    subscriptionId: identifier,
    subscription: subscriptionInput,
  }),
  z.object({
    action: z.literal("remove"),
    studentId: identifier,
    subscriptionId: identifier,
  }),
  z.object({
    action: z.literal("payment"),
    studentId: identifier,
    subscriptionId: identifier,
    amount: cents.min(1),
  }),
]);
export const subscriptionPaid = (s: Pick<OnlineSubscription, "payments">) =>
  (s.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
export const subscriptionOpen = (
  s: Pick<OnlineSubscription, "payments" | "price">,
) => Math.max(0, s.price - subscriptionPaid(s));
export type CoachingCommand = z.infer<typeof coachingCommand>;

const utc = (value: string) => new Date(`${value}T12:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Last valid day: same day N months later, minus one (clamped to month end). */
export function defaultEndDate(startsOn: string, months: number) {
  const start = utc(startsOn);
  const target = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1, 12),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  target.setUTCDate(target.getUTCDate() - 1);
  return iso(target);
}
export function nextDay(value: string) {
  const date = utc(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return iso(date);
}
export function daysBetween(from: string, to: string) {
  return Math.round((+utc(to) - +utc(from)) / 86_400_000);
}

export type SubscriptionStatus = "upcoming" | "active" | "expiring" | "expired";
export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  upcoming: "Da iniziare",
  active: "Attivo",
  expiring: "In scadenza",
  expired: "Scaduto",
};
/** Days before the end date when a subscription is flagged for renewal. */
export const expiringWithinDays = 14;
export function subscriptionStatus(
  subscription: Pick<OnlineSubscription, "startsOn" | "endsOn">,
  today: string,
): SubscriptionStatus {
  if (today < subscription.startsOn) return "upcoming";
  if (today > subscription.endsOn) return "expired";
  return daysBetween(today, subscription.endsOn) < expiringWithinDays
    ? "expiring"
    : "active";
}

/** One four-week plan for each month purchased. */
export const includedPlans = (s: Pick<OnlineSubscription, "durationMonths">) =>
  s.durationMonths;

/** Assignments whose plan month falls inside the subscription period. */
export function assignmentsInPeriod(
  assignments: PlanAssignment[],
  studentId: string,
  s: Pick<OnlineSubscription, "startsOn" | "endsOn">,
) {
  const from = s.startsOn.slice(0, 7),
    to = s.endsOn.slice(0, 7);
  return assignments.filter(
    (a) => a.studentId === studentId && a.month >= from && a.month <= to,
  );
}

/** The subscription that matters today: the running one, else the next, else the latest. */
export function currentSubscription(
  subscriptions: OnlineSubscription[] | undefined,
  today: string,
) {
  const list = subscriptions ?? [];
  return (
    list.find((s) => s.startsOn <= today && today <= s.endsOn) ??
    list
      .filter((s) => s.startsOn > today)
      .toSorted((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ??
    list.toSorted((a, b) => b.endsOn.localeCompare(a.endsOn))[0]
  );
}

/** The subscription a plan month belongs to: the one running mid-month, else any touching it. */
export function subscriptionForMonth(
  subscriptions: OnlineSubscription[] | undefined,
  month: string,
) {
  const touching = (subscriptions ?? []).filter(
    (s) => s.startsOn.slice(0, 7) <= month && month <= s.endsOn.slice(0, 7),
  );
  const middle = `${month}-15`;
  return (
    touching.find((s) => s.startsOn <= middle && middle <= s.endsOn) ??
    touching[0]
  );
}

/** The team member matching the student's reference coach, by name. */
export function referenceCoachId(state: CrmState, student: CrmStudent) {
  const name = normalize(coachName(student.coach));
  return state.admins.find((a) => normalize(coachName(a.name)) === name)?.id;
}

/** Default coach for a monthly plan: the subscription coach, else the reference coach. */
export function defaultPlanCoachId(
  state: CrmState,
  student: CrmStudent,
  month: string,
) {
  return (
    subscriptionForMonth(student.onlineSubscriptions, month)?.coachId ??
    referenceCoachId(state, student)
  );
}

/** Coach who follows (and is credited for) an assigned plan. */
export function assignmentCoachId(state: CrmState, assignment: PlanAssignment) {
  if (assignment.coachId) return assignment.coachId;
  const student = state.students.find((s) => s.id === assignment.studentId);
  return student
    ? defaultPlanCoachId(state, student, assignment.month)
    : undefined;
}

function validInput(
  state: CrmState,
  student: CrmStudent,
  input: OnlineSubscriptionInput,
  ignoreId?: string,
) {
  if (input.endsOn < input.startsOn)
    throw new Error("La scadenza deve essere successiva alla data di inizio.");
  if (daysBetween(input.startsOn, input.endsOn) > 3 * 366)
    throw new Error("Il periodo non può superare tre anni.");
  if (!state.admins.some((admin) => admin.id === input.coachId))
    throw new Error("Seleziona un coach del team.");
  const overlap = (student.onlineSubscriptions ?? []).find(
    (s) =>
      s.id !== ignoreId &&
      s.startsOn <= input.endsOn &&
      input.startsOn <= s.endsOn,
  );
  if (overlap)
    throw new Error(
      `Il periodo si sovrappone a un abbonamento esistente (${overlap.startsOn} → ${overlap.endsOn}).`,
    );
}

export function applyCoachingCommand(
  state: CrmState,
  command: CoachingCommand,
  now = new Date(),
  actorName?: string,
): CrmState {
  const student = state.students.find((s) => s.id === command.studentId);
  if (!student) throw new Error("Studente non disponibile.");
  if (student.archived)
    throw new Error("Ripristina lo studente prima di gestire l’abbonamento.");
  const current = student.onlineSubscriptions ?? [];
  let next: OnlineSubscription[];
  if (command.action === "create") {
    validInput(state, student, command.subscription);
    next = [
      ...current,
      {
        ...command.subscription,
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
      },
    ];
  } else {
    const existing = current.find((s) => s.id === command.subscriptionId);
    if (!existing)
      throw new Error("L’abbonamento non esiste più. Ricarica e riprova.");
    if (command.action === "update") {
      validInput(state, student, command.subscription, existing.id);
      if (command.subscription.price < subscriptionPaid(existing))
        throw new Error(
          "Il prezzo non può essere inferiore a quanto già incassato.",
        );
      next = current.map((s) =>
        s.id === existing.id ? { ...s, ...command.subscription } : s,
      );
    } else if (command.action === "payment") {
      if (command.amount > subscriptionOpen(existing))
        throw new Error("L’importo supera quanto resta da incassare.");
      next = current.map((s) =>
        s.id === existing.id
          ? {
              ...s,
              payments: [
                ...(s.payments ?? []),
                {
                  amount: command.amount,
                  date: now.toISOString(),
                  ...(actorName ? { by: actorName } : {}),
                },
              ],
            }
          : s,
      );
    } else {
      if (existing.payments?.length)
        throw new Error(
          "L’abbonamento ha incassi registrati: correggi date o prezzo invece di rimuoverlo.",
        );
      next = current.filter((s) => s.id !== existing.id);
    }
  }
  next = next.toSorted((a, b) => a.startsOn.localeCompare(b.startsOn));
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === student.id ? { ...s, onlineSubscriptions: next } : s,
    ),
  };
}
