import assert from "node:assert/strict";
import test from "node:test";
import { prepareWorkoutEntry } from "../src/modules/crm/workout-progress.ts";
import { isWorkoutEntries } from "../src/modules/crm/workout-entry-schema.ts";
import {
  applyMaxCommand,
  currentMaxes,
  lastLoggedSets,
  loggedSessions,
  maxCommand,
  setLabel,
} from "../src/modules/crm/workout-log.ts";
import { todayRome } from "../src/modules/crm/fitness-logic.ts";
import {
  parseStudentPortalData,
  studentProjection,
} from "../src/modules/crm/student-portal-model.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";

const exercise = (id, name, sets = 3, reps = "5") => ({
  id,
  name,
  sets,
  reps,
  restSeconds: 120,
  notes: "",
});
const sessions = [
  {
    id: "day-a",
    name: "Forza A",
    week: 1,
    kind: "strength",
    exercises: [exercise("squat", "Squat"), exercise("bench", "Panca piana")],
  },
  {
    id: "day-b",
    name: "Forza B",
    week: 2,
    kind: "strength",
    exercises: [exercise("squat-b", "squat", 5)],
  },
];
const assignment = {
  id: "a",
  studentId: "s",
  planId: "plan",
  month: "2026-11",
  createdAt: "2026-11-01T00:00:00.000Z",
  snapshot: { title: "Forza", description: "", sessions },
};
const student = (id) => ({
  id,
  firstName: "Test",
  lastName: id,
  email: `${id}@example.com`,
  tierId: "online",
  status: "active",
  joinedAt: "2026-11-01",
  coach: "",
  properties: {},
});
const state = () => ({
  version: 1,
  students: [student("s"), student("other")],
  admins: [
    {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    },
  ],
  properties: [],
  tiers: [
    {
      id: "online",
      name: "Online",
      description: "",
      archived: false,
      entitlements: { plans: true, lessons: false, monthlyBookingLimit: null },
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
const input = (extra = {}) => ({
  assignmentId: "a",
  assignmentCreatedAt: assignment.createdAt,
  sessionId: "day-a",
  completed: true,
  notes: "Gambe pesanti",
  ...extra,
});

test("il registro salva serie, carichi, data effettiva e fatica, scartando le serie vuote", () => {
  const saved = prepareWorkoutEntry(
    state(),
    "s",
    input({
      performedOn: "2026-11-10",
      rpe: 8,
      exercises: [
        {
          exerciseId: "squat",
          sets: [{ reps: 5, kg: 100 }, { reps: 5, kg: 102.456 }, {}],
        },
        { exerciseId: "bench", sets: [{}, {}] },
      ],
    }),
  );
  const [entry] = saved.students[0].workoutEntries;
  assert.equal(entry.performedOn, "2026-11-10");
  assert.equal(entry.rpe, 8);
  assert.deepEqual(entry.exercises, [
    {
      exerciseId: "squat",
      sets: [
        { reps: 5, kg: 100 },
        { reps: 5, kg: 102.46 },
      ],
    },
  ]);
  assert.ok(isWorkoutEntries(saved.students[0].workoutEntries));
  assert.ok(isCrmState(saved));
  // Senza data esplicita vale il giorno del salvataggio a Roma.
  const today = prepareWorkoutEntry(state(), "s", input());
  assert.equal(today.students[0].workoutEntries[0].performedOn, todayRome());
  assert.equal(today.students[0].workoutEntries[0].exercises, undefined);
});

test("il registro rifiuta esercizi estranei, date future e valori fuori scala", () => {
  const s = state();
  const fail = (extra, pattern) =>
    assert.throws(() => prepareWorkoutEntry(s, "s", input(extra)), pattern);
  fail(
    { exercises: [{ exerciseId: "squat-b", sets: [{ reps: 5 }] }] },
    /piano è cambiato/,
  );
  fail(
    {
      exercises: [
        { exerciseId: "squat", sets: [{ reps: 5 }] },
        { exerciseId: "squat", sets: [{ reps: 3 }] },
      ],
    },
    /una sola volta/,
  );
  fail({ performedOn: "2999-01-01" }, /futuro/);
  fail({ rpe: 11 }, /fatica/);
  fail(
    { exercises: [{ exerciseId: "squat", sets: [{ reps: 2.5 }] }] },
    /serie/,
  );
  fail({ exercises: [{ exerciseId: "squat", sets: [{ kg: 1001 }] }] }, /serie/);
  const tooMany = Array.from({ length: 31 }, () => ({ reps: 1 }));
  fail({ exercises: [{ exerciseId: "squat", sets: tooMany }] }, /serie/);
  const bad = prepareWorkoutEntry(s, "s", input()).students[0].workoutEntries;
  assert.equal(isWorkoutEntries([{ ...bad[0], rpe: 0 }]), false);
  assert.equal(
    isWorkoutEntries([
      { ...bad[0], exercises: [{ exerciseId: "x", sets: [{ reps: -1 }] }] },
    ]),
    false,
  );
});

test("storico ordinato per data effettiva e ultima volta per nome esercizio", () => {
  let s = prepareWorkoutEntry(
    state(),
    "s",
    input({
      performedOn: "2026-11-03",
      exercises: [{ exerciseId: "squat", sets: [{ reps: 5, kg: 90 }] }],
    }),
  );
  s = prepareWorkoutEntry(
    s,
    "s",
    input({
      sessionId: "day-b",
      performedOn: "2026-11-10",
      exercises: [{ exerciseId: "squat-b", sets: [{ reps: 5, kg: 95 }] }],
    }),
  );
  const history = loggedSessions(s.assignments, s.students[0].workoutEntries);
  assert.deepEqual(
    history.map((h) => [h.session.id, h.date]),
    [
      ["day-b", "2026-11-10"],
      ["day-a", "2026-11-03"],
    ],
  );
  // "squat" e "Squat" sono lo stesso esercizio.
  assert.deepEqual(lastLoggedSets(history, "Squat"), {
    date: "2026-11-10",
    sets: [{ reps: 5, kg: 95 }],
  });
  assert.equal(
    lastLoggedSets(history, "Squat", { assignmentId: "a", sessionId: "day-b" })
      .sets[0].kg,
    90,
  );
  assert.equal(lastLoggedSets(history, "Stacco"), undefined);
  assert.equal(setLabel({ reps: 5, kg: 102.5 }), "5 × 102,5 kg");
  assert.equal(setLabel({ reps: 12 }), "12 rip.");
});

test("lo studente registra e rimuove massimali; vale l’ultimo per ogni RM", () => {
  const add = (s, record) =>
    applyMaxCommand(
      s,
      "s",
      { action: "add", record },
      "2026-11-17",
      new Date("2026-11-17T10:00:00Z"),
    );
  let s = add(state(), {
    exercise: " Squat ",
    reps: 1,
    kg: 150,
    date: "2026-10-01",
  });
  s = add(s, { exercise: "squat", reps: 1, kg: 160, date: "2026-11-15" });
  s = add(s, { exercise: "Squat", reps: 5, kg: 130, date: "2026-11-01" });
  const [squat] = currentMaxes(s.students[0].maxes);
  assert.equal(squat.exercise, "squat");
  assert.equal(squat.latest[1].kg, 160);
  assert.equal(squat.latest[5].kg, 130);
  assert.equal(squat.latest[3], undefined);
  assert.equal(squat.history.length, 3);
  assert.equal(s.students[0].maxes[0].exercise, "Squat");
  assert.ok(isCrmState(s));
  assert.throws(
    () => add(s, { exercise: "Squat", reps: 1, kg: 170, date: "2026-11-18" }),
    /futuro/,
  );
  assert.equal(
    maxCommand.safeParse({
      action: "add",
      record: { exercise: "Squat", reps: 2, kg: 100, date: "2026-11-01" },
    }).success,
    false,
  );
  assert.equal(
    maxCommand.safeParse({
      action: "add",
      record: { exercise: "Squat", reps: 1, kg: 0, date: "2026-11-01" },
    }).success,
    false,
  );
  const removed = applyMaxCommand(
    s,
    "s",
    { action: "remove", id: s.students[0].maxes[0].id },
    "2026-11-17",
  );
  assert.equal(removed.students[0].maxes.length, 2);
  assert.throws(
    () =>
      applyMaxCommand(
        removed,
        "s",
        { action: "remove", id: "missing" },
        "2026-11-17",
      ),
    /non esiste più/,
  );
});

test("massimali privati: lo staff non li riscrive e solo lo studente li vede", () => {
  const s = applyMaxCommand(
    state(),
    "s",
    {
      action: "add",
      record: { exercise: "Panca", reps: 3, kg: 90, date: "2026-11-01" },
    },
    "2026-11-17",
  );
  const payload = structuredClone(s);
  payload.students[0].maxes = [];
  payload.students[1].maxes = s.students[0].maxes;
  const edited = validateStaffUpdate(s, payload, {
    role: "owner",
    record_id: "owner",
  });
  assert.deepEqual(edited.students[0].maxes, s.students[0].maxes);
  assert.equal(edited.students[1].maxes, undefined);
  const own = studentProjection(s, "s");
  assert.equal(own.maxes.length, 1);
  assert.equal(parseStudentPortalData(own), own);
  assert.deepEqual(studentProjection(s, "other").maxes, []);
});
