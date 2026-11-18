import type { PlanAssignment } from "./fitness-model.ts";
import {
  emptyWallet,
  lessonVenues,
  outstandingAmount,
  type LessonVenue,
} from "./lesson-wallet.ts";
import type { CrmState, CrmStudent } from "./model.ts";
import {
  assignmentCoachId,
  subscriptionForMonth,
  subscriptionOpen,
} from "./online-coaching.ts";

/** Monthly figures for online coaching, lessons and coach compensation (cents). */
const romeMonth = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
const name = (s: CrmStudent) => `${s.firstName} ${s.lastName}`.trim();

const monthNumber = (month: string) =>
  Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));

/**
 * Value of a monthly plan: its subscription price spread over the months.
 * The cents that do not divide evenly go to the first months, so the monthly
 * values always add up to the price.
 */
export function planValue(state: CrmState, assignment: PlanAssignment) {
  const student = state.students.find((s) => s.id === assignment.studentId);
  const sub = subscriptionForMonth(
    student?.onlineSubscriptions,
    assignment.month,
  );
  if (!sub) return 0;
  const share = Math.floor(sub.price / sub.durationMonths);
  const extra = sub.price - share * sub.durationMonths;
  const index =
    monthNumber(assignment.month) - monthNumber(sub.startsOn.slice(0, 7));
  return share + (index >= 0 && index < extra ? 1 : 0);
}

export interface PlanRow {
  assignmentId: string;
  studentId: string;
  studentName: string;
  title: string;
  coachId?: string;
  value: number;
  compensation: number;
}
/** Monthly plans with their value and the compensation of the coach following them. */
export function planRows(state: CrmState, month: string): PlanRow[] {
  return (state.assignments ?? [])
    .filter((a) => a.month === month)
    .flatMap((a) => {
      const student = state.students.find((s) => s.id === a.studentId);
      if (!student) return [];
      const coachId = assignmentCoachId(state, a);
      const percent =
        state.admins.find((m) => m.id === coachId)?.compensationPercent ?? 0;
      const value = planValue(state, a);
      return [
        {
          assignmentId: a.id,
          studentId: student.id,
          studentName: name(student),
          title: a.snapshot.title,
          ...(coachId ? { coachId } : {}),
          value,
          compensation: Math.round((value * percent) / 100),
        },
      ];
    })
    .toSorted((a, b) => a.studentName.localeCompare(b.studentName, "it"));
}

export interface CoachCompensation {
  coachId: string;
  coachName: string;
  percent: number;
  plans: number;
  value: number;
  compensation: number;
}
export function compensations(
  state: CrmState,
  month: string,
): CoachCompensation[] {
  const rows = planRows(state, month);
  return state.admins
    .map((coach) => {
      const own = rows.filter((r) => r.coachId === coach.id);
      return {
        coachId: coach.id,
        coachName: coach.name,
        percent: coach.compensationPercent ?? 0,
        plans: own.length,
        value: own.reduce((s, r) => s + r.value, 0),
        compensation: own.reduce((s, r) => s + r.compensation, 0),
      };
    })
    .filter((c) => c.plans > 0 || c.percent > 0);
}

export interface OnlineMonth {
  activeSubscriptions: number;
  newSubscriptions: number;
  sold: number;
  collected: number;
  /** Still to collect on every subscription, today. */
  open: number;
  plans: number;
  planValue: number;
  compensation: number;
  payments: {
    date: string;
    studentId: string;
    studentName: string;
    amount: number;
    by?: string;
  }[];
}
export function onlineMonth(state: CrmState, month: string): OnlineMonth {
  const subs = state.students.flatMap((student) =>
    (student.onlineSubscriptions ?? []).map((sub) => ({ student, sub })),
  );
  const rows = planRows(state, month);
  const payments = subs
    .flatMap(({ student, sub }) =>
      (sub.payments ?? [])
        .filter((p) => romeMonth(p.date) === month)
        .map((p) => ({
          date: p.date,
          studentId: student.id,
          studentName: name(student),
          amount: p.amount,
          ...(p.by ? { by: p.by } : {}),
        })),
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));
  return {
    activeSubscriptions: subs.filter(
      ({ sub }) =>
        sub.startsOn.slice(0, 7) <= month && month <= sub.endsOn.slice(0, 7),
    ).length,
    newSubscriptions: subs.filter(({ sub }) => sub.startsOn.startsWith(month))
      .length,
    sold: subs
      .filter(({ sub }) => sub.startsOn.startsWith(month))
      .reduce((s, { sub }) => s + sub.price, 0),
    collected: payments.reduce((s, p) => s + p.amount, 0),
    open: subs.reduce((s, { sub }) => s + subscriptionOpen(sub), 0),
    plans: rows.length,
    planValue: rows.reduce((s, r) => s + r.value, 0),
    compensation: rows.reduce((s, r) => s + r.compensation, 0),
    payments,
  };
}

export interface VenueMonth {
  venue: LessonVenue;
  label: string;
  groupLessons: number;
  individualLessons: number;
  attendances: number;
  /** Amount due for the month's lessons (pack lessons at their pack share). */
  accrued: number;
}
export interface LessonsMonth {
  venues: VenueMonth[];
  packsSold: number;
  packsAmount: number;
  collected: number;
  open: number;
}
export function lessonsMonth(state: CrmState, month: string): LessonsMonth {
  const wallets = state.students.map((s) => s.lessonWallet ?? emptyWallet);
  const lessons = wallets.flatMap((w) =>
    w.lessons.filter((l) => romeMonth(l.startsAt) === month),
  );
  const venues = (Object.keys(lessonVenues) as LessonVenue[]).map((venue) => {
    const here = lessons.filter((l) => l.venue === venue);
    const individual = here.filter((l) => l.id.startsWith("manual-"));
    const group = here.filter((l) => !l.id.startsWith("manual-"));
    return {
      venue,
      label: lessonVenues[venue],
      groupLessons: new Set(group.map((l) => l.id)).size,
      individualLessons: individual.length,
      attendances: here.length,
      accrued: here.reduce(
        (s, l) => s + (l.creditId ? (l.allocatedPrice ?? 0) : l.price),
        0,
      ),
    };
  });
  const packs = wallets.flatMap((w) =>
    w.credits.filter((c) => romeMonth(c.purchasedAt) === month),
  );
  const collected = wallets
    .flatMap((w) => [...w.credits, ...w.lessons])
    .flatMap((item) => item.payments)
    .filter((p) => romeMonth(p.date) === month)
    .reduce((s, p) => s + p.amount, 0);
  return {
    venues,
    packsSold: packs.length,
    packsAmount: packs.reduce((s, c) => s + c.price, 0),
    collected,
    open: wallets.reduce((s, w) => s + outstandingAmount(w), 0),
  };
}

/** Months with any accounting activity, newest first, always including today's. */
export function accountingMonths(state: CrmState, today: string) {
  const months = new Set<string>([today.slice(0, 7)]);
  for (const s of state.students) {
    for (const sub of s.onlineSubscriptions ?? []) {
      months.add(sub.startsOn.slice(0, 7));
      for (const p of sub.payments ?? []) months.add(romeMonth(p.date));
    }
    const w = s.lessonWallet;
    if (w)
      for (const item of [...w.credits, ...w.lessons]) {
        months.add(
          romeMonth("purchasedAt" in item ? item.purchasedAt : item.startsAt),
        );
        for (const p of item.payments) months.add(romeMonth(p.date));
      }
  }
  for (const a of state.assignments ?? []) months.add(a.month);
  return [...months]
    .filter((m) => m <= today.slice(0, 7))
    .toSorted()
    .reverse();
}
