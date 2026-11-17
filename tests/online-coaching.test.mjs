import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCoachingCommand,
  assignmentCoachId,
  assignmentsInPeriod,
  coachingCommand,
  coachingPrices,
  currentSubscription,
  defaultEndDate,
  defaultPlanCoachId,
  subscriptionForMonth,
  subscriptionStatus,
} from "../src/modules/crm/online-coaching.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";
import { mutationState } from "../src/modules/crm/mutation.ts";
import { prepareTransition } from "../src/modules/crm/transition.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";

const now = new Date("2026-11-17T10:00:00Z");
const owner = { role: "owner", record_id: "owner" };
const state = () => ({
  version: 1,
  students: ["a", "b"].map((id) => ({
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
      name: "Giorgio Galbiati",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    },
    {
      id: "marta",
      name: "Marta",
      email: "marta@example.com",
      role: "admin",
      status: "active",
    },
  ],
});
const subscription = (overrides = {}) => ({
  durationMonths: 3,
  startsOn: "2026-11-17",
  endsOn: "2027-02-16",
  coachId: "marta",
  price: coachingPrices[3],
  ...overrides,
});
const create = (input = state(), overrides = {}) =>
  applyCoachingCommand(
    input,
    {
      action: "create",
      studentId: "a",
      subscription: subscription(overrides),
    },
    now,
  );

test("la scadenza predefinita copre i mesi acquistati fino al giorno prima", () => {
  assert.equal(defaultEndDate("2026-11-17", 3), "2027-02-16");
  assert.equal(defaultEndDate("2026-11-17", 6), "2027-05-16");
  assert.equal(defaultEndDate("2026-11-17", 12), "2027-11-16");
  assert.equal(defaultEndDate("2026-01-01", 12), "2026-12-31");
  // 30 novembre + 3 mesi: febbraio non ha il 30, si chiude il 27.
  assert.equal(defaultEndDate("2026-11-30", 3), "2027-02-27");
  assert.deepEqual(coachingPrices, { 3: 39000, 6: 69000, 12: 129000 });
});

test("lo stato dipende dal giorno a Roma e segnala la scadenza nelle ultime due settimane", () => {
  const s = subscription();
  assert.equal(subscriptionStatus(s, "2026-11-16"), "upcoming");
  assert.equal(subscriptionStatus(s, "2026-11-17"), "active");
  assert.equal(subscriptionStatus(s, "2027-02-02"), "active");
  assert.equal(subscriptionStatus(s, "2027-02-03"), "expiring");
  assert.equal(subscriptionStatus(s, "2027-02-16"), "expiring");
  assert.equal(subscriptionStatus(s, "2027-02-17"), "expired");
});

test("l’admin crea un abbonamento con date, coach e prezzo personalizzati", () => {
  const result = create(state(), {
    durationMonths: 12,
    startsOn: "2026-11-20",
    endsOn: "2027-12-31",
    price: 120000,
  });
  const [saved] = result.students[0].onlineSubscriptions;
  assert.equal(saved.durationMonths, 12);
  assert.equal(saved.startsOn, "2026-11-20");
  assert.equal(saved.endsOn, "2027-12-31");
  assert.equal(saved.coachId, "marta");
  assert.equal(saved.price, 120000);
  assert.equal(saved.createdAt, now.toISOString());
  assert.ok(isCrmState(result));
  assert.equal(result.students[1].onlineSubscriptions, undefined);
});

test("il server rifiuta date incoerenti, coach sconosciuti, sovrapposizioni e studenti archiviati", () => {
  assert.throws(
    () => create(state(), { endsOn: "2026-11-01" }),
    /successiva alla data di inizio/,
  );
  assert.throws(() => create(state(), { coachId: "ghost" }), /coach del team/);
  const first = create();
  assert.throws(
    () => create(first, { startsOn: "2027-02-16", endsOn: "2027-05-15" }),
    /si sovrappone/,
  );
  const renewal = create(first, {
    startsOn: "2027-02-17",
    endsOn: "2027-05-16",
  });
  assert.equal(renewal.students[0].onlineSubscriptions.length, 2);
  const archived = state();
  archived.students[0].archived = true;
  assert.throws(() => create(archived), /Ripristina/);
  assert.equal(
    coachingCommand.safeParse({
      action: "create",
      studentId: "a",
      subscription: subscription({ durationMonths: 4 }),
    }).success,
    false,
  );
});

test("modifica e rimozione agiscono solo sull’abbonamento scelto", () => {
  const first = create();
  const id = first.students[0].onlineSubscriptions[0].id;
  const updated = applyCoachingCommand(first, {
    action: "update",
    studentId: "a",
    subscriptionId: id,
    subscription: subscription({ coachId: "owner", endsOn: "2027-03-01" }),
  });
  const [s] = updated.students[0].onlineSubscriptions;
  assert.equal(s.id, id);
  assert.equal(s.coachId, "owner");
  assert.equal(s.endsOn, "2027-03-01");
  assert.throws(
    () =>
      applyCoachingCommand(first, {
        action: "remove",
        studentId: "a",
        subscriptionId: "missing",
      }),
    /non esiste più/,
  );
  const removed = applyCoachingCommand(first, {
    action: "remove",
    studentId: "a",
    subscriptionId: id,
  });
  assert.deepEqual(removed.students[0].onlineSubscriptions, []);
});

test("la cronologia registra creazione, modifica e rimozione", () => {
  const base = prepareTransition(state(), state());
  const created = prepareTransition(base, create(base));
  const history = created.students[0].history;
  assert.equal(history.at(-1).text, "Abbonamento Coaching online creato");
  assert.ok(history.at(-1).details.some((d) => d.includes("Coach: Marta")));
  const id = created.students[0].onlineSubscriptions[0].id;
  const updated = prepareTransition(
    created,
    applyCoachingCommand(created, {
      action: "update",
      studentId: "a",
      subscriptionId: id,
      subscription: subscription({ coachId: "owner" }),
    }),
  );
  assert.deepEqual(updated.students[0].history.at(-1).details, [
    "Coach: Marta → Giorgio Galbiati",
  ]);
  const removed = prepareTransition(
    updated,
    applyCoachingCommand(updated, {
      action: "remove",
      studentId: "a",
      subscriptionId: id,
    }),
  );
  assert.equal(
    removed.students[0].history.at(-1).text,
    "Abbonamento Coaching online rimosso",
  );
});

test("gli abbonamenti si modificano solo dall’API dedicata", () => {
  const saved = create();
  const payload = structuredClone(saved);
  payload.students[0].onlineSubscriptions = [];
  payload.students[1].onlineSubscriptions =
    saved.students[0].onlineSubscriptions;
  const edited = validateStaffUpdate(saved, payload, owner);
  assert.deepEqual(
    edited.students[0].onlineSubscriptions,
    saved.students[0].onlineSubscriptions,
  );
  assert.equal(edited.students[1].onlineSubscriptions, undefined);
  assert.equal(
    mutationState(saved, saved).students[0].onlineSubscriptions,
    undefined,
  );
});

test("lo studente vede l’abbonamento corrente senza prezzo né ID del coach", () => {
  const saved = create();
  const { coaching } = studentProjection(saved, "a");
  assert.equal(coaching.durationMonths, 3);
  assert.equal(coaching.coachName, "Marta");
  assert.equal(coaching.endsOn, "2027-02-16");
  assert.equal("price" in coaching, false);
  assert.equal("coachId" in coaching, false);
  assert.equal(studentProjection(saved, "b").coaching, undefined);
});

test("abbonamento corrente e piani assegnati nel periodo", () => {
  const list = [
    {
      ...subscription(),
      id: "old",
      startsOn: "2026-05-01",
      endsOn: "2026-07-31",
    },
    { ...subscription(), id: "now" },
    {
      ...subscription(),
      id: "next",
      startsOn: "2027-02-17",
      endsOn: "2027-05-16",
    },
  ];
  assert.equal(currentSubscription(list, "2026-12-01").id, "now");
  assert.equal(currentSubscription(list, "2026-09-01").id, "now");
  assert.equal(currentSubscription(list, "2027-06-01").id, "next");
  assert.equal(currentSubscription([], "2026-12-01"), undefined);
  const assignments = ["2026-10", "2026-11", "2026-12", "2027-03"].map(
    (month) => ({ id: month, studentId: "a", month }),
  );
  assert.deepEqual(
    assignmentsInPeriod(assignments, "a", subscription()).map((a) => a.month),
    ["2026-11", "2026-12"],
  );
});

const sessions = [
  {
    id: "session",
    name: "Sessione A",
    exercises: [
      {
        id: "exercise",
        name: "Squat",
        sets: 3,
        reps: "10",
        restSeconds: 60,
        notes: "",
      },
    ],
  },
];
const assignment = (month, extra = {}) => ({
  id: `plan-${month}`,
  studentId: "a",
  planId: "plan",
  month,
  createdAt: "2026-11-17T10:00:00Z",
  snapshot: { title: "Piano A", description: "", sessions },
  ...extra,
});
/** Student "a": 12 months with Marta from 17 Nov 2026, reference coach Giorgio. */
const withPlans = (assignments = []) => {
  const base = create(state(), {
    durationMonths: 12,
    endsOn: "2027-11-16",
  });
  base.tiers[0].entitlements = {
    plans: true,
    lessons: false,
    monthlyBookingLimit: null,
  };
  base.students[0].coach = "Giorgio Galbiati";
  base.plans = [
    {
      id: "plan",
      title: "Piano A",
      description: "",
      status: "published",
      sessions,
    },
  ];
  base.assignments = assignments;
  return prepareTransition(base, base);
};

test("il coach predefinito del piano è quello dell’abbonamento del mese, poi quello di riferimento", () => {
  const s = withPlans();
  const student = s.students[0];
  assert.equal(defaultPlanCoachId(s, student, "2026-12"), "marta");
  assert.equal(defaultPlanCoachId(s, student, "2026-11"), "marta");
  assert.equal(defaultPlanCoachId(s, student, "2028-01"), "owner");
  // Senza abbonamento né coach in scheda vale Giorgio, come nel resto del CRM.
  assert.equal(defaultPlanCoachId(s, s.students[1], "2026-12"), "owner");
  // Al cambio di abbonamento conta quello in corso a metà mese.
  const list = [
    subscription({ coachId: "owner" }),
    subscription({
      startsOn: "2027-02-17",
      endsOn: "2027-05-16",
      coachId: "marta",
    }),
  ].map((x, i) => ({ ...x, id: String(i), createdAt: now.toISOString() }));
  assert.equal(subscriptionForMonth(list, "2027-02").coachId, "owner");
  assert.equal(subscriptionForMonth(list, "2027-03").coachId, "marta");
});

test("ogni piano mensile può avere un coach diverso da quello dell’abbonamento", () => {
  const s = withPlans([
    assignment("2027-08"),
    assignment("2027-09", { coachId: "owner" }),
  ]);
  assert.equal(assignmentCoachId(s, s.assignments[0]), "marta");
  assert.equal(assignmentCoachId(s, s.assignments[1]), "owner");
  const { planCoaches } = studentProjection(s, "a");
  assert.equal(planCoaches["plan-2027-08"].name, "Marta");
  assert.equal(planCoaches["plan-2027-09"].name, "Giorgio Galbiati");
  assert.equal(
    planCoaches["plan-2027-09"].avatarUrl,
    "/coaches/giorgio-galbiati.jpg",
  );
});

test("il cambio di coach di un piano è validato e registrato in cronologia", () => {
  const s = withPlans([assignment("2027-08")]);
  const ghost = structuredClone(s);
  ghost.assignments[0].coachId = "ghost";
  assert.throws(() => prepareTransition(s, ghost), /non fa parte del team/);
  // Anche con il piano archiviato si può correggere il coach.
  const archived = structuredClone(s);
  archived.plans[0].status = "archived";
  const base = prepareTransition(s, archived);
  const moved = structuredClone(base);
  moved.assignments[0].coachId = "owner";
  const saved = prepareTransition(base, moved);
  const event = saved.students[0].history.at(-1);
  assert.equal(event.text, "Coach del piano aggiornato");
  assert.deepEqual(event.details, [
    "Piano: “Piano A” · mese 2027-08",
    "Coach: Marta → Giorgio Galbiati",
  ]);
  const content = structuredClone(saved);
  content.assignments[0].snapshot.title = "Piano B";
  assert.throws(() => prepareTransition(saved, content), /pubblicati/);
});
