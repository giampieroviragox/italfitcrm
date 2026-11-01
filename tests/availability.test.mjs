import test from "node:test";
import assert from "node:assert/strict";
import {
  cellsToSlots,
  isAvailability,
  paintCells,
  slotCells,
} from "../src/modules/crm/availability.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
const at = (time) => Date.parse(`2026-11-02T${time}:00Z`);
const iso = (time) => new Date(at(time)).toISOString();
test("contiguous cells merge into one slot and a removal splits it", () => {
  const slots = paintCells([], [at("09:00"), at("09:30"), at("10:00")], true);
  assert.deepEqual(slots, [{ start: iso("09:00"), end: iso("10:30") }]);
  assert.deepEqual(paintCells(slots, [at("09:30")], false), [
    { start: iso("09:00"), end: iso("09:30") },
    { start: iso("10:00"), end: iso("10:30") },
  ]);
  assert.equal(slotCells(slots).size, 3);
  assert.deepEqual(cellsToSlots([]), []);
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
    [{ start: iso("09:00"), end: iso("09:10") }],
    [
      { start: iso("09:00"), end: iso("10:00") },
      { start: iso("09:30"), end: iso("11:00") },
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
