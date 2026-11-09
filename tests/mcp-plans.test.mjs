import test from "node:test";
import assert from "node:assert/strict";
import {
  mcpPlanTemplate,
  mcpPlanTemplates,
  mcpStudentPlan,
  mcpStudents,
} from "../src/modules/crm/mcp-plans.ts";

const student = (id, firstName, lastName, extra = {}) => ({
  id,
  firstName,
  lastName,
  email: `${id}@example.com`,
  phone: "+39 333 000 0000",
  tierId: "online",
  status: "active",
  joinedAt: "2026-11-01",
  coach: "",
  properties: { segreto: "non esporre" },
  notes: [{ id: "n", body: "nota interna" }],
  ...extra,
});
const snapshot = (title) => ({ title, description: "", sessions: [] });
const state = {
  version: 1,
  tiers: [
    {
      id: "online",
      name: "Coaching online",
      description: "",
      archived: false,
      entitlements: { plans: true, lessons: false, monthlyBookingLimit: null },
    },
    {
      id: "sede",
      name: "Allenamento in sede",
      description: "",
      archived: false,
      entitlements: { plans: false, lessons: true, monthlyBookingLimit: null },
    },
  ],
  properties: [],
  admins: [],
  students: [
    student("a", "Élodie", "Rossi"),
    student("b", "Marco", "Bianchi", { tierId: "sede" }),
    student("c", "Archiviato", "Rossi", { archived: true }),
  ],
  plans: [
    {
      id: "p1",
      title: "Forza",
      description: "",
      status: "draft",
      sessions: [],
      program: {
        goal: "Hyrox",
        startsOn: "2026-11-01",
        endsOn: "2026-11-30",
        guidance: "",
        paceZones: [],
      },
    },
    {
      id: "p2",
      title: "Vecchio",
      description: "",
      status: "archived",
      sessions: [],
    },
  ],
  assignments: [
    {
      id: "x1",
      studentId: "a",
      planId: "p1",
      month: "2026-12",
      createdAt: "",
      snapshot: snapshot("Dicembre"),
    },
    {
      id: "x2",
      studentId: "a",
      planId: "p1",
      month: "2026-11",
      createdAt: "",
      snapshot: snapshot("Novembre"),
    },
  ],
};

test("mcpStudents searches accent-insensitively and hides private data", () => {
  const found = mcpStudents(state, "elodie");
  assert.deepEqual(found, [
    {
      id: "a",
      nome: "Élodie Rossi",
      tier: "Coaching online",
      pianiAbilitati: true,
      mesiConPiano: ["2026-11", "2026-12"],
    },
  ]);
  assert.equal(mcpStudents(state, "rossi").length, 1, "archived excluded");
  assert.equal(mcpStudents(state, "marco")[0].pianiAbilitati, false);
  const serialized = JSON.stringify(mcpStudents(state));
  for (const secret of ["example.com", "333", "non esporre", "nota interna"])
    assert.ok(!serialized.includes(secret), secret);
});

test("mcpStudentPlan returns the requested or latest month", () => {
  assert.equal(mcpStudentPlan(state, "a").piano.title, "Dicembre");
  assert.equal(mcpStudentPlan(state, "a", "2026-11").piano.title, "Novembre");
  const missing = mcpStudentPlan(state, "a", "2027-01");
  assert.equal(missing.trovato, false);
  assert.deepEqual(missing.mesiDisponibili, ["2026-11", "2026-12"]);
  assert.equal(mcpStudentPlan(state, "c").trovato, false, "archived");
  assert.equal(mcpStudentPlan(state, "zzz").trovato, false);
});

test("mcpPlanTemplates skips archived plans", () => {
  assert.deepEqual(mcpPlanTemplates(state), [
    {
      id: "p1",
      titolo: "Forza",
      stato: "draft",
      sessioni: 0,
      obiettivo: "Hyrox",
    },
  ]);
  assert.equal(mcpPlanTemplate(state, "p2"), null);
  assert.equal(mcpPlanTemplate(state, "p1").title, "Forza");
});
