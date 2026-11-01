import test from "node:test";
import assert from "node:assert/strict";
import {
  availabilitySlotCount,
  changeAvailability,
  createAvailability,
  slotDurationMinutes,
  isAvailability,
} from "../src/modules/crm/availability.ts";
import {
  periodFromFields,
  selectionForPeriod,
} from "../src/modules/crm/availability-time.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
const at = (time) => Date.parse(`2026-11-02T${time}:00Z`);
const iso = (time) => new Date(at(time)).toISOString();
test("slots divide each availability evenly and legacy data keeps one-hour slots", () => {
  const three = createAvailability(iso("07:00"), iso("10:00"), 3);
  assert.equal(slotDurationMinutes(three), 60);
  const four = createAvailability(iso("07:00"), iso("09:00"), 4);
  assert.equal(slotDurationMinutes(four), 30);
  assert.equal(
    availabilitySlotCount({ start: iso("07:00"), end: iso("10:00") }),
    3,
  );
  assert.equal(
    slotDurationMinutes({ start: iso("07:00"), end: iso("10:00") }),
    60,
  );
  assert.equal(
    isAvailability([createAvailability(iso("07:15"), iso("08:15"), 4)]),
    true,
  );
  for (const count of [0, -1, 2.5, NaN, Infinity, 7, 1441])
    assert.throws(() => createAvailability(iso("07:00"), iso("09:00"), count));
});
test("adjacent periods retain their subdivision and overlapping edits are rejected", () => {
  const first = createAvailability(iso("07:00"), iso("09:00"), 4);
  const second = createAvailability(iso("09:00"), iso("10:00"), 1);
  assert.deepEqual(changeAvailability([first], undefined, second), [
    first,
    second,
  ]);
  const edited = { ...first, slotCount: 2 };
  assert.deepEqual(changeAvailability([first, second], first, edited), [
    edited,
    second,
  ]);
  assert.deepEqual(changeAvailability([first, second], first, undefined), [
    second,
  ]);
  assert.throws(
    () =>
      changeAvailability(
        [first],
        undefined,
        createAvailability(iso("08:00"), iso("10:00"), 2),
      ),
    /sovrappone/,
  );
  assert.throws(() => changeAvailability([second], first, edited), /cambiata/);
});
test("malformed or overlapping availability is rejected", () => {
  assert.equal(
    isAvailability([{ start: iso("09:00"), end: iso("10:00") }]),
    true,
  );
  for (const bad of [
    "x",
    [{ start: "no", end: iso("10:00") }],
    [{ start: iso("10:00"), end: iso("09:00") }],
    [{ start: iso("09:00"), end: iso("09:30") }],
    [{ start: iso("09:30"), end: iso("10:30") }],
    [
      { start: iso("09:00"), end: iso("11:00") },
      { start: iso("10:00"), end: iso("12:00") },
    ],
  ])
    assert.equal(isAvailability(bad), false);
});
test("an admin can only change their own availability", () => {
  const state = {
    version: 1,
    students: [],
    tiers: [],
    properties: [],
    admins: [
      {
        id: "owner",
        name: "O",
        email: "o@example.com",
        role: "owner",
        status: "active",
      },
      {
        id: "admin",
        name: "A",
        email: "a@example.com",
        role: "admin",
        status: "active",
      },
    ],
  };
  const slot = [{ start: iso("09:00"), end: iso("10:00") }];
  const withSlot = (id) => ({
    ...state,
    admins: state.admins.map((a) =>
      a.id === id ? { ...a, availability: slot } : a,
    ),
  });
  const access = {
    role: "admin",
    user_id: "u",
    record_id: "admin",
    active: true,
    accepted_at: null,
  };
  assert.deepEqual(
    validateStaffUpdate(state, withSlot("admin"), access).admins[1]
      .availability,
    slot,
  );
  assert.throws(
    () => validateStaffUpdate(state, withSlot("owner"), access),
    /proprie disponibilità/,
  );
});

test("availability supports midnight, precise starts and Rome daylight-saving boundaries", () => {
  const midnight = periodFromFields("2027-01-10", "23:00", "24:00", 2);
  assert.equal(midnight.end, "2027-01-10T23:00:00.000Z");
  assert.equal(selectionForPeriod(midnight).end, "24:00");
  assert.equal(slotDurationMinutes(midnight), 30);
  const precise = periodFromFields("2027-01-10", "06:15", "07:15", 3);
  assert.equal(slotDurationMinutes(precise), 20);
  assert.throws(
    () => periodFromFields("2027-03-28", "02:00", "03:00", 1),
    /cambio dell’ora/,
  );
  assert.throws(
    () => periodFromFields("2027-10-31", "02:00", "03:00", 1),
    /cambio dell’ora/,
  );
  assert.equal(
    slotDurationMinutes(periodFromFields("2027-03-28", "01:00", "04:00", 2)),
    60,
  );
});
