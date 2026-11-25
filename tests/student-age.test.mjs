import test from "node:test";
import assert from "node:assert/strict";
import {
  ageColumn,
  ageOn,
  birthDatePropertyId,
  formatAge,
  hasBirthDate,
  studentAge,
} from "../src/modules/crm/student-age.ts";
import {
  availableStudentColumns,
  groupStudents,
} from "../src/modules/crm/student-grid.ts";
import { sanitizeDirectory, selectStudents } from "../src/modules/crm/logic.ts";
import { studentsCsv } from "../src/modules/crm/csv.ts";
import { defaultDirectory } from "../src/modules/crm/model.ts";

const birth = {
  id: birthDatePropertyId,
  name: "Data di nascita",
  type: "date",
  group: "Informazioni studente",
  description: "",
  required: false,
  options: [],
  archived: false,
};
const tiers = [
  { id: "online", name: "Coaching online", description: "", archived: false },
];
const student = (id, born) => ({
  id,
  firstName: "Test",
  lastName: id,
  email: `${id}@example.com`,
  phone: "",
  coach: "",
  status: "active",
  tierId: "online",
  joinedAt: "2026-11-01",
  properties: born ? { [birthDatePropertyId]: born } : {},
});

test("l’età conta solo i compleanni già passati", () => {
  assert.equal(ageOn("1989-01-01", "2026-11-25"), 37);
  assert.equal(ageOn("1979-11-27", "2026-11-25"), 46);
  assert.equal(ageOn("1979-11-27", "2026-11-27"), 47);
  assert.equal(ageOn("2000-02-29", "2026-02-28"), 25);
  assert.equal(ageOn("2000-02-29", "2026-03-01"), 26);
});

test("date mancanti, non valide o future non danno un’età", () => {
  assert.equal(ageOn(undefined, "2026-11-25"), null);
  assert.equal(ageOn("", "2026-11-25"), null);
  assert.equal(ageOn("1989-02-30", "2026-11-25"), null);
  assert.equal(ageOn("2027-01-01", "2026-11-25"), null);
  assert.equal(ageOn(37, "2026-11-25"), null);
  assert.equal(formatAge(null), "—");
  assert.equal(formatAge(1), "1 anno");
  assert.equal(formatAge(37), "37 anni");
});

test("la colonna Età esiste solo con un campo Data di nascita attivo", () => {
  const ids = (properties) =>
    availableStudentColumns(properties).map((c) => c.id);
  assert.ok(ids([birth]).includes(ageColumn));
  assert.ok(!ids([]).includes(ageColumn));
  assert.ok(!ids([{ ...birth, archived: true }]).includes(ageColumn));
  assert.ok(!ids([{ ...birth, type: "text" }]).includes(ageColumn));
  assert.equal(hasBirthDate([birth]), true);

  const config = {
    ...defaultDirectory,
    columns: ["tier", ageColumn],
    groupBy: ageColumn,
    sortKey: ageColumn,
    columnWidths: { [ageColumn]: 120 },
  };
  const kept = sanitizeDirectory(config, { properties: [birth], tiers });
  assert.deepEqual(kept.columns, ["tier", ageColumn]);
  assert.equal(kept.groupBy, ageColumn);
  assert.equal(kept.sortKey, ageColumn);
  assert.deepEqual(kept.columnWidths, { [ageColumn]: 120 });
  const dropped = sanitizeDirectory(config, { properties: [], tiers });
  assert.deepEqual(dropped.columns, ["tier"]);
  assert.equal(dropped.groupBy, "");
  assert.equal(dropped.sortKey, "joinedAt");
  assert.deepEqual(dropped.columnWidths, {});
});

test("ordinamento, gruppi e CSV usano l’età calcolata", () => {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
  }).format(new Date());
  const year = Number(today.slice(0, 4));
  const students = [
    student("trenta", `${year - 30}-01-01`),
    student("senza"),
    student("venti", `${year - 20}-01-01`),
    student("venti-bis", `${year - 20}-01-01`),
  ];
  assert.equal(studentAge(students[0]), 30);
  const asc = selectStudents(
    students,
    { ...defaultDirectory, sortKey: ageColumn, sortDirection: "asc" },
    [birth],
    tiers,
  ).map((s) => s.id);
  assert.deepEqual(asc, ["venti", "venti-bis", "trenta", "senza"]);

  const groups = groupStudents(students, ageColumn, [birth], tiers);
  assert.deepEqual(
    groups.map((g) => [g.label, g.total]),
    [
      ["20 anni", 2],
      ["30 anni", 1],
      ["Non compilato", 1],
    ],
  );
  assert.equal(groupStudents(students, ageColumn, [], tiers).length, 1);

  const csv = studentsCsv(students, tiers, [birth], [ageColumn]).split("\r\n");
  assert.ok(csv[0].endsWith('"Età"'));
  assert.ok(csv[1].endsWith('"30"'));
  assert.ok(csv[2].endsWith('""'));
});
