import test from "node:test";
import assert from "node:assert/strict";
import { studentAccess } from "../src/modules/crm/tier-access.ts";
import { studentTierIds } from "../src/modules/crm/student-tiers.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";
import { prepareTransition } from "../src/modules/crm/transition.ts";
import { selectStudents } from "../src/modules/crm/logic.ts";
import { defaultDirectory } from "../src/modules/crm/model.ts";
import {
  groupStudents,
  editStudentCell,
  placeColumn,
} from "../src/modules/crm/student-grid.ts";
import { studentsCsv } from "../src/modules/crm/csv.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
import { propertyKey } from "../src/modules/crm/property-key.ts";

const state = () => ({
  version: 1,
  admins: [
    {
      id: "owner",
      name: "Test Admin",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    },
  ],
  properties: [],
  tiers: [
    {
      id: "online",
      name: "Coaching online",
      description: "",
      archived: false,
      entitlements: { plans: true, lessons: false, monthlyBookingLimit: null },
    },
    {
      id: "studio",
      name: "Allenamento in sede",
      description: "",
      archived: false,
      entitlements: { plans: false, lessons: true, monthlyBookingLimit: 4 },
    },
  ],
  students: [
    {
      id: "student",
      firstName: "Test",
      lastName: "Servizi",
      email: "services@example.com",
      coach: "",
      status: "active",
      tierId: "online",
      joinedAt: "2026-11-01",
      properties: {},
    },
  ],
});

test("assegnare entrambi i tier unisce i servizi, conserva il limite e registra la modifica secondaria", () => {
  const current = state();
  const next = prepareTransition(
    current,
    editStudentCell(current, current.students[0], "tier", ["online", "studio"]),
  );
  assert.ok(isCrmState(next));
  assert.deepEqual(studentAccess(next, next.students[0]), {
    plans: true,
    lessons: true,
    monthlyBookingLimit: 4,
  });
  assert.deepEqual(
    studentProjection(next, "student").services,
    studentAccess(next, next.students[0]),
  );
  assert.ok(
    next.students[0].history.some(
      (h) =>
        h.text === "Tier aggiornato" &&
        h.details.some((d) => d.includes("Allenamento in sede")),
    ),
  );
  assert.equal(next.students[0].revision, 1);
  const removed = prepareTransition(
    next,
    editStudentCell(next, next.students[0], "tier", ["online"]),
  );
  assert.equal(studentAccess(removed, removed.students[0]).lessons, false);
  assert.equal(studentAccess(removed, removed.students[0]).plans, true);
});
test("tier singoli precedenti compatibili e selezioni vuote, duplicate, sconosciute o archiviate rifiutate", () => {
  const current = state();
  assert.deepEqual(studentTierIds(current.students[0]), ["online"]);
  for (const ids of [[], ["online", "online"], ["online", "missing"]]) {
    assert.throws(() =>
      prepareTransition(
        current,
        editStudentCell(current, current.students[0], "tier", ids),
      ),
    );
  }
  const archived = structuredClone(current);
  archived.tiers[1].archived = true;
  assert.throws(() =>
    prepareTransition(
      archived,
      editStudentCell(archived, archived.students[0], "tier", [
        "online",
        "studio",
      ]),
    ),
  );
  assert.equal(
    isCrmState({
      ...current,
      students: [{ ...current.students[0], tierIds: ["studio", "online"] }],
    }),
    false,
  );
});
test("ricerca, filtri tier, gruppi e CSV includono entrambi i servizi", () => {
  const current = state();
  current.students[0].tierIds = ["online", "studio"];
  assert.equal(
    selectStudents(
      current.students,
      { ...defaultDirectory, tier: "studio" },
      [],
      current.tiers,
    ).length,
    1,
  );
  assert.equal(
    selectStudents(
      current.students,
      { ...defaultDirectory, query: "Allenamento in sede" },
      [],
      current.tiers,
    ).length,
    1,
  );
  assert.match(
    groupStudents(current.students, "tier", [], current.tiers)[0].label,
    /Coaching online.*Allenamento in sede/,
  );
  assert.match(
    studentsCsv(current.students, current.tiers, [], ["tier"]),
    /Coaching online \+ Allenamento in sede/,
  );
});
test("key leggibili, riservate, duplicate e archiviate: non si riutilizza un identificativo", () => {
  assert.equal(propertyKey("Obiettivo principale", []), "obiettivo-principale");
  assert.equal(propertyKey("  Mobilità & qualità! ", []), "mobilita-qualita");
  assert.equal(propertyKey("Email", []), "email-2");
  assert.equal(
    propertyKey("Email", [
      { id: "email-2" },
      { id: "email-3", archived: true },
    ]),
    "email-4",
  );
  assert.equal(propertyKey("!!!", []), "campo");
  const current = state();
  current.properties = [
    {
      id: "email-2",
      name: "Email",
      type: "email",
      description: "",
      group: "Generale",
      required: false,
      archived: false,
      options: [],
    },
  ];
  const next = structuredClone(current);
  next.properties.push({ ...next.properties[0], id: "email-3" });
  assert.doesNotThrow(() => prepareTransition(current, next));
  next.properties[1].id = "email-2";
  assert.throws(() => prepareTransition(current, next));
});
test("inserimento colonne prima/dopo in entrambe le direzioni, estremi e drop invalidi", () => {
  const columns = ["email", "tier", "access", "joinedAt"];
  assert.deepEqual(placeColumn(columns, "email", "joinedAt", "after"), [
    "tier",
    "access",
    "joinedAt",
    "email",
  ]);
  assert.deepEqual(placeColumn(columns, "email", "access", "before"), [
    "tier",
    "email",
    "access",
    "joinedAt",
  ]);
  assert.deepEqual(placeColumn(columns, "joinedAt", "email", "before"), [
    "joinedAt",
    "email",
    "tier",
    "access",
  ]);
  assert.deepEqual(placeColumn(columns, "joinedAt", "tier", "after"), [
    "email",
    "tier",
    "joinedAt",
    "access",
  ]);
  assert.deepEqual(placeColumn(columns, "email", "email", "after"), columns);
  assert.deepEqual(placeColumn(columns, "email", "name", "after"), columns);
  assert.deepEqual(columns, ["email", "tier", "access", "joinedAt"]);
});

test("anteprima delle colonne rispetta larghezze diverse e mantiene tutte le colonne", async () => {
  const { columnDragOffsets } =
    await import("../src/modules/crm/column-drag.ts");
  const columns = ["email", "tier", "access"];
  assert.deepEqual(
    columnDragOffsets(
      columns,
      { email: 300, tier: 180, access: 200 },
      "email",
      "access",
      "after",
    ),
    { email: 380, tier: -300, access: -300 },
  );
  assert.deepEqual(
    columnDragOffsets(
      columns,
      { email: 300, tier: 180, access: 200 },
      "access",
      "email",
      "before",
    ),
    { email: 200, tier: 200, access: -480 },
  );
  assert.deepEqual(columnDragOffsets(columns, {}, "email", "email", "before"), {
    email: 0,
    tier: 0,
    access: 0,
  });
});
test("scroll del drag continuo: velocità progressiva ai bordi e zero fuori dalla tabella", async () => {
  const { columnDragScrollSpeed } =
    await import("../src/modules/crm/column-drag.ts");
  assert.equal(columnDragScrollSpeed(500, 100, 900), 0);
  assert.equal(columnDragScrollSpeed(100, 100, 900), -720);
  assert.equal(columnDragScrollSpeed(900, 100, 900), 720);
  assert.ok(
    columnDragScrollSpeed(880, 100, 900) > columnDragScrollSpeed(850, 100, 900),
  );
  assert.equal(columnDragScrollSpeed(50, 100, 900), 0);
  assert.equal(columnDragScrollSpeed(950, 100, 900), 0);
  assert.equal(columnDragScrollSpeed(100, 100, 100), 0);
});
