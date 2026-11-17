import test from "node:test";
import assert from "node:assert/strict";
import { createAvailability } from "../src/modules/crm/availability.ts";
import {
  availabilityLessonId,
  availabilityLessons,
} from "../src/modules/crm/availability-lessons.ts";
import { prepareStudentBooking } from "../src/modules/crm/student-booking.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
import { prepareTransition } from "../src/modules/crm/transition.ts";

import { applyWalletCommand } from "../src/modules/crm/lesson-wallet.ts";

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

test("gli studenti vedono una fascia intera con capienza quattro e nessun contatto privato", () => {
  const data = studentProjection(state(), "a");
  assert.equal(data.lessons.length, 1);
  assert.equal(data.lessons[0].durationMinutes, 120);
  assert.equal(data.lessons[0].capacity, 4);
  assert.equal(data.lessons[0].startsAt, start);
  assert.equal(JSON.stringify(data).includes("owner@example.com"), false);
  assert.equal(JSON.stringify(data).includes("b@example.com"), false);
  const hidden = state();
  hidden.tiers[0].entitlements.lessons = false;
  assert.equal(studentProjection(hidden, "a").lessons.length, 0);
});

test("otto persone prenotano lo stesso orario, la nona resta fuori e un annullamento libera un posto", () => {
  const initial = state();
  initial.admins[0].availability = [
    createAvailability(start, "2090-11-06T07:00:00.000Z", 8),
  ];
  initial.students = Array.from({ length: 9 }, (_, i) =>
    student(String(i + 1)),
  );
  const [lesson] = availabilityLessons(initial);
  assert.equal(lesson.durationMinutes, 60);
  const booked = initial.students
    .slice(0, 8)
    .reduce(
      (current, s) => prepareStudentBooking(current, s.id, lesson.id, false),
      initial,
    );
  assert.equal(booked.lessons.length, 1);
  assert.equal(booked.bookings.length, 8);
  assert.equal(studentProjection(booked, "2").lessons[0].occupied, 8);
  assert.equal(studentProjection(booked, "2").lessons[0].enrolled, true);
  assert.throws(
    () => prepareStudentBooking(booked, "9", lesson.id, false),
    /capienza/,
  );
  const cancelled = prepareStudentBooking(booked, "1", lesson.id, true);
  const rebooked = prepareStudentBooking(cancelled, "9", lesson.id, false);
  assert.equal(rebooked.bookings.filter((b) => !b.cancelled).length, 8);
  assert.equal(rebooked.lessons[0].startsAt, start);
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
  assert.equal(availabilityLessons(rescheduled).length, 0);
  assert.equal(studentProjection(rescheduled, "b").lessons[0].capacity, 2);
  assert.equal(
    prepareStudentBooking(rescheduled, "b", id, false).bookings.filter(
      (b) => !b.cancelled,
    ).length,
    1,
  );
});
test("monthly limits, archived students and room conflicts also apply to availability slots", () => {
  const initial = state();
  initial.tiers[0].entitlements.monthlyBookingLimit = 1;
  initial.admins[0].availability.push(
    createAvailability(end, "2090-11-06T09:00:00.000Z", 2),
  );
  const [first, second] = availabilityLessons(initial);
  const booked = prepareStudentBooking(initial, "a", first.id, false);
  assert.throws(
    () => prepareStudentBooking(booked, "a", second.id, false),
    /Limite/,
  );
  const inactive = state();
  inactive.students[0].archived = true;
  assert.throws(
    () => prepareStudentBooking(inactive, "a", first.id, false),
    /archiviati|disponibili|disponibile|non trovato/,
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
  assert.equal(availabilityLessons(conflict).length, 0);
});

test("una prenotazione precedente mantiene il suo orario e il suo ID", () => {
  const initial = state();
  const id = availabilityLessonId("owner", start, 30);
  initial.lessons = [
    {
      id,
      title: "Allenamento in sede",
      startsAt: start,
      durationMinutes: 30,
      capacity: 1,
      coach: "TEST Coach",
      location: "Sala principale",
      cancelled: false,
      availability: { adminId: "owner" },
    },
  ];
  initial.bookings = [
    {
      id: "vecchia-prenotazione",
      lessonId: id,
      studentId: "a",
      createdAt: "2026-11-01T10:00:00.000Z",
      cancelled: false,
    },
  ];
  assert.equal(studentProjection(initial, "a").lessons[0].durationMinutes, 30);
  assert.equal(studentProjection(initial, "b").lessons.length, 0);
  assert.throws(
    () => prepareStudentBooking(initial, "b", id, false),
    /fascia|capienza/,
  );
  const cancelled = prepareStudentBooking(initial, "a", id, true);
  assert.equal(cancelled.bookings[0].id, "vecchia-prenotazione");
  const [group] = availabilityLessons(cancelled);
  assert.equal(group.durationMinutes, 120);
  assert.equal(group.capacity, 4);
  assert.notEqual(group.id, id);
});

test("modificare solo la capienza mantiene le prenotazioni e non può escludere iscritti", () => {
  const initial = state();
  const id = availabilityLessons(initial)[0].id;
  // An existing appointment may still store the old capacity of one.
  const a = prepareStudentBooking(initial, "a", id, false);
  a.lessons[0].capacity = 1;
  assert.equal(studentProjection(a, "b").lessons[0].capacity, 4);
  const booked = prepareStudentBooking(a, "b", id, false);
  assert.equal(booked.lessons[0].capacity, 4);
  const update = (capacity) =>
    prepareTransition(booked, {
      ...booked,
      admins: booked.admins.map((admin) => ({
        ...admin,
        availability: [createAvailability(start, end, capacity)],
      })),
    });
  assert.throws(() => update(1), /capienza/);
  const updated = update(8);
  assert.equal(updated.lessons[0].id, id);
  assert.equal(updated.lessons[0].capacity, 8);
  assert.deepEqual(updated.bookings, booked.bookings);
});

test("una disponibilità prenotata entra nel wallet al consuntivo e conserva lo storico se la fascia cambia", () => {
  const initial = state();
  initial.admins[0].availability = [
    createAvailability(start, "2090-11-06T07:00:00.000Z", 4),
  ];
  const [lesson] = availabilityLessons(initial);
  const booked = ["a", "b"].reduce(
    (current, studentId) =>
      prepareStudentBooking(current, studentId, lesson.id, false),
    initial,
  );
  const closed = prepareTransition(
    booked,
    applyWalletCommand(
      booked,
      {
        action: "settle",
        lessonId: lesson.id,
        venue: "milano",
        roster: booked.bookings.map((booking) => ({
          bookingId: booking.id,
          present: booking.studentId === "a",
        })),
      },
      new Date("2090-11-06T07:00:00.000Z"),
    ),
  );
  const withdrawn = prepareTransition(closed, {
    ...closed,
    admins: closed.admins.map((admin) => ({ ...admin, availability: [] })),
  });
  assert.equal(
    studentProjection(withdrawn, "a").lessonWallet.lessons[0].price,
    7000,
  );
  assert.equal(studentProjection(withdrawn, "b").lessonWallet, undefined);
  assert.throws(
    () => prepareStudentBooking(withdrawn, "a", lesson.id, true),
    /già conclusa/,
  );
});
