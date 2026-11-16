import test from "node:test";
import assert from "node:assert/strict";
import { placeCalendarItems } from "../src/modules/crm/calendar-layout.ts";

test("gli eventi sovrapposti si affiancano, quelli consecutivi riusano lo spazio", () => {
  const items = [
    { id: "sera", from: 18 * 60, to: 19 * 60 },
    { id: "lezione 1", from: 9 * 60, to: 10 * 60 },
    { id: "lezione 2", from: 10 * 60, to: 11 * 60 },
    { id: "fascia", from: 8 * 60, to: 12 * 60 },
    { id: "lezione 3", from: 10 * 60 + 15, to: 11 * 60 },
  ];
  assert.deepEqual(
    placeCalendarItems(items).map(({ id, lane, lanes }) => [id, lane, lanes]),
    [
      ["fascia", 0, 3],
      ["lezione 1", 1, 3],
      ["lezione 2", 1, 3],
      ["lezione 3", 2, 3],
      ["sera", 0, 1],
    ],
  );
  assert.equal(items[0].id, "sera");
});
