import { z } from "zod";
import { validDate, type CrmState } from "./model.ts";
import type { Lesson } from "./fitness-model.ts";

const cents = z.number().int().min(0).max(10_000_000);
const positiveCents = cents.min(1);
const identifier = z.string().min(1).max(200);
const timestamp = z.iso.datetime({ offset: true });
const payment = z.object({
  amount: positiveCents,
  date: timestamp,
  /** Set when the payment comes from an approved student receipt. */
  receiptId: identifier.optional(),
});
const day = z.string().refine(validDate, "Data non valida.");
export const paymentMethods = {
  paypal: "PayPal",
  bonifico: "Bonifico",
  contanti: "Di persona",
} as const;
export const paymentMethod = z.enum(["paypal", "bonifico", "contanti"]);
export const receiptFileTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
} as const;
/** Kept under the 4.5 MB request limit of the hosting platform. */
export const maxReceiptBytes = 4_000_000;
const receiptFile = z.object({
  path: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  type: z.enum(
    Object.keys(receiptFileTypes) as [keyof typeof receiptFileTypes],
  ),
  size: z.number().int().min(1).max(maxReceiptBytes),
});
export const receiptInput = z.object({
  amount: positiveCents,
  method: paymentMethod,
  paidOn: day,
  note: z.string().trim().max(500),
});
export const receipt = receiptInput.extend({
  id: identifier,
  file: receiptFile.optional(),
  submittedAt: timestamp,
  status: z.enum(["pending", "approved", "rejected"]),
  reviewedAt: timestamp.optional(),
  reviewedBy: z.string().max(120).optional(),
  approvedAmount: positiveCents.optional(),
  rejectionReason: z.string().trim().max(500).optional(),
});
export type Receipt = z.infer<typeof receipt>;
export type ReceiptInput = z.infer<typeof receiptInput>;
export const receiptStatusLabels = {
  pending: "Da verificare",
  approved: "Approvato",
  rejected: "Rifiutato",
} as const;
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
  receipts: z.array(receipt).max(500).optional(),
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
    action: z.literal("review"),
    studentId: identifier,
    receiptId: identifier,
    decision: z.enum(["approve", "reject"]),
    /** Amount actually received; defaults to the declared one. */
    amount: positiveCents.optional(),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("record"),
    studentId: identifier,
    /** Individual lesson agreed directly with the coach. */
    lesson: z.object({
      title: z.string().trim().min(1).max(100),
      startsAt: timestamp,
      minutes: z.number().int().min(15).max(240),
      venue: lessonVenue,
      participants: z.literal(1),
    }),
    /** Agreed price per person; defaults to the list price. */
    manualPrice: cents.optional(),
    creditId: identifier.optional(),
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

  if (command.roster.some((entry) => entry.creditId))
    throw new Error(
      "Le lezioni di gruppo si pagano a listino: i pacchetti valgono solo per le lezioni individuali.",
    );
  const present = bookings.filter((b) => roster.get(b.id)?.present);
  const tariff =
    lessonPrice(command.venue, present.length, lesson.durationMinutes) ??
    command.manualPrice;
  if (present.length && tariff === undefined)
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
      const entry: LessonCharge = {
        id: lesson.id,
        title: lesson.title,
        startsAt: lesson.startsAt,
        minutes: lesson.durationMinutes,
        venue: command.venue,
        participants: present.length,
        price: tariff ?? 0,
        payments: [],
      };
      return {
        ...student,
        lessonWallet: { ...wallet, lessons: [...wallet.lessons, entry] },
      };
    }),
  };
}

/** Share of a pack price used by one lesson, in cents, never billed twice. */
function creditShare(
  wallet: LessonWallet,
  credit: LessonCredit,
  minutes: number,
) {
  const used = credit.quantity - remainingCredit(wallet, credit);
  const portion = credit.unit === "minutes" ? minutes : 1;
  const allocated = (quantity: number) =>
    Math.round((credit.price * quantity) / credit.quantity);
  return allocated(used + portion) - allocated(used);
}

/** An individual (1:1) lesson agreed directly with the coach and already held. */
function recordLesson(
  state: CrmState,
  command: Extract<WalletCommand, { action: "record" }>,
  now: Date,
): CrmState {
  const student = state.students.find(
    (s) => s.id === command.studentId && !s.archived,
  );
  if (!student) throw new Error("Studente non disponibile.");
  const { lesson } = command;
  if (lesson.participants !== 1)
    throw new Error("Si registrano a mano solo le lezioni individuali.");
  if (Date.parse(lesson.startsAt) > +now)
    throw new Error("Registra la lezione dopo averla svolta.");
  const wallet = student.lessonWallet ?? emptyWallet;
  const credit = wallet.credits.find((c) => c.id === command.creditId);
  if (
    command.creditId &&
    (!credit ||
      !canUseLessonCredit(
        wallet,
        credit,
        lesson.venue,
        lesson.participants,
        lesson.minutes,
      ))
  )
    throw new Error("Il credito scelto non copre questa lezione.");
  const tariff =
    command.manualPrice ??
    lessonPrice(lesson.venue, lesson.participants, lesson.minutes);
  if (!credit && tariff === undefined)
    throw new Error("Per questa durata o capienza inserisci il prezzo.");
  const entry: LessonCharge = {
    id: `manual-${crypto.randomUUID()}`,
    title: lesson.title,
    startsAt: lesson.startsAt,
    minutes: lesson.minutes,
    venue: lesson.venue,
    participants: lesson.participants,
    price: credit ? 0 : tariff!,
    ...(credit
      ? {
          creditId: credit.id,
          allocatedPrice: creditShare(wallet, credit, lesson.minutes),
        }
      : {}),
    payments: [],
  };
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === student.id
        ? {
            ...s,
            lessonWallet: { ...wallet, lessons: [...wallet.lessons, entry] },
          }
        : s,
    ),
  };
}

export function applyWalletCommand(
  state: CrmState,
  command: WalletCommand,
  now = new Date(),
  actorName?: string,
): CrmState {
  if (command.action === "settle") return settleLesson(state, command, now);
  if (command.action === "record") return recordLesson(state, command, now);
  if (command.action === "review")
    return reviewReceipt(state, command, now, actorName);
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
          // Packs cover individual lessons only; group lessons use the list price.
          kind: "package",
          individual: true,
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

/** Total still to pay across packs and lessons, in cents. */
export function outstandingAmount(wallet: LessonWallet) {
  return [...wallet.credits, ...wallet.lessons].reduce(
    (sum, item) => sum + Math.max(0, item.price - paidAmount(item)),
    0,
  );
}

/** Spreads an amount over the open items, oldest first. */
export function allocatePayment(
  wallet: LessonWallet,
  amount: number,
  date: string,
  receiptId?: string,
): LessonWallet {
  if (amount > outstandingAmount(wallet))
    throw new Error("L’importo supera il saldo da pagare.");
  const items = [
    ...wallet.credits.map((c) => ({
      key: "credits" as const,
      id: c.id,
      when: c.purchasedAt,
      open: c.price - paidAmount(c),
    })),
    ...wallet.lessons.map((l) => ({
      key: "lessons" as const,
      id: l.id,
      when: l.startsAt,
      open: l.price - paidAmount(l),
    })),
  ]
    .filter((i) => i.open > 0)
    .toSorted(
      (a, b) => a.when.localeCompare(b.when) || a.id.localeCompare(b.id),
    );
  const shares = new Map<string, number>();
  let left = amount;
  for (const item of items) {
    if (!left) break;
    const share = Math.min(left, item.open);
    shares.set(`${item.key}:${item.id}`, share);
    left -= share;
  }
  const pay = <T extends LessonCredit | LessonCharge>(
    key: string,
    item: T,
  ): T => {
    const share = shares.get(`${key}:${item.id}`);
    return share
      ? {
          ...item,
          payments: [
            ...item.payments,
            { amount: share, date, ...(receiptId ? { receiptId } : {}) },
          ],
        }
      : item;
  };
  return {
    ...wallet,
    credits: wallet.credits.map((c) => pay("credits", c)),
    lessons: wallet.lessons.map((l) => pay("lessons", l)),
  };
}

export const maxPendingReceipts = 20;
/** A student declares a payment made outside the CRM. */
export function submitReceipt(
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
  const wallet = student.lessonWallet ?? emptyWallet;
  if (input.paidOn > today)
    throw new Error("La data del pagamento non può essere nel futuro.");
  if (input.method !== "contanti" && !file)
    throw new Error("Allega la ricevuta o lo screenshot del pagamento.");
  const outstanding = outstandingAmount(wallet);
  if (!outstanding) throw new Error("Non hai importi da saldare.");
  if (input.amount > outstanding)
    throw new Error(
      `L’importo supera quanto da saldare (${(outstanding / 100).toFixed(2).replace(".", ",")} €).`,
    );
  const receipts = wallet.receipts ?? [];
  if (
    receipts.filter((r) => r.status === "pending").length >= maxPendingReceipts
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
      s.id === studentId
        ? { ...s, lessonWallet: { ...wallet, receipts: [...receipts, entry] } }
        : s,
    ),
  };
}

/** Staff approve (once) or reject a declared payment. */
function reviewReceipt(
  state: CrmState,
  command: Extract<WalletCommand, { action: "review" }>,
  now: Date,
  reviewer?: string,
): CrmState {
  const student = state.students.find((s) => s.id === command.studentId);
  const wallet = student?.lessonWallet;
  const receipt = wallet?.receipts?.find((r) => r.id === command.receiptId);
  if (!student || !wallet || !receipt)
    throw new Error("Il pagamento non esiste più. Aggiorna la pagina.");
  if (receipt.status !== "pending")
    throw new Error("Questo pagamento è già stato verificato.");
  const reviewed: Receipt =
    command.decision === "approve"
      ? {
          ...receipt,
          status: "approved",
          approvedAmount: command.amount ?? receipt.amount,
          reviewedAt: now.toISOString(),
          ...(reviewer ? { reviewedBy: reviewer } : {}),
        }
      : {
          ...receipt,
          status: "rejected",
          reviewedAt: now.toISOString(),
          ...(reviewer ? { reviewedBy: reviewer } : {}),
          ...(command.reason ? { rejectionReason: command.reason } : {}),
        };
  const paid =
    command.decision === "approve"
      ? allocatePayment(
          wallet,
          reviewed.approvedAmount!,
          now.toISOString(),
          receipt.id,
        )
      : wallet;
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === student.id
        ? {
            ...s,
            lessonWallet: {
              ...paid,
              receipts: (wallet.receipts ?? []).map((r) =>
                r.id === receipt.id ? reviewed : r,
              ),
            },
          }
        : s,
    ),
  };
}
