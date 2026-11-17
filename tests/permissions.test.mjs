import assert from "node:assert/strict";
import test from "node:test";
import {
  coachedStudentIds,
  memberPermissions,
  projectState,
  restrictUpdate,
  staffScope,
} from "../src/modules/crm/permissions.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";
import {
  applyCoachingCommand,
  coachingPrices,
} from "../src/modules/crm/online-coaching.ts";
import {
  compensations,
  lessonsMonth,
  onlineMonth,
  planRows,
  planValue,
} from "../src/modules/crm/accounting.ts";

const sessions = [
  {
    id: "s",
    name: "A",
    exercises: [
      {
        id: "e",
        name: "Squat",
        sets: 3,
        reps: "5",
        restSeconds: 60,
        notes: "",
      },
    ],
  },
];
const student = (id, extra = {}) => ({
  id,
  firstName: id,
  lastName: "Test",
  email: `${id}@example.com`,
  status: "active",
  tierId: "online",
  joinedAt: "2026-10-01",
  coach: "Giorgio Galbiati",
  properties: {},
  ...extra,
});
const sub = (id, coachId, extra = {}) => ({
  id,
  durationMonths: 3,
  startsOn: "2026-11-01",
  endsOn: "2027-01-31",
  coachId,
  price: coachingPrices[3],
  createdAt: "2026-11-01T10:00:00.000Z",
  ...extra,
});
const assignment = (id, studentId, extra = {}) => ({
  id,
  studentId,
  planId: "plan",
  month: "2026-11",
  createdAt: "2026-11-01T10:00:00.000Z",
  snapshot: { title: "Forza", description: "", sessions },
  ...extra,
});
const state = () => ({
  version: 1,
  tiers: [
    {
      id: "online",
      name: "Online",
      description: "",
      archived: false,
      entitlements: { plans: true, lessons: true, monthlyBookingLimit: null },
    },
  ],
  properties: [],
  admins: [
    {
      id: "giorgio",
      name: "Giorgio Galbiati",
      email: "g@example.com",
      role: "owner",
      status: "active",
    },
    {
      id: "annalisa",
      name: "Annalisa",
      email: "a@example.com",
      role: "admin",
      status: "active",
      teamRole: "admin",
    },
    {
      id: "marta",
      name: "Marta",
      email: "m@example.com",
      role: "admin",
      status: "active",
      teamRole: "coach",
      compensationPercent: 40,
    },
  ],
  students: [
    student("anna", {
      onlineSubscriptions: [
        sub("sa", "giorgio", {
          payments: [{ amount: 20000, date: "2026-11-05T10:00:00.000Z" }],
        }),
      ],
      lessonWallet: {
        credits: [],
        lessons: [
          {
            id: "manual-1",
            title: "1:1",
            startsAt: "2026-11-10T17:00:00.000Z",
            minutes: 60,
            price: 7000,
            venue: "milano",
            participants: 1,
            payments: [{ amount: 7000, date: "2026-11-10T19:00:00.000Z" }],
          },
          {
            id: "g1",
            title: "Gruppo",
            startsAt: "2026-11-12T18:00:00.000Z",
            minutes: 60,
            price: 2000,
            venue: "monza",
            participants: 3,
            payments: [],
          },
        ],
      },
    }),
    student("luca", {
      coach: "Marta",
      onlineSubscriptions: [
        sub("sl", "marta", {
          durationMonths: 6,
          endsOn: "2027-04-30",
          price: coachingPrices[6],
        }),
      ],
    }),
    student("sara"),
  ],
  plans: [
    {
      id: "plan",
      title: "Forza",
      description: "",
      status: "published",
      sessions,
    },
  ],
  assignments: [
    assignment("p-anna", "anna", { coachId: "marta" }),
    assignment("p-luca", "luca"),
    assignment("p-sara", "sara"),
  ],
});

test("ruoli: super admin tutto, admin e coach dai preset, permessi personalizzati", () => {
  const s = state();
  assert.equal(memberPermissions(s.admins[0]).size, 10);
  const admin = memberPermissions(s.admins[1]);
  assert.ok(
    admin.has("accounting.online") &&
      !admin.has("payments") &&
      !admin.has("accounting.lessons"),
  );
  assert.deepEqual([...memberPermissions(s.admins[2])], ["plans"]);
  // I membri salvati prima dei ruoli restano admin.
  assert.ok(
    memberPermissions({ ...s.admins[1], teamRole: undefined }).has(
      "students.all",
    ),
  );
  assert.deepEqual(
    [
      ...memberPermissions({
        ...s.admins[2],
        permissions: ["plans", "lessons"],
      }),
    ],
    ["plans", "lessons"],
  );
  assert.ok(isCrmState(s));
  const bad = structuredClone(s);
  bad.admins[2].permissions = ["boh"];
  assert.equal(isCrmState(bad), false);
});

test("il coach vede solo i propri studenti, senza wallet né incassi", () => {
  const s = state();
  // Luca: coach di riferimento e abbonamento; Anna: piano seguito da Marta.
  assert.deepEqual([...coachedStudentIds(s, "marta")].sort(), ["anna", "luca"]);
  const view = projectState(s, staffScope(s, "marta"));
  assert.deepEqual(
    view.students.map((x) => x.id),
    ["anna", "luca"],
  );
  assert.deepEqual(
    view.assignments.map((a) => a.id),
    ["p-anna", "p-luca"],
  );
  assert.equal(view.students[0].lessonWallet, undefined);
  assert.deepEqual(view.students[0].onlineSubscriptions[0].payments, []);
  assert.equal(view.students[0].onlineSubscriptions[0].price, 39000);
  assert.equal(
    view.admins.find((a) => a.id === "marta").compensationPercent,
    40,
  );
  // L'admin vede tutti ma non i pagamenti delle lezioni.
  const admin = projectState(s, staffScope(s, "annalisa"));
  assert.equal(admin.students.length, 3);
  assert.equal(admin.students[0].lessonWallet, undefined);
  assert.equal(admin.students[0].onlineSubscriptions[0].payments.length, 1);
  assert.equal(projectState(s, staffScope(s, "giorgio")), s);
});

test("le scritture del coach rimettono i dati nascosti e rifiutano quelle fuori ruolo", () => {
  const s = state();
  const scope = staffScope(s, "marta");
  const view = projectState(s, scope);
  // Assegnare un piano a un proprio studente è consentito e nulla va perso.
  const ok = structuredClone(view);
  ok.assignments.push(assignment("p-luca-dic", "luca", { month: "2026-12" }));
  const merged = restrictUpdate(s, ok, scope);
  assert.deepEqual(merged.students.map((x) => x.id).sort(), [
    "anna",
    "luca",
    "sara",
  ]);
  assert.ok(merged.assignments.some((a) => a.id === "p-sara"));
  assert.ok(merged.assignments.some((a) => a.id === "p-luca-dic"));
  const saved = validateStaffUpdate(s, merged, {
    role: "admin",
    record_id: "marta",
  });
  assert.ok(saved.students.find((x) => x.id === "anna").lessonWallet);
  for (const [change, pattern] of [
    [(v) => (v.students[1].firstName = "Altro"), /schede studente/],
    [
      (v) => v.assignments.push(assignment("x", "sara", { month: "2026-12" })),
      /non segui/,
    ],
    [(v) => v.students.push(student("sara")), /non segui/],
    [(v) => (v.tiers[0].name = "Nuovo"), /tier/],
  ]) {
    const bad = structuredClone(view);
    change(bad);
    assert.throws(() => restrictUpdate(s, bad, scope), pattern);
  }
  // Solo il super admin cambia ruoli, permessi e compensi.
  const promote = structuredClone(s);
  promote.admins[2].teamRole = "admin";
  assert.throws(
    () =>
      validateStaffUpdate(s, promote, { role: "admin", record_id: "annalisa" }),
    /Solo il proprietario/,
  );
  assert.equal(
    validateStaffUpdate(s, promote, { role: "owner", record_id: "giorgio" })
      .admins[2].teamRole,
    "admin",
  );
});

test("incassi degli abbonamenti online: parziali, mai oltre il prezzo, registrati in cronologia", () => {
  const s = state();
  const pay = (amount) =>
    applyCoachingCommand(
      s,
      { action: "payment", studentId: "anna", subscriptionId: "sa", amount },
      new Date("2026-11-20T10:00:00Z"),
      "Annalisa",
    );
  const paid = pay(19000).students[0].onlineSubscriptions[0].payments;
  assert.deepEqual(paid.at(-1), {
    amount: 19000,
    date: "2026-11-20T10:00:00.000Z",
    by: "Annalisa",
  });
  assert.throws(() => pay(19001), /resta da incassare/);
  assert.throws(
    () =>
      applyCoachingCommand(s, {
        action: "remove",
        studentId: "anna",
        subscriptionId: "sa",
      }),
    /incassi registrati/,
  );
});

test("contabilità: valore piani, compensi, online e lezioni del mese", () => {
  const s = state();
  assert.equal(planValue(s, s.assignments[0]), 13000);
  assert.equal(planValue(s, s.assignments[1]), 11500);
  assert.equal(planValue(s, s.assignments[2]), 0);
  const rows = planRows(s, "2026-11");
  assert.deepEqual(
    rows.map((r) => [r.studentId, r.coachId, r.value, r.compensation]),
    [
      ["anna", "marta", 13000, 5200],
      ["luca", "marta", 11500, 4600],
      ["sara", "giorgio", 0, 0],
    ],
  );
  const [marta] = compensations(s, "2026-11").filter(
    (c) => c.coachId === "marta",
  );
  assert.equal(marta.plans, 2);
  assert.equal(marta.compensation, 9800);
  const online = onlineMonth(s, "2026-11");
  assert.equal(online.activeSubscriptions, 2);
  assert.equal(online.sold, 39000 + 69000);
  assert.equal(online.collected, 20000);
  assert.equal(online.open, 19000 + 69000);
  const lessons = lessonsMonth(s, "2026-11");
  const milano = lessons.venues.find((v) => v.venue === "milano");
  const monza = lessons.venues.find((v) => v.venue === "monza");
  assert.equal(milano.individualLessons, 1);
  assert.equal(monza.groupLessons, 1);
  assert.equal(milano.accrued + monza.accrued, 9000);
  assert.equal(lessons.collected, 7000);
  assert.equal(lessons.open, 2000);
});
