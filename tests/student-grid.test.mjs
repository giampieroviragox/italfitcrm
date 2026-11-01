import test from "node:test";
import assert from "node:assert/strict";
import {
  editStudentCell,
  moveColumn,
} from "../src/modules/crm/student-grid.ts";
import { prepareTransition } from "../src/modules/crm/transition.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";
import { defaultDirectory } from "../src/modules/crm/model.ts";
import { sanitizeDirectory, selectStudents } from "../src/modules/crm/logic.ts";
import { studentsCsv } from "../src/modules/crm/csv.ts";
const state = () => ({
  version: 1,
  students: [
    {
      id: "grid-test-student",
      firstName: "Test",
      lastName: "Griglia",
      email: "grid-test@example.com",
      phone: "",
      coach: "",
      tags: [],
      status: "active",
      tierId: "online",
      joinedAt: "2026-11-01",
      properties: { objective: "Forza" },
      revision: 3,
    },
  ],
  tiers: [{ id: "online", name: "Online", description: "", archived: false }],
  properties: [
    {
      id: "objective",
      name: "Obiettivo",
      type: "select",
      group: "Generale",
      description: "",
      required: false,
      options: ["Forza", "Mobilità"],
      archived: false,
    },
  ],
  admins: [
    {
      id: "owner",
      name: "Test Admin",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    },
  ],
});
test("una modifica dalla griglia conserva gli altri campi e genera revisione e storico", () => {
  const current = state();
  const next = prepareTransition(
    current,
    editStudentCell(
      current,
      current.students[0],
      "property:objective",
      "Mobilità",
    ),
  );
  assert.equal(next.students[0].properties.objective, "Mobilità");
  assert.equal(next.students[0].email, current.students[0].email);
  assert.equal(next.students[0].revision, 4);
  assert.ok(
    next.students[0].history.some((x) => x.text === "Proprietà CRM aggiornate"),
  );
  assert.equal(current.students[0].properties.objective, "Forza");
});
test("la cella rifiuta schede obsolete, archiviate e proprietà archiviate", () => {
  const current = state();
  const original = structuredClone(current.students[0]);
  current.students[0].revision++;
  assert.throws(
    () => editStudentCell(current, original, "coach", "Test"),
    /modificata altrove/,
  );
  current.students[0].archived = true;
  assert.throws(
    () => editStudentCell(current, current.students[0], "coach", "Test"),
    /Ripristina/,
  );
  current.students[0].archived = false;
  current.properties[0].archived = true;
  assert.throws(
    () =>
      editStudentCell(
        current,
        current.students[0],
        "property:objective",
        "Forza",
      ),
    /non è più disponibile/,
  );
});
test("la griglia protegge email collegate e non consente di cambiare campi di accesso", () => {
  const current = state();
  current.students[0].access = {
    status: "active",
    invitedAt: "2026-11-01T12:00:00Z",
  };
  assert.throws(
    () =>
      editStudentCell(
        current,
        current.students[0],
        "email",
        "other@example.com",
      ),
    /account personale/,
  );
  for (const field of ["revision", "access", "id", "joinedAt"]) {
    assert.throws(
      () => editStudentCell(current, current.students[0], field, "arbitrary"),
      /non è modificabile/,
    );
  }
});
test("gli aggiornamenti della griglia passano dalla validazione dei dati CRM", () => {
  const current = state();
  for (const [column, value] of [
    ["email", "invalid"],
    ["phone", "bad"],
    ["tier", "missing"],
    ["name", ""],
    ["property:objective", "Non esistente"],
  ]) {
    assert.throws(() =>
      prepareTransition(
        current,
        editStudentCell(current, current.students[0], column, value),
      ),
    );
  }
});
test("le viste mantengono ordine e larghezze, rimuovendo i campi archiviati", () => {
  const current = state();
  const config = {
    ...defaultDirectory,
    columns: ["email", "property:objective", "status"],
    columnWidths: { name: 260, email: 300, "property:objective": 180 },
  };
  current.directory = config;
  current.views = [{ id: "view", name: "Griglia", config }];
  assert.ok(isCrmState(current));
  const restored = JSON.parse(
    JSON.stringify(prepareTransition(current, current)),
  );
  assert.deepEqual(restored.views[0].config.columnWidths, config.columnWidths);
  assert.deepEqual(moveColumn(config.columns, "status", "email"), [
    "status",
    "email",
    "property:objective",
  ]);
  current.properties[0].archived = true;
  const clean = sanitizeDirectory(config, current);
  assert.deepEqual(clean.columns, ["email", "status"]);
  assert.deepEqual(clean.columnWidths, { name: 260, email: 300 });
  for (const width of [139, 561, Infinity, "200"]) {
    assert.equal(
      isCrmState({
        ...state(),
        directory: { ...config, columnWidths: { email: width } },
      }),
      false,
    );
  }
});
test("l’ordinamento per email funziona e il CSV non duplica l’email visibile", () => {
  const current = state();
  const a = current.students[0];
  const b = { ...a, id: "grid-test-2", email: "aaa@example.com" };
  assert.deepEqual(
    selectStudents(
      [a, b],
      { ...defaultDirectory, sortKey: "email", sortDirection: "asc" },
      [],
      current.tiers,
    ).map((s) => s.id),
    [b.id, a.id],
  );
  const csv = studentsCsv([a], current.tiers, [], ["email", "phone", "tier"]);
  assert.equal(
    csv.split("\r\n")[0],
    '\uFEFF"Nome","Cognome","Email","Telefono","Tier"',
  );
});
