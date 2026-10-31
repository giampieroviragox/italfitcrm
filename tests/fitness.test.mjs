import test from "node:test";
import assert from "node:assert/strict";
import {
  assertFitnessTransition,
  reconcileFitness,
  romeToIso,
  romeLocal,
  overlaps,
  weekStart,
  addDays,
  isFitnessData,
} from "../src/modules/crm/fitness-logic.ts";
import { csvCell, studentsCsv } from "../src/modules/crm/csv.ts";
const now = Date.parse("2026-10-31T12:00:00Z");
const student = (id) => ({
  id,
  firstName: "Giulia",
  lastName: id,
  email: `${id}@example.com`,
  status: "active",
  tierId: "online",
  joinedAt: "2026-10-01",
  coach: "",
  tags: [],
  properties: {},
});
const plan = () => ({
  id: "p",
  title: "Forza",
  description: "",
  status: "published",
  sessions: [
    {
      id: "s",
      name: "Sessione A",
      exercises: [
        {
          id: "e",
          name: "Squat",
          sets: 3,
          reps: "8–10",
          restSeconds: 90,
          notes: "",
        },
      ],
    },
  ],
});
const lesson = (id, patch = {}) => ({
  id,
  title: "Forza",
  startsAt: "2026-11-02T17:00:00Z",
  durationMinutes: 60,
  capacity: 1,
  coach: `Coach ${id}`,
  location: `Sala ${id}`,
  cancelled: false,
  ...patch,
});
const booking = (id, studentId = "a", lessonId = "l") => ({
  id,
  studentId,
  lessonId,
  createdAt: new Date(now).toISOString(),
  cancelled: false,
});
const state = () => ({
  version: 1,
  students: [student("a"), student("b")],
  tiers: [{ id: "online", name: "Online", description: "", archived: false }],
  properties: [],
  admins: [
    {
      id: "admin",
      name: "Admin",
      email: "a@example.com",
      role: "owner",
      status: "active",
    },
  ],
});
const check = (old, next) => assertFitnessTransition(old, next, now);
test("Rome time conversion respects winter, summer and rejects DST gaps/ambiguities", () => {
  assert.equal(romeToIso("2026-11-02T18:00"), "2026-11-02T17:00:00.000Z");
  assert.equal(romeToIso("2026-07-02T18:00"), "2026-07-02T16:00:00.000Z");
  assert.equal(romeLocal("2026-07-02T16:00:00Z"), "2026-07-02T18:00");
  assert.throws(() => romeToIso("2026-03-29T02:30"), /cambio/);
  assert.throws(() => romeToIso("2026-10-25T02:30"), /cambio/);
  assert.throws(() => romeToIso("2026-02-30T12:00"), /valid/);
  assert.equal(weekStart("2026-11-01"), "2026-10-26");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("existing CRM state works without fitness arrays and malformed collections are rejected", () => {
  const s = state();
  assert.doesNotThrow(() => check(s, s));
  assert.equal(isFitnessData(s), true);
  assert.equal(
    isFitnessData({ ...s, plans: [{ ...plan(), sessions: [null] }] }),
    false,
  );
  assert.equal(
    isFitnessData({
      ...s,
      bookings: [{ ...booking("b"), cancelled: "false" }],
    }),
    false,
  );
});
test("publishing requires exercises, valid sets, rest and safe video links", () => {
  const s = state();
  const p = plan();
  assert.doesNotThrow(() => check(s, { ...s, plans: [p] }));
  assert.throws(
    () => check(s, { ...s, plans: [{ ...p, sessions: [] }] }),
    /sessione/,
  );
  for (const patch of [
    { sets: 0 },
    { restSeconds: 901 },
    { reps: "" },
    { name: "" },
    { videoUrl: "javascript:alert(1)" },
  ]) {
    const modified = structuredClone(p);
    Object.assign(modified.sessions[0].exercises[0], patch);
    assert.throws(() => check(s, { ...s, plans: [modified] }));
  }
  assert.doesNotThrow(() =>
    check(s, { ...s, plans: [{ ...p, status: "draft", sessions: [] }] }),
  );
});
test("monthly assignments are unique, published only, and preserve snapshots after source edits/archive", () => {
  const s = { ...state(), plans: [plan()] };
  const a = {
    id: "a1",
    studentId: "a",
    planId: "p",
    month: "2026-11",
    createdAt: new Date(now).toISOString(),
    snapshot: structuredClone(plan()),
  };
  const assigned = { ...s, assignments: [a] };
  assert.doesNotThrow(() => check(s, assigned));
  assert.throws(
    () => check(s, { ...assigned, assignments: [a, { ...a, id: "a2" }] }),
    /solo piano/,
  );
  assert.throws(
    () => check(s, { ...assigned, plans: [{ ...plan(), status: "draft" }] }),
    /pubblicati/,
  );
  const changed = {
    ...assigned,
    plans: [{ ...plan(), title: "Nuovo titolo", status: "archived" }],
  };
  assert.doesNotThrow(() => check(assigned, changed));
  assert.equal(changed.assignments[0].snapshot.title, "Forza");
  assert.throws(
    () =>
      check(s, {
        ...assigned,
        students: [{ ...student("a"), archived: true }, student("b")],
      }),
    /archiviati/,
  );
});
test("lessons reject past dates, coach/room overlap and capacity below enrolled students", () => {
  const s = state(),
    l = lesson("l");
  assert.throws(
    () =>
      check(s, { ...s, lessons: [{ ...l, startsAt: "2026-01-01T12:00:00Z" }] }),
    /futuri/,
  );
  for (const patch of [{ coach: l.coach }, { location: l.location }])
    assert.throws(
      () => check(s, { ...s, lessons: [l, lesson("two", patch)] }),
      /occupati/,
    );
  const booked = {
    ...s,
    lessons: [{ ...l, capacity: 2 }],
    bookings: [booking("b1"), booking("b2", "b")],
  };
  assert.doesNotThrow(() => check(s, booked));
  assert.throws(() => check(booked, { ...booked, lessons: [l] }), /capienza/);
  assert.equal(
    overlaps(l, lesson("two", { startsAt: "2026-11-02T18:00:00Z" })),
    false,
  );
  assert.doesNotThrow(() =>
    check(s, {
      ...s,
      lessons: [
        l,
        lesson("two", {
          startsAt: "2026-11-02T18:00:00Z",
          coach: l.coach,
          location: l.location,
        }),
      ],
    }),
  );
});
test("booking enforces availability, active students, distinct slots and no student overlap", () => {
  const s = { ...state(), lessons: [lesson("l")] };
  assert.doesNotThrow(() => check(s, { ...s, bookings: [booking("one")] }));
  assert.throws(
    () => check(s, { ...s, bookings: [booking("one"), booking("two", "b")] }),
    /capienza/,
  );
  assert.throws(
    () =>
      check(s, {
        ...s,
        lessons: [{ ...lesson("l"), cancelled: true }],
        bookings: [booking("one")],
      }),
    /attivi/,
  );
  assert.throws(
    () =>
      check(s, {
        ...s,
        students: [{ ...student("a"), status: "paused" }, student("b")],
        bookings: [booking("one")],
      }),
    /attivi/,
  );
  const two = {
    ...s,
    lessons: [lesson("l"), lesson("two")],
    bookings: [booking("one"), booking("second", "a", "two")],
  };
  assert.throws(() => check(s, two), /altra lezione/);
  assert.doesNotThrow(() =>
    check(s, {
      ...two,
      lessons: [
        lesson("l"),
        lesson("two", { startsAt: "2026-11-02T18:00:00Z" }),
      ],
    }),
  );
});
test("archiving student cancels bookings atomically and preserves historical records", () => {
  const s = { ...state(), lessons: [lesson("l")], bookings: [booking("one")] };
  const next = reconcileFitness({
    ...s,
    students: [{ ...student("a"), archived: true }, student("b")],
  });
  assert.equal(next.bookings[0].cancelled, true);
  assert.equal(next.bookings[0].id, "one");
  assert.doesNotThrow(() => check(s, next));
  assert.equal(s.bookings[0].cancelled, false);
});
test("CSV is quoted, UTF8 and neutralizes spreadsheet formulas in values and property headers", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("\t+123"), '"\'\t+123"');
  assert.equal(csvCell(-20), '"-20"');
  assert.equal(csvCell("a\nb"), '"a\nb"');
  const s = {
    ...student("a"),
    firstName: "=cmd",
    phone: "+393331234567",
    properties: { p: "@SUM(1)" },
  };
  const csv = studentsCsv(
    [s],
    [],
    [
      {
        id: "p",
        name: "=header",
        type: "text",
        group: "G",
        description: "",
        options: [],
        required: false,
        archived: false,
      },
    ],
    ["property:p"],
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=header"'));
  assert.ok(csv.includes('"\'@SUM(1)"'));
  assert.ok(csv.includes('"\'+393331234567"'));
});
