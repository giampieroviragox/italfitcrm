import test from "node:test";
import assert from "node:assert/strict";
import { createAvailability } from "../src/modules/crm/availability.ts";
import { availabilityLessons } from "../src/modules/crm/availability-lessons.ts";
import { prepareStudentBooking } from "../src/modules/crm/student-booking.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
import { prepareTransition } from "../src/modules/crm/transition.ts";

const start = "2090-11-06T06:00:00.000Z",
  end = "2090-11-06T08:00:00.000Z";
const student = (id) => ({
  id,
  firstName: "TEST",
  lastName: id,
  email: `${id}@example.com`,
  tierId: "onsite",
  status: "active",
  coach: "",
  joinedAt: "2026-11-01",
  tags: [],
  properties: {},
});
const state = () => ({
  version: 1,
  students: [student("a"), student("b")],
  tiers: [
    {
      id: "onsite",
      name: "In sede",
      description: "",
      archived: false,
      entitlements: { plans: false, lessons: true, monthlyBookingLimit: null },
    },
  ],
  admins: [
    {
      id: "owner",
      name: "TEST Coach",
      email: "owner@example.com",
      role: "owner",
      status: "active",
      availability: [createAvailability(start, end, 4)],
    },
  ],
  properties: [],
});

test("students see precisely the four published half-hour slots and no admin contacts", () => {
  const data = studentProjection(state(), "a");
  assert.equal(data.lessons.length, 4);
  assert.deepEqual(
    data.lessons.map((lesson) => lesson.durationMinutes),
    [30, 30, 30, 30],
  );
  assert.equal(data.lessons[0].startsAt, start);
  assert.equal(data.lessons[3].startsAt, "2090-11-06T07:30:00.000Z");
  assert.equal(JSON.stringify(data).includes("owner@example.com"), false);
  assert.equal(JSON.stringify(data).includes("b@example.com"), false);
  const hidden = state();
  hidden.tiers[0].entitlements.lessons = false;
  assert.equal(studentProjection(hidden, "a").lessons.length, 0);
});
test("booking materializes the published slot, rejects a second student, and cancellation reopens it", () => {
  const initial = state(),
    id = availabilityLessons(initial)[0].id;
  const booked = prepareStudentBooking(initial, "a", id, false);
  assert.equal(booked.lessons.length, 1);
  assert.equal(booked.bookings.length, 1);
  assert.equal(
    studentProjection(booked, "a").lessons.find((l) => l.id === id).enrolled,
    true,
  );
  assert.throws(
    () => prepareStudentBooking(booked, "b", id, false),
    /capienza/,
  );
  const cancelled = prepareStudentBooking(booked, "a", id, true);
  const rebooked = prepareStudentBooking(cancelled, "b", id, false);
  assert.equal(rebooked.lessons.length, 1);
  assert.equal(rebooked.bookings.filter((b) => !b.cancelled).length, 1);
});
test("stale or forged slots are rejected, while a withdrawn slot preserves an existing booking and allows cancellation", () => {
  const initial = state(),
    id = availabilityLessons(initial)[0].id;
  assert.throws(
    () => prepareStudentBooking(initial, "a", id + "fake", false),
    /disponibile/,
  );
  const booked = prepareStudentBooking(initial, "a", id, false);
  const withdrawn = prepareTransition(booked, {
    ...booked,
    admins: booked.admins.map((a) => ({ ...a, availability: [] })),
  });
  assert.equal(
    studentProjection(withdrawn, "a").lessons.find((l) => l.id === id).enrolled,
    true,
  );
  const cancelled = prepareStudentBooking(withdrawn, "a", id, true);
  assert.equal(cancelled.bookings[0].cancelled, true);
  assert.throws(
    () => prepareStudentBooking(cancelled, "b", id, false),
    /fascia/,
  );
  const rescheduled = prepareTransition(cancelled, {
    ...cancelled,
    admins: cancelled.admins.map((a) => ({
      ...a,
      availability: [createAvailability(start, end, 2)],
    })),
  });
  const replacement = availabilityLessons(rescheduled)[0];
  assert.equal(replacement.durationMinutes, 60);
  assert.equal(
    prepareStudentBooking(
      rescheduled,
      "b",
      replacement.id,
      false,
    ).bookings.filter((b) => !b.cancelled).length,
    1,
  );
});
test("monthly limits, inactive students and room conflicts also apply to availability slots", () => {
  const initial = state();
  initial.tiers[0].entitlements.monthlyBookingLimit = 1;
  const [first, second] = availabilityLessons(initial);
  const booked = prepareStudentBooking(initial, "a", first.id, false);
  assert.throws(
    () => prepareStudentBooking(booked, "a", second.id, false),
    /Limite/,
  );
  const inactive = state();
  inactive.students[0].status = "paused";
  assert.throws(
    () => prepareStudentBooking(inactive, "a", first.id, false),
    /attivi/,
  );
  const conflict = state();
  conflict.lessons = [
    {
      id: "lesson",
      title: "TEST Lezione",
      startsAt: start,
      durationMinutes: 60,
      capacity: 8,
      coach: "TEST Altro",
      location: "Sala principale",
      cancelled: false,
    },
  ];
  assert.equal(availabilityLessons(conflict).length, 2);
});
