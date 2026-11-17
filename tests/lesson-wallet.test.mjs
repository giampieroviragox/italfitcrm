import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWalletCommand,
  lessonPrice,
  lessonWallet,
  milanoPrivateCredit,
  paidAmount,
  remainingCredit,
} from "../src/modules/crm/lesson-wallet.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";

const end = new Date("2026-11-02T18:00:00Z");
const owner = { role: "owner", record_id: "owner" };
const state = () => ({
  version: 1,
  students: ["a", "b", "c"].map((id) => ({
    id,
    firstName: id,
    lastName: "Test",
    email: `${id}@example.com`,
    status: "active",
    tierId: "online",
    joinedAt: "2026-10-01",
    coach: "",
    tags: [],
    properties: {},
  })),
  tiers: [{ id: "online", name: "Online", description: "", archived: false }],
  properties: [],
  admins: [
    {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    },
  ],
  lessons: [
    {
      id: "l",
      title: "Forza",
      startsAt: "2026-11-02T17:00:00Z",
      durationMinutes: 60,
      capacity: 8,
      coach: "Coach",
      location: "Milano",
      cancelled: false,
    },
  ],
  bookings: ["a", "b", "c"].map((id) => ({
    id,
    studentId: id,
    lessonId: "l",
    createdAt: "2026-11-01T10:00:00Z",
    cancelled: false,
  })),
});
const command = ({
  attending = ["a", "b"],
  venue = "milano",
  creditId,
} = {}) => ({
  action: "settle",
  lessonId: "l",
  venue,
  roster: ["a", "b", "c"].map((id) => ({
    bookingId: id,
    present: attending.includes(id),
    ...(id === "a" && creditId ? { creditId } : {}),
  })),
});
const purchase = () =>
  applyWalletCommand(
    state(),
    {
      action: "credit",
      studentId: "a",
      credit: milanoPrivateCredit,
    },
    end,
  );

test("tariffe per sede e presenti, con prezzo manuale solo dove manca il listino", () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, n) => lessonPrice("milano", n + 1, 60)),
    [7000, 5000, 4000, 3500, 3000, 2500, 2500, 2500],
  );
  assert.deepEqual(
    Array.from({ length: 8 }, (_, n) => lessonPrice("monza", n + 1, 60)),
    [4000, 2500, 2000, 1500, 1500, 1500, 1500, undefined],
  );
  const input = state();
  input.lessons[0].durationMinutes = 45;
  assert.throws(() => applyWalletCommand(input, command(), end), /tariffa/);
  const priced = applyWalletCommand(
    input,
    { ...command(), manualPrice: 4200 },
    end,
  );
  assert.equal(priced.students[0].lessonWallet.lessons[0].price, 4200);
});

test("il consuntivo congela il prezzo sui presenti ed esclude assenti, duplicati e lezioni in corso", () => {
  const input = state();
  assert.throws(
    () => applyWalletCommand(input, command(), new Date(+end - 1)),
    /dopo la fine/,
  );
  assert.throws(
    () =>
      applyWalletCommand(
        input,
        { ...command(), roster: command().roster.slice(0, 2) },
        end,
      ),
    /iscritti sono cambiati/,
  );
  const result = applyWalletCommand(input, command(), end);
  assert.equal(result.lessons[0].settlement.participants, 2);
  assert.equal(result.students[0].lessonWallet.lessons[0].price, 5000);
  assert.equal(result.students[1].lessonWallet.lessons[0].participants, 2);
  assert.equal(result.students[2].lessonWallet, undefined);
  assert.throws(
    () => applyWalletCommand(result, command(), end),
    /non è disponibile/,
  );
});

test("le lezioni di gruppo si pagano a listino anche con un solo presente: niente pacchetti", () => {
  const input = purchase();
  const credit = input.students[0].lessonWallet.credits[0];
  assert.equal(credit.individual, true);
  assert.equal(credit.kind, "package");
  for (const attending of [["a", "b"], ["a"]])
    assert.throws(
      () =>
        applyWalletCommand(
          input,
          command({ creditId: credit.id, attending }),
          end,
        ),
      /pacchetti valgono solo per le lezioni individuali/,
    );
  // Un solo presente a Milano: tariffa di gruppo per una persona, 70 €.
  const { lessonWallet: wallet } = applyWalletCommand(
    input,
    command({ attending: ["a"] }),
    end,
  ).students[0];
  assert.equal(wallet.lessons[0].price, 7000);
  assert.equal(wallet.lessons[0].creditId, undefined);
  assert.equal(remainingCredit(wallet, credit), 660);
  assert.ok(lessonWallet.safeParse(wallet).success);
});

test("gli incassi parziali non sovrascrivono il prezzo e non possono superare il residuo", () => {
  const input = applyWalletCommand(state(), command(), end);
  const payment = {
    action: "payment",
    studentId: "a",
    category: "lesson",
    targetId: "l",
    amount: 3000,
  };
  const partial = applyWalletCommand(input, payment, end);
  assert.equal(paidAmount(partial.students[0].lessonWallet.lessons[0]), 3000);
  assert.throws(
    () => applyWalletCommand(partial, payment, end),
    /saldo residuo/,
  );
  const full = applyWalletCommand(partial, { ...payment, amount: 2000 }, end);
  assert.equal(paidAmount(full.students[0].lessonWallet.lessons[0]), 5000);
});

test("il wallet è privato e scrivere la scheda attraverso il CRM non lo modifica", () => {
  const saved = applyWalletCommand(purchase(), command(), end);
  const payload = structuredClone(saved);
  payload.students[0].lessonWallet = { credits: [], lessons: [] };
  payload.students[2].lessonWallet = saved.students[0].lessonWallet;
  const edited = validateStaffUpdate(saved, payload, owner);
  assert.deepEqual(
    edited.students[0].lessonWallet,
    saved.students[0].lessonWallet,
  );
  assert.equal(edited.students[2].lessonWallet, undefined);
  assert.deepEqual(
    studentProjection(saved, "a").lessonWallet,
    saved.students[0].lessonWallet,
  );
  assert.equal(studentProjection(saved, "c").lessonWallet, undefined);
  payload.lessons[0].durationMinutes = 90;
  assert.throws(() => validateStaffUpdate(saved, payload, owner), /già chiusa/);
});
