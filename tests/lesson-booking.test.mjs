import test from "node:test";
import assert from "node:assert/strict";
import { createAvailability } from "../src/modules/crm/availability.ts";
import { availabilityLessons } from "../src/modules/crm/availability-lessons.ts";
import {
  bookableStudents,
  staffBooking,
} from "../src/modules/crm/lesson-booking.ts";
import { prepareTransition } from "../src/modules/crm/transition.ts";

const start = "2090-11-06T06:00:00.000Z",
  end = "2090-11-06T07:00:00.000Z";
const student = (id, tierId = "onsite") => ({
  id,
  firstName: "TEST",
  lastName: id,
  email: `${id}@example.com`,
  tierId,
  status: "active",
  coach: "",
  joinedAt: "2026-11-01",
  tags: [],
  properties: {},
});
const state = () => ({
  version: 1,
  students: [student("a"), student("b"), student("c", "online")],
  tiers: [
    {
      id: "onsite",
      name: "In sede",
      description: "",
      archived: false,
      entitlements: { plans: false, lessons: true, monthlyBookingLimit: null },
    },
    {
      id: "online",
      name: "Online",
      description: "",
      archived: false,
      entitlements: { plans: true, lessons: false, monthlyBookingLimit: null },
    },
  ],
  admins: [
    {
      id: "owner",
      name: "TEST Coach",
      email: "owner@example.com",
      role: "owner",
      status: "active",
      availability: [createAvailability(start, end, 2)],
    },
  ],
  properties: [],
});

test("l’admin iscrive uno studente a una fascia non ancora prenotata: la lezione nasce con la prima iscrizione", () => {
  const initial = state();
  const [lesson] = availabilityLessons(initial);
  const next = staffBooking(initial, lesson.id, "a", false);
  assert.equal(next.lessons.length, 1);
  assert.equal(next.lessons[0].id, lesson.id);
  assert.equal(next.bookings.length, 1);
  // Il server accetta la transizione e il secondo posto si occupa come il primo.
  const saved = prepareTransition(initial, next);
  const both = prepareTransition(
    saved,
    staffBooking(saved, lesson.id, "b", false),
  );
  assert.equal(both.lessons.length, 1);
  assert.equal(both.bookings.filter((b) => !b.cancelled).length, 2);
});

test("la capienza resta quella della fascia: il terzo studente viene respinto", () => {
  let current = state();
  current.students.push(student("d"));
  const [lesson] = availabilityLessons(current);
  for (const id of ["a", "b"])
    current = prepareTransition(
      current,
      staffBooking(current, lesson.id, id, false),
    );
  assert.throws(
    () =>
      prepareTransition(current, staffBooking(current, lesson.id, "d", false)),
    /capienza/,
  );
});

test("rimuovere libera il posto e conserva lo storico", () => {
  let current = state();
  const [lesson] = availabilityLessons(current);
  current = prepareTransition(
    current,
    staffBooking(current, lesson.id, "a", false),
  );
  current = prepareTransition(
    current,
    staffBooking(current, lesson.id, "a", true),
  );
  assert.equal(current.bookings.length, 1);
  assert.equal(current.bookings[0].cancelled, true);
  // Una fascia mai prenotata non si può "rimuovere".
  assert.throws(
    () => staffBooking(state(), lesson.id, "a", true),
    /non è più disponibile/,
  );
});

test("gli studenti proposti sono solo quelli con le lezioni nel tier, senza gli già iscritti", () => {
  const current = state();
  const [lesson] = availabilityLessons(current);
  assert.deepEqual(
    bookableStudents(current, lesson).map((s) => s.id),
    ["a", "b"],
  );
  assert.deepEqual(
    bookableStudents(current, lesson, ["a"]).map((s) => s.id),
    ["b"],
  );
  current.students[1].archived = true;
  assert.deepEqual(
    bookableStudents(current, lesson).map((s) => s.id),
    ["a"],
  );
  // Uno studente senza lezioni nel tier viene respinto dal server.
  assert.throws(
    () =>
      prepareTransition(state(), staffBooking(state(), lesson.id, "c", false)),
    /non sono incluse/,
  );
});
