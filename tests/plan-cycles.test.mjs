import assert from "node:assert/strict";
import test from "node:test";
import {
  assignmentPeriod,
  currentAssignment,
  currentGuidedVersion,
  cycleEnd,
  formatPeriod,
  nextCycleStart,
  runningAssignments,
  trackDue,
} from "../src/modules/crm/plan-cycles.ts";
import { planRows, planValue } from "../src/modules/crm/accounting.ts";
import { assignmentsInPeriod } from "../src/modules/crm/online-coaching.ts";

const cycle = (id, startsOn, extra = {}) => ({
  id,
  studentId: "anna",
  planId: "p",
  month: startsOn.slice(0, 7),
  startsOn,
  endsOn: cycleEnd(startsOn),
  createdAt: `${startsOn}T08:00:00.000Z`,
  snapshot: { title: id, description: "", sessions: [] },
  ...extra,
});

test("a cycle lasts four weeks; older plans fall back to program dates or their month", () => {
  assert.equal(cycleEnd("2026-11-02"), "2026-11-29");
  assert.equal(cycleEnd("2026-12-14"), "2027-01-10");
  assert.deepEqual(
    assignmentPeriod({ month: "2026-02", snapshot: { title: "" } }),
    { startsOn: "2026-02-01", endsOn: "2026-02-28" },
  );
  assert.deepEqual(
    assignmentPeriod({
      month: "2026-11",
      snapshot: {
        program: { startsOn: "2026-11-09", endsOn: "2026-12-06" },
      },
    }),
    { startsOn: "2026-11-09", endsOn: "2026-12-06" },
  );
  assert.equal(
    formatPeriod({ startsOn: "2026-11-02", endsOn: "2026-11-29" }),
    "2 nov – 29 nov 2026",
  );
  assert.equal(
    formatPeriod({ startsOn: "2026-12-14", endsOn: "2027-01-10" }),
    "14 dic 2026 – 10 gen 2027",
  );
});

test("the next cycle follows the last one, or keeps the rhythm after a gap", () => {
  const first = cycle("c1", "2026-11-02");
  assert.equal(nextCycleStart([first], "2026-11-20"), "2026-11-30");
  assert.equal(nextCycleStart([], "2026-11-20"), "2026-11-20");
  assert.equal(nextCycleStart([], "2026-11-20", "2026-12-01"), "2026-12-01");
  // Enrolled on 1 Oct, nothing assigned: the cycle running on 20 Nov started on 29 Oct.
  assert.equal(nextCycleStart([], "2026-11-20", "2026-10-01"), "2026-10-29");
  // Last cycle ended long ago: moves forward in whole cycles from its end.
  assert.equal(nextCycleStart([first], "2027-01-05"), "2026-12-28");
});

test("track status: running, to prepare in the last week, already planned", () => {
  const first = cycle("c1", "2026-11-02");
  assert.deepEqual(trackDue([first], "2026-11-10"), {
    state: "running",
    endsOn: "2026-11-29",
  });
  assert.deepEqual(trackDue([first], "2026-11-25"), {
    state: "due",
    dueOn: "2026-11-30",
    endsOn: "2026-11-29",
  });
  const second = cycle("c2", "2026-11-30");
  assert.deepEqual(trackDue([first, second], "2026-11-25"), {
    state: "planned",
    startsOn: "2026-11-30",
  });
  assert.deepEqual(trackDue([], "2026-11-25", "2026-11-20"), {
    state: "due",
    dueOn: "2026-11-20",
  });
});

test("two cycles in one month: the running one is current, guided ones come after personalized", () => {
  const a = cycle("a", "2026-11-02");
  const b = cycle("b", "2026-11-30");
  const guided = cycle("g", "2026-11-10", { guidedCategory: "hyrox" });
  assert.equal(currentAssignment([a, b, guided], "2026-11-15").id, "a");
  assert.equal(currentAssignment([a, b, guided], "2026-12-01").id, "b");
  assert.deepEqual(
    runningAssignments([guided, a], "2026-11-15").map((x) => x.id),
    ["a", "g"],
  );
  assert.equal(currentAssignment([b], "2026-11-01").id, "b", "next one");
});

test("the current guided version is the latest published one", () => {
  const plans = [
    {
      id: "old",
      guidedCategory: "hyrox",
      status: "published",
      publishedAt: "2026-10-01T10:00:00Z",
    },
    {
      id: "new",
      guidedCategory: "hyrox",
      status: "published",
      publishedAt: "2026-11-01T10:00:00Z",
    },
    {
      id: "draft",
      guidedCategory: "hyrox",
      status: "draft",
      publishedAt: "2026-12-01T10:00:00Z",
    },
    {
      id: "other",
      guidedCategory: "hybrid",
      status: "published",
      publishedAt: "2026-12-01T10:00:00Z",
    },
  ];
  assert.equal(currentGuidedVersion(plans, "hyrox").id, "new");
  assert.equal(currentGuidedVersion(plans, "home-edition"), undefined);
});

test("plan value splits the price over the included cycles; guided cycles are not credited", () => {
  const subscription = {
    id: "sub",
    startsOn: "2026-11-02",
    endsOn: "2027-02-01",
    price: 10000,
    durationMonths: 3,
    coachId: "giorgio",
    createdAt: "2026-11-01T00:00:00Z",
    payments: [],
  };
  const cycles = [
    cycle("c1", "2026-11-02"),
    cycle("c2", "2026-11-30"),
    cycle("c3", "2026-12-28"),
    cycle("c4", "2027-01-25"),
  ];
  const guided = cycle("g1", "2026-11-05", { guidedCategory: "hyrox" });
  const state = {
    version: 1,
    tiers: [],
    properties: [],
    admins: [{ id: "giorgio", name: "Giorgio", compensationPercent: 50 }],
    students: [
      {
        id: "anna",
        firstName: "Anna",
        lastName: "Test",
        onlineSubscriptions: [subscription],
      },
    ],
    assignments: [...cycles, guided],
  };
  // Two cycles start in November: both are counted, each with its own share.
  assert.deepEqual(
    cycles.map((c) => planValue(state, c)),
    [3334, 3333, 3333, 0],
  );
  assert.equal(planValue(state, guided), 0);
  assert.deepEqual(
    planRows(state, "2026-11").map((r) => [r.assignmentId, r.value]),
    [
      ["c1", 3334],
      ["c2", 3333],
    ],
  );
  assert.deepEqual(
    assignmentsInPeriod(state.assignments, "anna", subscription).map(
      (a) => a.id,
    ),
    ["c1", "c2", "c3", "c4"],
  );
});
