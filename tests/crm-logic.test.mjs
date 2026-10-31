import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesFilter,
  selectStudents,
  sanitizeDirectory,
  assertCrmTransition,
  bulkUpdate,
} from "../src/modules/crm/logic.ts";
import {
  defaultDirectory,
  validDate,
  uniqueOptions,
} from "../src/modules/crm/model.ts";
const p = (type = "text", id = "p") => ({
  id,
  name: id,
  type,
  group: "Generale",
  description: "",
  required: false,
  options: ["Forza", "Mobilità"],
  archived: false,
});
const student = (id, properties = {}) => ({
  id,
  firstName: "Giulia",
  lastName: id,
  email: `${id}@example.com`,
  tierId: "online",
  status: "active",
  joinedAt: "2026-10-31",
  tags: [],
  coach: "",
  properties,
});
const state = () => ({
  version: 1,
  students: [student("a"), student("b")],
  tiers: [{ id: "online", name: "Online", description: "", archived: false }],
  properties: [],
  admins: [
    {
      id: "owner",
      name: "Admin",
      email: "admin@example.com",
      role: "owner",
      status: "active",
    },
  ],
});
const f = (operator, value = "", values) => ({
  id: "f",
  propertyId: "p",
  operator,
  value,
  values,
});
test("le date impossibili vengono rifiutate, gli anni bisestili gestiti", () => {
  assert.equal(validDate("2026-02-31"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
});
test("le opzioni sono univoche anche con maiuscole, accenti e spazi", () =>
  assert.deepEqual(
    uniqueOptions([" Forza ", "FORZA", "Mobilità", "Mobilita", ""]),
    ["Forza", "Mobilità"],
  ));
test("i confronti numerici non sono lessicografici e distinguono zero e vuoto", () => {
  assert.equal(matchesFilter(10, f("gt", "9"), p("number")), true);
  assert.equal(matchesFilter(0, f("equals", "0"), p("number")), true);
  assert.equal(matchesFilter("", f("equals", "0"), p("number")), false);
  assert.equal(matchesFilter(3, f("gt", ""), p("number")), false);
});
test("booleano No non è un campo vuoto", () => {
  assert.equal(matchesFilter(false, f("is_empty"), p("boolean")), false);
  assert.equal(matchesFilter(false, f("equals", "false"), p("boolean")), true);
  assert.equal(
    matchesFilter(undefined, f("not_equals", "true"), p("boolean")),
    false,
  );
});
test("filtri multipli: almeno una, tutte, operandi mancanti", () => {
  assert.equal(
    matchesFilter(
      ["Forza"],
      f("has_any", "", ["Forza", "Mobilità"]),
      p("multiselect"),
    ),
    true,
  );
  assert.equal(
    matchesFilter(
      ["Forza"],
      f("has_all", "", ["Forza", "Mobilità"]),
      p("multiselect"),
    ),
    false,
  );
  assert.equal(
    matchesFilter(["Forza"], f("has_all", "", []), p("multiselect")),
    false,
  );
});
test("le condizioni sono in AND e la ricerca esclude le proprietà archiviate", () => {
  const a = student("a", { p: 10, hidden: "segreto" }),
    b = student("b", { p: 3 });
  const properties = [p("number"), { ...p("text", "hidden"), archived: true }];
  assert.deepEqual(
    selectStudents(
      [a, b],
      { ...defaultDirectory, filters: [f("gt", "5")] },
      properties,
      state().tiers,
    ).map((s) => s.id),
    ["a"],
  );
  assert.equal(
    selectStudents(
      [a, b],
      { ...defaultDirectory, query: "segreto" },
      properties,
      state().tiers,
    ).length,
    0,
  );
});
test("ordinamento numerico stabile con campi vuoti in fondo anche in decrescente", () => {
  const students = [
    student("a", { p: 2 }),
    student("b", { p: 10 }),
    student("c"),
  ];
  assert.deepEqual(
    selectStudents(
      students,
      { ...defaultDirectory, sortKey: "property:p", sortDirection: "desc" },
      [p("number")],
      state().tiers,
    ).map((s) => s.id),
    ["b", "a", "c"],
  );
});
test("gli studenti archiviati sono esclusi dalle viste normali", () => {
  const students = [student("a"), { ...student("b"), archived: true }];
  assert.equal(
    selectStudents(students, defaultDirectory, [], state().tiers).length,
    1,
  );
  assert.deepEqual(
    selectStudents(
      students,
      { ...defaultDirectory, archived: true },
      [],
      state().tiers,
    ).map((s) => s.id),
    ["b"],
  );
});
test("archiviare una proprietà ripulisce filtri, colonne e ordinamento delle viste", () => {
  const config = {
    ...defaultDirectory,
    columns: ["tier", "property:p"],
    sortKey: "property:p",
    filters: [f("contains", "x")],
  };
  const clean = sanitizeDirectory(config, {
    ...state(),
    properties: [{ ...p(), archived: true }],
  });
  assert.deepEqual(clean.columns, ["tier"]);
  assert.deepEqual(clean.filters, []);
  assert.equal(clean.sortKey, "joinedAt");
});
test("email duplicate e tier archiviato assegnato bloccano una transazione", () => {
  const before = state();
  assert.throws(
    () =>
      assertCrmTransition(before, {
        ...before,
        students: [student("a"), { ...student("b"), email: "A@example.com" }],
      }),
    /duplicati/,
  );
  assert.throws(
    () =>
      assertCrmTransition(before, {
        ...before,
        tiers: [{ ...before.tiers[0], archived: true }],
      }),
    /Riassegna/,
  );
});
test("cambiare il tipo o rimuovere un’opzione in uso viene bloccato", () => {
  const before = {
    ...state(),
    properties: [p("select")],
    students: [student("a", { p: "Forza" })],
  };
  assert.throws(
    () => assertCrmTransition(before, { ...before, properties: [p("text")] }),
    /tipo/,
  );
  assert.throws(
    () =>
      assertCrmTransition(before, {
        ...before,
        properties: [{ ...p("select"), options: ["Mobilità", "Resistenza"] }],
      }),
    /incompatibili/,
  );
});
test("nuove proprietà obbligatorie non bloccano la sola aggiunta di note o l’archiviazione", () => {
  const before = { ...state(), properties: [{ ...p(), required: true }] };
  const next = {
    ...before,
    students: before.students.map((s) => ({
      ...s,
      notes: [{ id: "n", text: "Test", createdAt: new Date().toISOString() }],
    })),
  };
  assert.doesNotThrow(() => assertCrmTransition(before, next));
  assert.doesNotThrow(() =>
    assertCrmTransition(before, bulkUpdate(before, ["a"], { archived: true })),
  );
  assert.throws(
    () =>
      assertCrmTransition(
        before,
        bulkUpdate(before, ["a"], { status: "paused" }),
      ),
    /proprietà/,
  );
});
test("aggiornamento massivo modifica solo i record scelti e conserva proprietà e note", () => {
  const before = state();
  before.students[0].properties = { p: false };
  const next = bulkUpdate(before, ["a"], { status: "paused" });
  assert.equal(next.students[0].status, "paused");
  assert.equal(next.students[1].status, "active");
  assert.equal(next.students[0].properties.p, false);
  assert.equal(before.students[0].status, "active");
});
test("le viste non possono avere nomi duplicati", () => {
  const before = state();
  assert.throws(
    () =>
      assertCrmTransition(before, {
        ...before,
        views: [
          { id: "1", name: " Attivi ", config: defaultDirectory },
          { id: "2", name: "attivi", config: defaultDirectory },
        ],
      }),
    /viste/,
  );
});

test("ripristinare uno studente su un nuovo tier non forza campi obbligatori aggiunti durante l’archiviazione", () => {
  const before = {
    ...state(),
    properties: [{ ...p(), required: true }],
    students: [{ ...student("a"), archived: true, tierId: "old" }],
    tiers: [
      ...state().tiers,
      { id: "old", name: "Old", description: "", archived: true },
    ],
  };
  assert.doesNotThrow(() =>
    assertCrmTransition(before, {
      ...before,
      students: [{ ...before.students[0], archived: false, tierId: "online" }],
    }),
  );
});

test("il nome della vista predefinita non può essere riutilizzato", () => {
  const before = state();
  assert.throws(
    () =>
      assertCrmTransition(before, {
        ...before,
        views: [
          { id: "v", name: "Tutti gli studenti", config: defaultDirectory },
        ],
      }),
    /viste/,
  );
});
