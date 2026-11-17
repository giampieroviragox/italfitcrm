import assert from "node:assert/strict";
import test from "node:test";
import { createAvailability } from "../src/modules/crm/availability.ts";
import { availabilityLessons } from "../src/modules/crm/availability-lessons.ts";
import {
  bookingWindowClosed,
  prepareStudentBooking,
} from "../src/modules/crm/student-booking.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
import {
  allocatePayment,
  applyWalletCommand,
  lessonWallet,
  milanoPrivateCredit,
  outstandingAmount,
  paidAmount,
  remainingCredit,
  submitReceipt,
} from "../src/modules/crm/lesson-wallet.ts";
import { prepareTransition } from "../src/modules/crm/transition.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";

const hour = 3_600_000;
const start = "2090-11-06T06:00:00.000Z";
const student = (id) => ({
  id,
  firstName: "TEST",
  lastName: id,
  email: `${id}@example.com`,
  tierId: "onsite",
  status: "active",
  coach: "",
  joinedAt: "2026-11-01",
  tags: [],
  properties: {},
});
const state = () => ({
  version: 1,
  students: [student("a"), student("b")],
  tiers: [
    {
      id: "onsite",
      name: "In sede",
      description: "",
      archived: false,
      entitlements: { plans: false, lessons: true, monthlyBookingLimit: null },
    },
  ],
  admins: [
    {
      id: "owner",
      name: "Giorgio",
      email: "owner@example.com",
      role: "owner",
      status: "active",
      availability: [createAvailability(start, "2090-11-06T07:00:00.000Z", 4)],
    },
  ],
  properties: [],
});

test("lo studente prenota e disdice solo fino a 12 ore prima", () => {
  const initial = state();
  const [lesson] = availabilityLessons(initial);
  const at = (hoursBefore) => Date.parse(start) - hoursBefore * hour;
  assert.equal(bookingWindowClosed(start, at(12.01)), false);
  assert.equal(bookingWindowClosed(start, at(12)), true);
  assert.throws(
    () => prepareStudentBooking(initial, "a", lesson.id, false, at(11)),
    /si chiudono 12 ore prima/,
  );
  const booked = prepareStudentBooking(initial, "a", lesson.id, false, at(13));
  assert.throws(
    () => prepareStudentBooking(booked, "a", lesson.id, true, at(6)),
    /disdire fino a 12 ore prima/,
  );
  const cancelled = prepareStudentBooking(booked, "a", lesson.id, true, at(24));
  assert.equal(cancelled.bookings[0].cancelled, true);
});

test("la proiezione indica quando prenotazione o disdetta sono chiuse", () => {
  const soon = new Date(Date.now() + 6 * hour);
  soon.setUTCSeconds(0, 0);
  soon.setUTCMinutes(0);
  const s = state();
  s.admins[0].availability = [
    createAvailability(
      soon.toISOString(),
      new Date(+soon + hour).toISOString(),
      4,
    ),
  ];
  const data = studentProjection(s, "a");
  assert.match(data.lessons[0].restriction, /12 ore prima/);
});

test("il team registra una lezione individuale già svolta a listino o scalata dal pacchetto", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  const record = (extra = {}) => ({
    action: "record",
    studentId: "a",
    lesson: {
      title: "Lezione individuale 1:1",
      startsAt: "2026-11-16T17:00:00.000Z",
      minutes: 60,
      venue: "milano",
      participants: 1,
    },
    ...extra,
  });
  let s = applyWalletCommand(state(), record(), now);
  let wallet = s.students[0].lessonWallet;
  assert.equal(wallet.lessons[0].price, 7000);
  assert.match(wallet.lessons[0].id, /^manual-/);
  s = applyWalletCommand(
    s,
    record({ lesson: { ...record().lesson, venue: "monza" } }),
    now,
  );
  assert.equal(s.students[0].lessonWallet.lessons[1].price, 4000);
  assert.throws(
    () =>
      applyWalletCommand(
        s,
        record({ lesson: { ...record().lesson, participants: 2 } }),
        now,
      ),
    /individuali/,
  );
  s = applyWalletCommand(s, record({ manualPrice: 6000 }), now);
  assert.equal(s.students[0].lessonWallet.lessons[2].price, 6000);
  assert.throws(
    () =>
      applyWalletCommand(
        state(),
        record({ lesson: { ...record().lesson, minutes: 45 } }),
        now,
      ),
    /inserisci il prezzo/,
  );
  assert.throws(
    () =>
      applyWalletCommand(
        state(),
        record({
          lesson: { ...record().lesson, startsAt: "2026-11-18T10:00:00.000Z" },
        }),
        now,
      ),
    /dopo averla svolta/,
  );
  // Con il pacchetto Milano la lezione costa 0 e scala un'ora.
  const pack = applyWalletCommand(
    state(),
    { action: "credit", studentId: "a", credit: milanoPrivateCredit },
    now,
  );
  const credit = pack.students[0].lessonWallet.credits[0];
  wallet = applyWalletCommand(pack, record({ creditId: credit.id }), now)
    .students[0].lessonWallet;
  assert.equal(wallet.lessons[0].price, 0);
  assert.equal(wallet.lessons[0].allocatedPrice, 6818);
  assert.equal(remainingCredit(wallet, credit), 600);
  assert.throws(
    () =>
      applyWalletCommand(
        pack,
        record({
          creditId: credit.id,
          lesson: { ...record().lesson, venue: "monza" },
        }),
        now,
      ),
    /non copre/,
  );
});

/** Student "a" owes a 750 € pack and a 70 € lesson. */
const owing = () => {
  const now = new Date("2026-11-10T12:00:00Z");
  let s = applyWalletCommand(
    state(),
    { action: "credit", studentId: "a", credit: milanoPrivateCredit },
    now,
  );
  s = applyWalletCommand(
    s,
    {
      action: "record",
      studentId: "a",
      lesson: {
        title: "1:1",
        startsAt: "2026-11-12T17:00:00.000Z",
        minutes: 60,
        venue: "milano",
        participants: 1,
      },
    },
    new Date("2026-11-13T12:00:00Z"),
  );
  return s;
};
const file = {
  path: "a/r1.jpg",
  name: "paypal.jpg",
  type: "image/jpeg",
  size: 12000,
};

test("lo studente dichiara un pagamento con ricevuta, entro il saldo da pagare", () => {
  const s = owing();
  assert.equal(outstandingAmount(s.students[0].lessonWallet), 82000);
  const input = {
    amount: 45000,
    method: "paypal",
    paidOn: "2026-11-16",
    note: "Prima tranche",
  };
  assert.throws(
    () => submitReceipt(s, "a", input, undefined, "2026-11-17"),
    /Allega la ricevuta/,
  );
  assert.throws(
    () =>
      submitReceipt(s, "a", { ...input, amount: 90000 }, file, "2026-11-17"),
    /supera quanto da saldare/,
  );
  assert.throws(
    () =>
      submitReceipt(
        s,
        "a",
        { ...input, paidOn: "2026-11-18" },
        file,
        "2026-11-17",
      ),
    /futuro/,
  );
  assert.throws(
    () => submitReceipt(s, "b", input, file, "2026-11-17"),
    /Non hai importi da saldare/,
  );
  const cash = submitReceipt(
    s,
    "a",
    { ...input, method: "contanti" },
    undefined,
    "2026-11-17",
  );
  assert.equal(cash.students[0].lessonWallet.receipts[0].status, "pending");
  const sent = submitReceipt(
    s,
    "a",
    input,
    file,
    "2026-11-17",
    new Date(),
    "r1",
  );
  const [receipt] = sent.students[0].lessonWallet.receipts;
  assert.equal(receipt.id, "r1");
  assert.equal(receipt.file.path, "a/r1.jpg");
  // Finché non è approvato il saldo non cambia.
  assert.equal(outstandingAmount(sent.students[0].lessonWallet), 82000);
  assert.ok(isCrmState(sent));
});

test("l’approvazione salda le voci più vecchie una sola volta; il rifiuto non tocca il saldo", () => {
  const sent = submitReceipt(
    owing(),
    "a",
    { amount: 80000, method: "bonifico", paidOn: "2026-11-16", note: "" },
    file,
    "2026-11-17",
    new Date(),
    "r1",
  );
  const review = (decision, extra = {}) => ({
    action: "review",
    studentId: "a",
    receiptId: "r1",
    decision,
    ...extra,
  });
  const approved = prepareTransition(
    sent,
    applyWalletCommand(
      sent,
      review("approve"),
      new Date("2026-11-17T09:00:00Z"),
      "Giorgio",
    ),
  );
  const wallet = approved.students[0].lessonWallet;
  // 750 € al pacchetto (più vecchio), 50 € alla lezione.
  assert.equal(paidAmount(wallet.credits[0]), 75000);
  assert.equal(paidAmount(wallet.lessons[0]), 5000);
  assert.equal(wallet.lessons[0].payments[0].receiptId, "r1");
  assert.equal(outstandingAmount(wallet), 2000);
  assert.equal(wallet.receipts[0].status, "approved");
  assert.equal(wallet.receipts[0].reviewedBy, "Giorgio");
  assert.ok(lessonWallet.safeParse(wallet).success);
  assert.equal(approved.students[0].history.at(-1).text, "Pagamento approvato");
  assert.throws(
    () => applyWalletCommand(approved, review("approve")),
    /già stato verificato/,
  );
  // L’admin può approvare un importo diverso da quello dichiarato.
  const partial = applyWalletCommand(
    sent,
    review("approve", { amount: 30000 }),
  );
  assert.equal(outstandingAmount(partial.students[0].lessonWallet), 52000);
  assert.throws(
    () => applyWalletCommand(sent, review("approve", { amount: 90000 })),
    /supera il saldo/,
  );
  const rejected = applyWalletCommand(
    sent,
    review("reject", { reason: "Importo non leggibile" }),
  );
  const r = rejected.students[0].lessonWallet.receipts[0];
  assert.equal(r.status, "rejected");
  assert.equal(r.rejectionReason, "Importo non leggibile");
  assert.equal(outstandingAmount(rejected.students[0].lessonWallet), 82000);
});

test("la ripartizione FIFO non supera mai il dovuto di ogni voce", () => {
  const wallet = owing().students[0].lessonWallet;
  const paid = allocatePayment(wallet, 82000, "2026-11-17T10:00:00Z");
  assert.equal(outstandingAmount(paid), 0);
  assert.throws(
    () => allocatePayment(paid, 1, "2026-11-17T10:00:00Z"),
    /supera/,
  );
});

test("storico, filtri, saldi ed esportazione CSV dei pagamenti", async () => {
  const {
    balances,
    balancesCsv,
    collectedTotal,
    filterPayments,
    paymentHistory,
    paymentMonths,
    paymentsCsv,
  } = await import("../src/modules/crm/payment-history.ts");
  let s = owing();
  // Incasso registrato dal team sul pacchetto.
  s = applyWalletCommand(
    s,
    {
      action: "payment",
      studentId: "a",
      category: "credit",
      targetId: s.students[0].lessonWallet.credits[0].id,
      amount: 30000,
    },
    new Date("2026-10-20T10:00:00Z"),
  );
  for (const [id, amount] of [
    ["ok", 10000],
    ["no", 5000],
  ])
    s = submitReceipt(
      s,
      "a",
      { amount, method: "paypal", paidOn: "2026-11-16", note: "" },
      file,
      "2026-11-17",
      new Date("2026-11-16T10:00:00Z"),
      id,
    );
  s = applyWalletCommand(
    s,
    { action: "review", studentId: "a", receiptId: "ok", decision: "approve" },
    new Date("2026-11-17T10:00:00Z"),
  );
  s = applyWalletCommand(
    s,
    {
      action: "review",
      studentId: "a",
      receiptId: "no",
      decision: "reject",
      reason: "Illeggibile",
    },
    new Date("2026-11-17T11:00:00Z"),
  );
  const rows = paymentHistory(s.students);
  assert.deepEqual(
    rows.map((r) => r.kind),
    ["rejected", "approved", "registered"],
  );
  assert.equal(rows[0].details[0], "Motivo: Illeggibile");
  assert.match(rows[1].details[0], /Milano 1:1.*100,00/);
  assert.equal(collectedTotal(rows), 40000);
  assert.equal(filterPayments(rows, { kind: "approved" }).length, 1);
  assert.equal(filterPayments(rows, { method: "paypal" }).length, 2);
  assert.equal(filterPayments(rows, { month: "2026-10" }).length, 1);
  assert.equal(filterPayments(rows, { studentId: "b" }).length, 0);
  assert.deepEqual(paymentMonths(rows), ["2026-11", "2026-10"]);
  const [balance] = balances(s.students);
  assert.equal(balance.total, 82000);
  assert.equal(balance.paid, 40000);
  assert.equal(balance.open, 42000);
  const csv = paymentsCsv(rows);
  assert.ok(csv.startsWith('﻿"Data"'));
  assert.match(csv, /"Ricevuta rifiutata","PayPal","2026-11-16","50,00"/);
  assert.match(
    balancesCsv([balance]),
    /"TEST a","820,00","400,00","420,00","0,00"/,
  );
});
