import assert from "node:assert/strict";
import test from "node:test";
import { planValue } from "../src/modules/crm/accounting.ts";

const sub = (price, durationMonths, startsOn = "2026-11-01") => ({
  id: "sub",
  startsOn,
  endsOn: "2027-02-01",
  price,
  durationMonths,
  payments: [],
});
const stateWith = (subscription) => ({
  students: [{ id: "anna", onlineSubscriptions: [subscription] }],
});
const monthly = (subscription, months) =>
  months.map((month) =>
    planValue(stateWith(subscription), { studentId: "anna", month }),
  );

test("il valore mensile di un piano somma sempre al prezzo dell'abbonamento", () => {
  // 100,00 € su 3 mesi: i centesimi che avanzano vanno ai primi mesi.
  const values = monthly(sub(10000, 3), ["2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(values, [3334, 3333, 3333]);
  assert.equal(
    values.reduce((a, b) => a + b, 0),
    10000,
  );
  // Divisione esatta: nessun cambiamento.
  assert.deepEqual(
    monthly(sub(19000, 2), ["2026-11", "2026-12"]),
    [9500, 9500],
  );
  // Due centesimi avanzano su 4 mesi: i primi due mesi li ricevono.
  assert.deepEqual(
    monthly(sub(10002, 4), ["2026-11", "2026-12", "2027-01", "2027-02"]),
    [2501, 2501, 2500, 2500],
  );
});
