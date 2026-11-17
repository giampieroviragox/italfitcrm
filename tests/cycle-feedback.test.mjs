import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFeedback,
  applyRaceCommand,
  feedbackCommand,
  feedbackIsOpen,
  pendingFeedback,
  plannedSessionsPerWeek,
  planEndDate,
  racesSoon,
  upcomingRaces,
} from "../src/modules/crm/cycle-feedback.ts";
import { prepareTransition } from "../src/modules/crm/transition.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";
import {
  parseStudentPortalData,
  studentProjection,
} from "../src/modules/crm/student-portal-model.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
import { mcpStudentPlan } from "../src/modules/crm/mcp-plans.ts";

const session = (id, week) => ({
  id,
  name: `Sessione ${id}`,
  week,
  kind: "strength",
  exercises: [
    {
      id: `${id}-x`,
      name: "Squat",
      sets: 3,
      reps: "5",
      restSeconds: 60,
      notes: "",
    },
  ],
});
// Tre sessioni a settimana per quattro settimane.
const sessions = [1, 2, 3, 4].flatMap((w) =>
  ["a", "b", "c"].map((d) => session(`${w}${d}`, w)),
);
const assignment = {
  id: "nov",
  studentId: "s",
  planId: "plan",
  month: "2026-11",
  createdAt: "2026-11-01T00:00:00.000Z",
  snapshot: { title: "Forza", description: "", sessions },
};
const state = () => ({
  version: 1,
  students: [
    {
      id: "s",
      firstName: "Giampiero",
      lastName: "Test",
      email: "s@example.com",
      tierId: "online",
      status: "active",
      joinedAt: "2026-10-01",
      coach: "",
      properties: {},
    },
  ],
  tiers: [
    {
      id: "online",
      name: "Online",
      description: "",
      archived: false,
      entitlements: { plans: true, lessons: false, monthlyBookingLimit: null },
    },
  ],
  properties: [],
  admins: [
    {
      id: "owner",
      name: "Giorgio",
      email: "g@example.com",
      role: "owner",
      status: "active",
    },
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
  assignments: [structuredClone(assignment)],
});
const answers = (extra = {}) => ({
  assignmentId: "nov",
  assignmentCreatedAt: assignment.createdAt,
  rating: 4,
  sessionLength: "long",
  sessionsPerWeek: 2,
  changes: "Meno corsa il lunedì",
  notes: "Dicembre pieno di trasferte",
  removeRaces: [],
  addRaces: [],
  ...extra,
});

test("il questionario si apre nell’ultima settimana del piano o a sessioni completate", () => {
  assert.equal(planEndDate(assignment), "2026-11-30");
  assert.equal(plannedSessionsPerWeek(assignment), 3);
  assert.equal(feedbackIsOpen(assignment, [], "2026-11-23"), false);
  assert.equal(feedbackIsOpen(assignment, [], "2026-11-24"), true);
  assert.equal(feedbackIsOpen(assignment, [], "2027-01-14"), true);
  assert.equal(feedbackIsOpen(assignment, [], "2027-01-15"), false);
  const done = sessions.map((s) => ({
    assignmentId: "nov",
    assignmentCreatedAt: assignment.createdAt,
    sessionId: s.id,
    completed: true,
    notes: "",
    updatedAt: "2026-11-20T10:00:00Z",
  }));
  assert.equal(feedbackIsOpen(assignment, done, "2026-11-20"), true);
  const withProgram = structuredClone(assignment);
  withProgram.snapshot.program = {
    goal: "",
    startsOn: "2026-11-02",
    endsOn: "2026-11-29",
    guidance: "",
    paceZones: [],
  };
  assert.equal(planEndDate(withProgram), "2026-11-29");
});

test("lo studente invia il questionario con nuove gare e toglie quelle a cui non partecipa più", () => {
  let s = applyRaceCommand(
    state(),
    "s",
    {
      action: "add",
      race: { name: "Mezza di Verona", date: "2026-12-14", location: "Verona" },
    },
    "2026-11-25",
  );
  const verona = s.students[0].races[0];
  assert.equal(
    pendingFeedback(s.students[0], s.assignments, [], "2026-11-25").id,
    "nov",
  );
  s = prepareTransition(
    s,
    applyFeedback(
      s,
      "s",
      answers({
        removeRaces: [verona.id],
        addRaces: [
          {
            name: "HYROX Milano · Doppio misto",
            date: "2026-12-06",
            location: "Fiera Milano, Rho",
          },
        ],
      }),
      "2026-11-25",
      new Date("2026-11-25T18:00:00Z"),
    ),
  );
  const student = s.students[0];
  assert.equal(student.cycleFeedback.length, 1);
  assert.equal(student.cycleFeedback[0].sessionsPerWeek, 2);
  assert.deepEqual(
    student.races.map((r) => r.name),
    ["HYROX Milano · Doppio misto"],
  );
  assert.equal(
    pendingFeedback(student, s.assignments, [], "2026-11-25"),
    undefined,
  );
  assert.ok(isCrmState(s));
  assert.equal(
    student.history.at(-3).text,
    "Questionario di fine piano compilato",
  );
  assert.ok(student.history.some((h) => h.text === "Gara rimossa"));
  // Lo stesso piano si può aggiornare, senza duplicati.
  const again = applyFeedback(s, "s", answers({ rating: 5 }), "2026-11-26");
  assert.equal(again.students[0].cycleFeedback.length, 1);
  assert.equal(again.students[0].cycleFeedback[0].rating, 5);
});

test("il questionario rifiuta piani chiusi, gare passate, risposte non valide", () => {
  const s = state();
  assert.throws(
    () => applyFeedback(s, "s", answers(), "2026-11-10"),
    /ultima settimana/,
  );
  assert.throws(
    () =>
      applyFeedback(
        s,
        "s",
        answers({
          addRaces: [{ name: "Vecchia", date: "2026-11-01", location: "" }],
        }),
        "2026-11-25",
      ),
    /data futura/,
  );
  assert.throws(
    () =>
      applyFeedback(s, "s", answers({ removeRaces: ["ghost"] }), "2026-11-25"),
    /elenco gare/,
  );
  assert.throws(
    () =>
      applyFeedback(
        s,
        "s",
        answers({ assignmentCreatedAt: "2026-11-02T00:00:00.000Z" }),
        "2026-11-25",
      ),
    /piano è cambiato/,
  );
  for (const bad of [
    { rating: 6 },
    { sessionLength: "boh" },
    { sessionsPerWeek: 0 },
  ])
    assert.equal(feedbackCommand.safeParse(answers(bad)).success, false);
});

test("il coach gestisce le gare, vede quelle imminenti e Claude riceve feedback e registro", () => {
  let s = applyRaceCommand(
    state(),
    "s",
    {
      action: "add",
      race: {
        name: "Maratona di Firenze",
        date: "2026-11-29",
        location: "Firenze",
      },
    },
    "2026-11-20",
    new Date(),
    "Giorgio",
  );
  assert.equal(s.students[0].races[0].addedBy, "Giorgio");
  assert.deepEqual(
    racesSoon(s, "2026-11-20").map((r) => r.race.name),
    ["Maratona di Firenze"],
  );
  assert.deepEqual(racesSoon(s, "2026-11-01"), []);
  const id = s.students[0].races[0].id;
  s = applyRaceCommand(
    s,
    "s",
    {
      action: "update",
      id,
      race: {
        name: "Maratona di Firenze",
        date: "2026-11-30",
        location: "Firenze",
      },
    },
    "2026-11-20",
  );
  assert.equal(s.students[0].races[0].addedBy, "Giorgio");
  assert.equal(
    upcomingRaces(s.students[0].races, "2026-11-20")[0].date,
    "2026-11-30",
  );
  s = applyFeedback(s, "s", answers(), "2026-11-25");
  s.students[0].workoutEntries = [
    {
      assignmentId: "nov",
      assignmentCreatedAt: assignment.createdAt,
      sessionId: "1a",
      completed: true,
      notes: "Ginocchio un po’ dolorante",
      updatedAt: "2026-11-03T18:00:00Z",
      performedOn: "2026-11-03",
      rpe: 7,
      exercises: [{ exerciseId: "1a-x", sets: [{ reps: 5, kg: 100 }] }],
    },
  ];
  const plan = mcpStudentPlan(s, "s");
  assert.equal(plan.feedbackFinePiano.durataSessioni, "Troppo lunga");
  assert.equal(plan.feedbackFinePiano.sessioniSettimanaProssimoPiano, 2);
  assert.deepEqual(plan.registroAllenamenti[0].esercizi, [
    { esercizio: "Squat", serie: ["5 × 100 kg"] },
  ]);
  assert.equal(plan.registroAllenamenti[0].fatica, 7);
});

test("questionari e gare si modificano solo dagli endpoint dedicati", () => {
  const s = applyFeedback(state(), "s", answers(), "2026-11-25");
  const payload = structuredClone(s);
  payload.students[0].cycleFeedback = [];
  payload.students[0].races = [
    {
      id: "x",
      name: "Finta",
      date: "2026-12-01",
      location: "",
      createdAt: "2026-11-01T00:00:00Z",
    },
  ];
  const edited = validateStaffUpdate(s, payload, {
    role: "owner",
    record_id: "owner",
  });
  assert.deepEqual(
    edited.students[0].cycleFeedback,
    s.students[0].cycleFeedback,
  );
  assert.deepEqual(edited.students[0].races, s.students[0].races);
  const own = studentProjection(s, "s");
  assert.equal(own.cycleFeedback.length, 1);
  assert.equal(parseStudentPortalData(own), own);
});
