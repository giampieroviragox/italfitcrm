import test from "node:test";
import assert from "node:assert/strict";
import { prepareWorkoutEntry } from "../src/modules/crm/workout-progress.ts";
import { isWorkoutEntries } from "../src/modules/crm/workout-entry-schema.ts";
import {
  studentProjection,
  parseStudentPortalData,
} from "../src/modules/crm/student-portal-model.ts";
import {
  assertFitnessTransition,
  isFitnessData,
} from "../src/modules/crm/fitness-logic.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
const ex = {
  id: "exercise",
  name: "Corsa",
  sets: 1,
  reps: "30 min · 6:00/km",
  restSeconds: 0,
  notes: "",
};
const session = {
  id: "session",
  name: "Facile",
  week: 1,
  day: "Martedì",
  kind: "run",
  preparation: "Riscaldamento",
  cooldown: "Defaticamento",
  guidance: "Piano",
  exercises: [ex],
};
const plan = {
  id: "plan",
  title: "Blocco",
  description: "",
  status: "published",
  program: {
    goal: "Base",
    startsOn: "2026-08-31",
    endsOn: "2026-09-28",
    guidance: "",
    paceZones: [{ name: "Z2", pace: "6:00/km" }],
  },
  sessions: Array.from({ length: 16 }, (_, i) => ({
    ...session,
    id: "session" + i,
    week: Math.floor(i / 4) + 1,
  })),
};
const assignment = {
  id: "a",
  studentId: "s",
  planId: "plan",
  month: "2026-11",
  createdAt: "2026-11-01T00:00:00.000Z",
  snapshot: {
    title: plan.title,
    description: "",
    program: plan.program,
    sessions: plan.sessions,
  },
};
const student = (id) => ({
  id,
  firstName: "Test",
  lastName: id,
  email: id + "@example.com",
  tierId: "online",
  status: "active",
  joinedAt: "2026-11-01",
  coach: "",
  properties: {},
  revision: 0,
  notes: [],
  history: [],
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
  plans: [structuredClone(plan)],
  assignments: [structuredClone(assignment)],
});
const input = {
  assignmentId: "a",
  assignmentCreatedAt: assignment.createdAt,
  sessionId: "session0",
  completed: true,
  notes: "  30 min, RPE 5  ",
};
test("multiweek plans preserve running prescriptions, dates and snapshot metadata", () => {
  const s = state();
  assert.doesNotThrow(() => assertFitnessTransition(s, s));
  assert.equal(isFitnessData(s), true);
  const d = studentProjection(s, "s");
  assert.equal(d.assignments[0].snapshot.program.startsOn, "2026-08-31");
  assert.equal(d.assignments[0].snapshot.sessions.length, 16);
  assert.equal(parseStudentPortalData(d), d);
  for (const week of [0, 53, 1.5, "1"]) {
    const bad = state();
    bad.plans[0].sessions[0].week = week;
    assert.equal(isFitnessData(bad), false);
    assert.throws(() => assertFitnessTransition(s, bad), /Sessioni/);
  }
  const bad = state();
  bad.plans[0].program.endsOn = "2026-02-30";
  assert.equal(isFitnessData(bad), false);
  assert.throws(() => assertFitnessTransition(s, bad), /programma/);
});
test("workout completion and notes persist once per session and support repeating", () => {
  const s = state();
  const saved = prepareWorkoutEntry(s, "s", input);
  assert.equal(s.students[0].workoutEntries, undefined);
  assert.deepEqual(saved.students[1], s.students[1]);
  assert.equal(saved.students[0].workoutEntries.length, 1);
  assert.equal(saved.students[0].workoutEntries[0].notes, "30 min, RPE 5");
  const again = prepareWorkoutEntry(saved, "s", {
    ...input,
    completed: false,
    notes: "Riprovo",
  });
  assert.equal(again.students[0].workoutEntries.length, 1);
  assert.equal(again.students[0].workoutEntries[0].completed, false);
  assert.equal(studentProjection(again, "other").workoutEntries.length, 0);
});
test("students cannot write another assignment, a stale snapshot, or sessions outside their plan", () => {
  const s = state();
  assert.throws(
    () => prepareWorkoutEntry(s, "other", input),
    /piano è cambiato/,
  );
  for (const patch of [
    { assignmentId: "other" },
    { assignmentCreatedAt: "2026-10-01T00:00:00Z" },
    { sessionId: "unknown" },
    { notes: "x".repeat(5001) },
    { completed: "true" },
  ])
    assert.throws(() => prepareWorkoutEntry(s, "s", { ...input, ...patch }));
  for (const patch of [
    { archived: true },
    { accessDisabled: true },
    { tierId: "no-plans" },
  ]) {
    const n = state();
    n.students[0] = { ...n.students[0], ...patch };
    assert.throws(() => prepareWorkoutEntry(n, "s", input), /accesso/);
  }
});
test("staff edits cannot forge or erase student workout notes and completion", () => {
  const saved = prepareWorkoutEntry(state(), "s", input),
    proposed = structuredClone(saved);
  proposed.students[0].workoutEntries = [];
  proposed.students[0].coach = "Coach";
  const next = validateStaffUpdate(saved, proposed, {
    role: "owner",
    record_id: "owner",
  });
  assert.deepEqual(
    next.students[0].workoutEntries,
    saved.students[0].workoutEntries,
  );
  assert.equal(next.students[0].coach, "Coach");
});
test("malformed, duplicate and excessive workout logs fail validation", () => {
  const valid = prepareWorkoutEntry(state(), "s", input).students[0]
    .workoutEntries;
  assert.equal(isWorkoutEntries(valid), true);
  assert.equal(isWorkoutEntries([...valid, ...valid]), false);
  for (const patch of [
    { updatedAt: "never" },
    { notes: null },
    { completed: 1 },
    { assignmentCreatedAt: "never" },
  ])
    assert.equal(isWorkoutEntries([{ ...valid[0], ...patch }]), false);
  const d = studentProjection(state(), "s");
  d.workoutEntries = [{ ...valid[0], notes: null }];
  assert.throws(() => parseStudentPortalData(d), /non validi/);
});
