import test from "node:test";
import assert from "node:assert/strict";
import {
  studentAccess,
  bookingRestriction,
  lessonMonth,
  isTierAccess,
} from "../src/modules/crm/tier-access.ts";
import { assertFitnessTransition } from "../src/modules/crm/fitness-logic.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";
const student = {
  id: "s",
  firstName: "Test",
  lastName: "Student",
  email: "s@example.com",
  tierId: "t",
  status: "active",
  joinedAt: "2026-11-01",
  coach: "",
  tags: [],
  properties: {},
};
const lesson = (id, startsAt) => ({
  id,
  title: id,
  startsAt,
  durationMinutes: 60,
  capacity: 8,
  coach: id,
  location: id,
  cancelled: false,
});
const plan = {
  id: "p",
  title: "Plan",
  description: "",
  status: "published",
  sessions: [
    {
      id: "session",
      name: "Session",
      exercises: [
        {
          id: "e",
          name: "Squat",
          sets: 3,
          reps: "8",
          restSeconds: 90,
          notes: "",
        },
      ],
    },
  ],
};
const state = (access) => ({
  version: 1,
  students: [student],
  tiers: [
    {
      id: "t",
      name: "An arbitrary name",
      description: "",
      archived: false,
      ...(access ? { entitlements: access } : {}),
    },
  ],
  properties: [],
  admins: [
    {
      id: "owner",
      name: "Owner",
      email: "o@example.com",
      role: "owner",
      status: "active",
    },
  ],
  plans: [plan],
  assignments: [],
  lessons: [
    lesson("a", "2026-11-05T17:00:00Z"),
    lesson("b", "2026-11-06T17:00:00Z"),
  ],
  bookings: [],
});
const booking = (id, lessonId) => ({
  id,
  studentId: "s",
  lessonId,
  cancelled: false,
  createdAt: "2026-11-01T10:00:00Z",
});
const check = (before, next) =>
  assertFitnessTransition(before, next, Date.parse("2026-11-01T10:00:00Z"));
test("access policy uses explicit flags and never derives permissions from a tier name", () => {
  const s = state({ plans: true, lessons: false, monthlyBookingLimit: null });
  s.tiers[0].name = "Allenamento in sede";
  assert.equal(studentAccess(s, student).lessons, false);
  assert.equal(studentProjection(s, "s").lessons.length, 0);
  const next = { ...s, bookings: [booking("x", "a")] };
  assert.throws(() => check(s, next), /non sono incluse/);
});
test("plan-only and lesson-only student projections enforce content access", () => {
  const s = state({ plans: false, lessons: true, monthlyBookingLimit: null });
  const assignment = {
    id: "assignment",
    studentId: "s",
    planId: "p",
    month: "2026-11",
    createdAt: "2026-11-01T10:00:00Z",
    snapshot: plan,
  };
  s.assignments = [assignment];
  assert.equal(studentProjection(s, "s").assignments.length, 0);
  assert.throws(
    () => check({ ...s, assignments: [] }, s),
    /non include i piani/,
  );
  assert.doesNotThrow(() => check(s, s));
});
test("monthly cap rejects new bookings atomically while cancellation releases a place", () => {
  const s = state({ plans: false, lessons: true, monthlyBookingLimit: 1 });
  s.bookings = [booking("x", "a")];
  assert.match(bookingRestriction(s, "s", "b"), /Limite/);
  assert.throws(
    () => check(s, { ...s, bookings: [...s.bookings, booking("y", "b")] }),
    /Limite/,
  );
  const cancelled = {
    ...s,
    bookings: s.bookings.map((b) => ({ ...b, cancelled: true })),
  };
  assert.doesNotThrow(() => check(s, cancelled));
  assert.doesNotThrow(() =>
    check(cancelled, {
      ...cancelled,
      bookings: [...cancelled.bookings, booking("y", "b")],
    }),
  );
});
test("monthly accounting uses Rome and excludes cancelled lessons and bookings", () => {
  assert.equal(lessonMonth("2026-01-31T23:30:00Z"), "2026-02");
  const s = state({ plans: false, lessons: true, monthlyBookingLimit: 1 });
  s.lessons[0].startsAt = "2026-10-31T23:30:00Z";
  s.bookings = [booking("x", "a")];
  assert.match(bookingRestriction(s, "s", "b"), /Limite/);
  s.lessons[0].cancelled = true;
  assert.equal(bookingRestriction(s, "s", "b"), "");
  s.lessons[0].cancelled = false;
  s.lessons[0].startsAt = "2026-10-31T20:30:00Z";
  assert.equal(bookingRestriction(s, "s", "b"), "");
});
test("tier downgrade preserves history and lets the student cancel an existing booking", () => {
  const old = state({ plans: true, lessons: true, monthlyBookingLimit: null });
  old.bookings = [booking("x", "a")];
  const next = structuredClone(old);
  next.tiers[0].entitlements = {
    plans: false,
    lessons: false,
    monthlyBookingLimit: null,
  };
  assert.doesNotThrow(() => check(old, next));
  const projection = studentProjection(next, "s");
  assert.equal(projection.lessons.length, 1);
  assert.equal(projection.lessons[0].enrolled, true);
  assert.match(projection.lessons[0].restriction, /non sono incluse/);
  assert.doesNotThrow(() =>
    check(next, {
      ...next,
      bookings: next.bookings.map((b) => ({ ...b, cancelled: true })),
    }),
  );
});
test("malformed limits are rejected before persistence and legacy tiers remain compatible", () => {
  const valid = { plans: true, lessons: true, monthlyBookingLimit: null };
  for (const limit of [0, -1, 1.2, 201, "3", Infinity]) {
    assert.equal(isTierAccess({ ...valid, monthlyBookingLimit: limit }), false);
    assert.equal(
      isCrmState(state({ ...valid, monthlyBookingLimit: limit })),
      false,
    );
  }
  assert.deepEqual(studentAccess(state(), student), valid);
  assert.deepEqual(studentAccess({ ...state(), tiers: [] }, student), {
    plans: false,
    lessons: false,
    monthlyBookingLimit: null,
  });
});
