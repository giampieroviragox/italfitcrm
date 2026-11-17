import { z } from "zod";
import type { CrmState } from "./model.ts";
import type { Lesson } from "./fitness-model.ts";

const cents = z.number().int().min(0).max(10_000_000);
const positiveCents = cents.min(1);
const identifier = z.string().min(1).max(200);
const timestamp = z.iso.datetime({ offset: true });
const payment = z.object({ amount: positiveCents, date: timestamp });
export const lessonVenues = { milano: "Milano", monza: "Monza e Brianza" };
export const lessonVenue = z.enum(["milano", "monza"]);
export type LessonVenue = z.infer<typeof lessonVenue>;
const planFields = {
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["package", "subscription"]),
  unit: z.enum(["minutes", "lessons"]),
  quantity: z.number().int().min(1).max(60_000),
  price: cents,
  individual: z.boolean(),
  venue: lessonVenue.optional(),
};
const lessonCredit = z.object({
  ...planFields,
  id: identifier,
  purchasedAt: timestamp,
  payments: z.array(payment),
});
const lessonCharge = z.object({
  id: identifier,
  title: z.string(),
  startsAt: timestamp,
  minutes: z.number().int().min(1).max(1440),
  price: cents,
  creditId: identifier.optional(),
  allocatedPrice: cents.optional(),
  venue: lessonVenue,
  participants: z.number().int().min(1).max(200),
  payments: z.array(payment),
});
export const lessonWallet = z.object({
  credits: z.array(lessonCredit),
  lessons: z.array(lessonCharge),
});
export type LessonWallet = z.infer<typeof lessonWallet>;
export type LessonCredit = z.infer<typeof lessonCredit>;
export type LessonCharge = z.infer<typeof lessonCharge>;
export const lessonSettlement = z.object({
  closedAt: timestamp,
  venue: lessonVenue,
  participants: z.number().int().min(0).max(200),
});
export type LessonSettlement = z.infer<typeof lessonSettlement>;
export const milanoPrivateCredit = {
  name: "Milano 1:1 · 10 ore + 1 in regalo",
  kind: "package",
  unit: "minutes",
  quantity: 660,
  price: 75_000,
  individual: true,
  venue: "milano",
} as const;

const tariffs: Record<LessonVenue, readonly number[]> = {
  milano: [7000, 5000, 4000, 3500, 3000, 2500, 2500, 2500],
  monza: [4000, 2500, 2000, 1500, 1500, 1500, 1500],
};

export function lessonPrice(
  venue: LessonVenue,
  participants: number,
  minutes: number,
) {
  if (venue === "milano" && minutes !== 60) return undefined;
  return tariffs[venue][participants - 1];
}

export const emptyWallet: LessonWallet = { credits: [], lessons: [] };
export function paidAmount(item: LessonCredit | LessonCharge) {
  return item.payments.reduce((total, p) => total + p.amount, 0);
}

export function remainingCredit(wallet: LessonWallet, credit: LessonCredit) {
  return wallet.lessons.reduce(
    (remaining, lesson) =>
      lesson.creditId === credit.id
        ? remaining - (credit.unit === "minutes" ? lesson.minutes : 1)
        : remaining,
    credit.quantity,
  );
}

export function canUseLessonCredit(
  wallet: LessonWallet,
  credit: LessonCredit,
  venue: LessonVenue,
  participants: number,
  minutes: number,
) {
  return (
    (!credit.venue || credit.venue === venue) &&
    (!credit.individual || participants === 1) &&
    remainingCredit(wallet, credit) >= (credit.unit === "minutes" ? minutes : 1)
  );
}

export const walletCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("credit"),
    studentId: identifier,
    credit: z.object(planFields),
  }),
  z.object({
    action: z.literal("payment"),
    studentId: identifier,
    category: z.enum(["credit", "lesson"]),
    targetId: identifier,
    amount: positiveCents,
  }),
  z.object({
    action: z.literal("settle"),
    lessonId: identifier,
    venue: lessonVenue,
    manualPrice: cents.optional(),
    roster: z
      .array(
        z.object({
          bookingId: identifier,
          present: z.boolean(),
          creditId: identifier.optional(),
        }),
      )
      .max(200),
  }),
]);
export type WalletCommand = z.infer<typeof walletCommand>;

function settleLesson(
  state: CrmState,
  command: Extract<WalletCommand, { action: "settle" }>,
  now: Date,
): CrmState {
  const lesson = state.lessons?.find((item) => item.id === command.lessonId);
  if (!lesson || lesson.cancelled || lesson.settlement)
    throw new Error("La lezione non è disponibile per il consuntivo.");
  if (!lessonHasEnded(lesson, +now))
    throw new Error("Registra le presenze dopo la fine della lezione.");

  const bookings = (state.bookings ?? []).filter(
    (booking) => booking.lessonId === lesson.id && !booking.cancelled,
  );
  const roster = new Map(
    command.roster.map((entry) => [entry.bookingId, entry]),
  );
  if (
    roster.size !== command.roster.length ||
    roster.size !== bookings.length ||
    bookings.some((b) => !roster.has(b.id))
  )
    throw new Error("Gli iscritti sono cambiati. Riapri il consuntivo.");

  const present = bookings.filter((b) => roster.get(b.id)?.present);
  const tariff =
    lessonPrice(command.venue, present.length, lesson.durationMinutes) ??
    command.manualPrice;
  if (present.some((b) => !roster.get(b.id)?.creditId) && tariff === undefined)
    throw new Error(
      "Per questa durata o capienza inserisci la tariffa a persona.",
    );

  const byStudent = new Map(present.map((b) => [b.studentId, b]));
  if (
    present.some(
      (b) => !state.students.some((s) => s.id === b.studentId && !s.archived),
    )
  )
    throw new Error("Uno degli studenti selezionati non è disponibile.");
  if (byStudent.size !== present.length)
    throw new Error("Sono presenti prenotazioni duplicate.");
  const settlement: LessonSettlement = {
    closedAt: now.toISOString(),
    venue: command.venue,
    participants: present.length,
  };
  return {
    ...state,
    lessons: state.lessons?.map((l) =>
      l.id === lesson.id ? { ...l, settlement } : l,
    ),
    students: state.students.map((student) => {
      const booking = byStudent.get(student.id);
      if (!booking) return student;
      const wallet = student.lessonWallet ?? emptyWallet;
      const creditId = roster.get(booking.id)?.creditId;
      const credit = wallet.credits.find((item) => item.id === creditId);
      if (
        creditId &&
        (!credit ||
          !canUseLessonCredit(
            wallet,
            credit,
            command.venue,
            present.length,
            lesson.durationMinutes,
          ))
      )
        throw new Error(
          `Credito non utilizzabile per ${student.firstName} ${student.lastName}.`,
        );
      // Allocate the pack price in cents without billing it a second time.
      const allocatedPrice = credit
        ? (() => {
            const used = credit.quantity - remainingCredit(wallet, credit);
            const portion =
              credit.unit === "minutes" ? lesson.durationMinutes : 1;
            const allocated = (quantity: number) =>
              Math.round((credit.price * quantity) / credit.quantity);
            return allocated(used + portion) - allocated(used);
          })()
        : undefined;
      const entry: LessonCharge = {
        id: lesson.id,
        title: lesson.title,
        startsAt: lesson.startsAt,
        minutes: lesson.durationMinutes,
        venue: command.venue,
        participants: present.length,
        price: credit ? 0 : (tariff ?? 0),
        ...(credit ? { creditId: credit.id, allocatedPrice } : {}),
        payments: [],
      };
      return {
        ...student,
        lessonWallet: { ...wallet, lessons: [...wallet.lessons, entry] },
      };
    }),
  };
}

export function applyWalletCommand(
  state: CrmState,
  command: WalletCommand,
  now = new Date(),
): CrmState {
  if (command.action === "settle") return settleLesson(state, command, now);
  const student = state.students.find((s) => s.id === command.studentId);
  if (!student || (student.archived && command.action === "credit"))
    throw new Error("Studente non disponibile.");
  const wallet = student.lessonWallet ?? emptyWallet;
  let next: LessonWallet;
  if (command.action === "credit") {
    next = {
      ...wallet,
      credits: [
        ...wallet.credits,
        {
          ...command.credit,
          id: crypto.randomUUID(),
          purchasedAt: now.toISOString(),
          payments: [],
        },
      ],
    };
  } else {
    const key = command.category === "credit" ? "credits" : "lessons";
    const item = wallet[key].find((entry) => entry.id === command.targetId);
    if (!item || command.amount > item.price - paidAmount(item))
      throw new Error(
        "L’importo supera il saldo residuo o la voce non esiste.",
      );
    const payment = { amount: command.amount, date: now.toISOString() };
    const add = <T extends LessonCredit | LessonCharge>(entry: T): T =>
      entry.id === item.id
        ? { ...entry, payments: [...entry.payments, payment] }
        : entry;
    next = {
      credits: key === "credits" ? wallet.credits.map(add) : wallet.credits,
      lessons: key === "lessons" ? wallet.lessons.map(add) : wallet.lessons,
    };
  }
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === student.id ? { ...s, lessonWallet: next } : s,
    ),
  };
}

export function lessonHasEnded(lesson: Lesson, now: number) {
  return Date.parse(lesson.startsAt) + lesson.durationMinutes * 60_000 <= now;
}
