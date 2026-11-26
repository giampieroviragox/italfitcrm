import { z } from "zod";
import {
  normalize,
  validDate,
  type CrmState,
  type CrmStudent,
} from "./model.ts";
import type { PlanAssignment } from "./fitness-model.ts";
import { coachName } from "./student-coach.ts";
import { assignmentPeriod } from "./plan-cycles.ts";
import { receipt, type Receipt, type ReceiptInput } from "./lesson-wallet.ts";

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
  /** Set when the payment comes from an approved student receipt. */
  receiptId: identifier.optional(),
});
/** Receipts a student uploads for online coaching payments. */
export const onlineReceipts = z.array(receipt).max(500);
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
  z.object({
    action: z.literal("review"),
    studentId: identifier,
    receiptId: identifier,
    decision: z.enum(["approve", "reject"]),
    /** Amount actually received; defaults to the declared one. */
    amount: cents.min(1).optional(),
    reason: z.string().trim().max(500).optional(),
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

/** One four-week cycle for each month purchased. */
export const includedPlans = (s: Pick<OnlineSubscription, "durationMonths">) =>
  s.durationMonths;

/** Personalized plans whose cycle starts inside the subscription period. */
export function assignmentsInPeriod(
  assignments: PlanAssignment[],
  studentId: string,
  s: Pick<OnlineSubscription, "startsOn" | "endsOn">,
) {
  return assignments.filter((a) => {
    if (a.studentId !== studentId || a.guidedCategory) return false;
    if (!a.startsOn)
      return (
        a.month >= s.startsOn.slice(0, 7) && a.month <= s.endsOn.slice(0, 7)
      );
    const start = assignmentPeriod(a).startsOn;
    return s.startsOn <= start && start <= s.endsOn;
  });
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

/** The subscription running on a day. */
export function subscriptionForDate(
  subscriptions: OnlineSubscription[] | undefined,
  day: string,
) {
  return (subscriptions ?? []).find(
    (s) => s.startsOn <= day && day <= s.endsOn,
  );
}
/** The subscription of a plan: the one running when its cycle starts (older plans: by month). */
export function subscriptionForAssignment(
  subscriptions: OnlineSubscription[] | undefined,
  assignment: Pick<PlanAssignment, "month" | "startsOn">,
) {
  return assignment.startsOn
    ? subscriptionForDate(subscriptions, assignment.startsOn)
    : subscriptionForMonth(subscriptions, assignment.month);
}

/** The team member matching the student's reference coach, by name. */
export function referenceCoachId(state: CrmState, student: CrmStudent) {
  const name = normalize(coachName(student.coach));
  return state.admins.find((a) => normalize(coachName(a.name)) === name)?.id;
}

/** Default coach for a plan starting on a day (or in a month): the subscription coach, else the reference coach. */
export function defaultPlanCoachId(
  state: CrmState,
  student: CrmStudent,
  dayOrMonth: string | undefined,
) {
  const subscription = !dayOrMonth
    ? undefined
    : dayOrMonth.length === 7
      ? subscriptionForMonth(student.onlineSubscriptions, dayOrMonth)
      : subscriptionForDate(student.onlineSubscriptions, dayOrMonth);
  return subscription?.coachId ?? referenceCoachId(state, student);
}

/** Coach who follows (and is credited for) an assigned plan. */
export function assignmentCoachId(state: CrmState, assignment: PlanAssignment) {
  if (assignment.coachId) return assignment.coachId;
  const student = state.students.find((s) => s.id === assignment.studentId);
  return student
    ? defaultPlanCoachId(
        state,
        student,
        assignment.startsOn ?? assignment.month,
      )
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
  if (command.action === "review")
    return reviewOnlineReceipt(state, student, command, now, actorName);
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

/** Still to collect on all of a student's online coaching subscriptions. */
export const coachingOutstanding = (
  student: Pick<CrmStudent, "onlineSubscriptions">,
) =>
  (student.onlineSubscriptions ?? []).reduce(
    (sum, s) => sum + subscriptionOpen(s),
    0,
  );

const maxPendingOnlineReceipts = 20;
/** A student declares a payment for online coaching, with its receipt. */
export function submitOnlineReceipt(
  state: CrmState,
  studentId: string,
  input: ReceiptInput,
  file: Receipt["file"],
  today: string,
  now = new Date(),
  id: string = crypto.randomUUID(),
): CrmState {
  const student = state.students.find(
    (s) => s.id === studentId && !s.archived && !s.accessDisabled,
  );
  if (!student) throw new Error("Studente non disponibile.");
  if (input.paidOn > today)
    throw new Error("La data del pagamento non può essere nel futuro.");
  if (input.method !== "contanti" && !file)
    throw new Error("Allega la ricevuta o lo screenshot del pagamento.");
  const outstanding = coachingOutstanding(student);
  if (!outstanding)
    throw new Error("Non hai importi da saldare per il Coaching online.");
  if (input.amount > outstanding)
    throw new Error(
      `L’importo supera quanto da saldare (${(outstanding / 100).toFixed(2).replace(".", ",")} €).`,
    );
  const receipts = student.onlineReceipts ?? [];
  if (
    receipts.filter((r) => r.status === "pending").length >=
    maxPendingOnlineReceipts
  )
    throw new Error("Hai già molti pagamenti in attesa di verifica.");
  const entry: Receipt = {
    ...input,
    note: input.note.trim(),
    id,
    ...(file ? { file } : {}),
    submittedAt: now.toISOString(),
    status: "pending",
  };
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === studentId ? { ...s, onlineReceipts: [...receipts, entry] } : s,
    ),
  };
}

/** Approve once (spreading the amount over open subscriptions, oldest first) or reject. */
function reviewOnlineReceipt(
  state: CrmState,
  student: CrmStudent,
  command: Extract<CoachingCommand, { action: "review" }>,
  now: Date,
  reviewer?: string,
): CrmState {
  const receipt = student.onlineReceipts?.find(
    (r) => r.id === command.receiptId,
  );
  if (!receipt)
    throw new Error("Il pagamento non esiste più. Aggiorna la pagina.");
  if (receipt.status !== "pending")
    throw new Error("Questo pagamento è già stato verificato.");
  const reviewed: Receipt = {
    ...receipt,
    status: command.decision === "approve" ? "approved" : "rejected",
    reviewedAt: now.toISOString(),
    ...(reviewer ? { reviewedBy: reviewer } : {}),
    ...(command.decision === "approve"
      ? { approvedAmount: command.amount ?? receipt.amount }
      : command.reason
        ? { rejectionReason: command.reason }
        : {}),
  };
  let subscriptions = student.onlineSubscriptions ?? [];
  if (command.decision === "approve") {
    let left = reviewed.approvedAmount!;
    if (left > coachingOutstanding(student))
      throw new Error("L’importo supera quanto resta da incassare.");
    const order = subscriptions
      .filter((s) => subscriptionOpen(s) > 0)
      .toSorted(
        (a, b) =>
          a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id),
      )
      .map((s) => s.id);
    const shares = new Map<string, number>();
    for (const id of order) {
      if (!left) break;
      const share = Math.min(
        left,
        subscriptionOpen(subscriptions.find((s) => s.id === id)!),
      );
      shares.set(id, share);
      left -= share;
    }
    subscriptions = subscriptions.map((s) =>
      shares.has(s.id)
        ? {
            ...s,
            payments: [
              ...(s.payments ?? []),
              {
                amount: shares.get(s.id)!,
                date: now.toISOString(),
                ...(reviewer ? { by: reviewer } : {}),
                receiptId: receipt.id,
              },
            ],
          }
        : s,
    );
  }
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === student.id
        ? {
            ...s,
            onlineSubscriptions: subscriptions,
            onlineReceipts: (s.onlineReceipts ?? []).map((r) =>
              r.id === receipt.id ? reviewed : r,
            ),
          }
        : s,
    ),
  };
}
