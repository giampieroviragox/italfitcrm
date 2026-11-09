import test from "node:test";
import assert from "node:assert/strict";
import { prepareWorkoutEntry } from "../src/modules/crm/workout-progress.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
import { isRemovalTarget, removalState } from "../src/modules/crm/removal.ts";
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
const access = {
  user_id: "owner",
  role: "owner",
  record_id: "owner",
  active: true,
  accepted_at: "2026-11-01T00:00:00.000Z",
};
const withLog = () =>
  prepareWorkoutEntry(state(), "s", {
    assignmentId: "a",
    assignmentCreatedAt: assignment.createdAt,
    sessionId: "session0",
    completed: true,
    notes: "fatto",
  });

test("removing an assignment hides it from the student and drops its logs", () => {
  const current = withLog();
  const removal = removalState(current, { assignmentId: "a" });
  assert.deepEqual([removal.assignments, removal.plans], [["a"], []]);
  assert.throws(
    () => validateStaffUpdate(current, removal.state, access),
    /Archivia/,
    "plain staff saves still cannot drop records",
  );
  const next = validateStaffUpdate(current, removal.state, access, {
    assignments: removal.assignments,
  });
  assert.equal(next.assignments.length, 0);
  assert.equal(next.plans.length, 1, "the template stays");
  const s = next.students.find((x) => x.id === "s");
  assert.deepEqual(s.workoutEntries, []);
  assert.ok(
    s.history.some((h) => h.text === "Assegnazione piano rimossa dalla scheda"),
  );
  assert.deepEqual(studentProjection(next, "s").assignments, []);
  assert.throws(() => removalState(next, { assignmentId: "a" }), /non trovata/);
});

test("only never-assigned plans can be deleted", () => {
  const current = withLog();
  assert.throws(() => removalState(current, { planId: "plan" }), /assegnato/);
  const free = { ...current, assignments: [] };
  const removal = removalState(free, { planId: "plan" });
  assert.deepEqual(removal.plans, ["plan"]);
  assert.equal(removal.state.plans.length, 0);
  const next = validateStaffUpdate(free, removal.state, access, {
    plans: removal.plans,
  });
  assert.equal(next.plans.length, 0);
});

test("removal targets are strict", () => {
  assert.ok(isRemovalTarget({ assignmentId: "a" }));
  assert.ok(isRemovalTarget({ planId: "p" }));
  for (const bad of [
    {},
    { assignmentId: "" },
    { assignmentId: "a", planId: "p" },
    { planId: 1 },
    null,
    "a",
  ])
    assert.equal(isRemovalTarget(bad), false, JSON.stringify(bad));
});
