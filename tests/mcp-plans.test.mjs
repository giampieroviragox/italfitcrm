import test from "node:test";
import { assertFitnessTransition } from "../src/modules/crm/fitness-logic.ts";
import assert from "node:assert/strict";
import {
  applyDraftPlan,
  applyPlanEdits,
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
  assert.equal(found.totale, 1);
  assert.equal(found.completo, true);
  assert.deepEqual(found.studenti, [
    {
      id: "a",
      nome: "Élodie Rossi",
      tier: "Coaching online",
      pianiAbilitati: true,
      mesiConPiano: ["2026-11", "2026-12"],
    },
  ]);
  assert.equal(mcpStudents(state, "rossi").totale, 1, "archived excluded");
  assert.equal(mcpStudents(state, "marco").studenti[0].pianiAbilitati, false);
  const limited = mcpStudents(state, "", 1);
  assert.deepEqual([limited.totale, limited.completo], [2, false]);
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

const draftInput = {
  title: "  Hyrox dicembre ",
  description: "Blocco base",
  sessions: [
    {
      name: "Forza A",
      week: 1,
      day: "Lunedì",
      kind: "strength",
      exercises: [
        { name: "Squat", sets: 4, reps: "8", restSeconds: 90 },
        { name: "Affondi", sets: 3, reps: "10", restSeconds: 60, notes: "" },
      ],
    },
    {
      id: "corsa",
      name: "Corsa Z2",
      kind: "run",
      exercises: [{ name: "Corsa", sets: 1, reps: "40 min", restSeconds: 0 }],
    },
  ],
};
const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};

test("applyDraftPlan creates a valid draft with generated ids", () => {
  const {
    state: next,
    plan,
    created,
  } = applyDraftPlan(state, draftInput, ids());
  assert.equal(created, true);
  assert.equal(plan.status, "draft");
  assert.equal(plan.title, "Hyrox dicembre");
  assert.equal(next.plans.length, state.plans.length + 1);
  assert.deepEqual(
    plan.sessions.map((s) => s.id),
    ["id-1", "corsa"],
  );
  assert.deepEqual(
    plan.sessions[0].exercises.map((e) => [e.id, e.notes]),
    [
      ["id-2", ""],
      ["id-3", ""],
    ],
  );
  // Fixture assignments are partial: validate the plans on their own.
  assert.doesNotThrow(() =>
    assertFitnessTransition(
      { ...state, assignments: [] },
      { ...next, assignments: [] },
    ),
  );
});

test("applyDraftPlan replaces only drafts", () => {
  const updated = applyDraftPlan(
    state,
    { ...draftInput, modelloId: "p1" },
    ids(),
  );
  assert.equal(updated.created, false);
  assert.equal(updated.state.plans.length, state.plans.length);
  assert.equal(
    updated.state.plans.find((p) => p.id === "p1").title,
    "Hyrox dicembre",
  );
  const published = {
    ...state,
    plans: [{ ...state.plans[0], status: "published" }],
  };
  assert.throws(
    () => applyDraftPlan(published, { ...draftInput, modelloId: "p1" }, ids()),
    /già pubblicato/,
  );
  assert.throws(
    () => applyDraftPlan(state, { ...draftInput, modelloId: "zzz" }, ids()),
    /non trovato/,
  );
  assert.throws(
    () =>
      applyDraftPlan(
        state,
        {
          ...draftInput,
          sessions: [draftInput.sessions[1], draftInput.sessions[1]],
        },
        ids(),
      ),
    /duplicata/,
  );
});

function draftState() {
  const { state: next, plan } = applyDraftPlan(state, draftInput, ids());
  return { next, plan };
}

test("applyPlanEdits changes, adds, moves and removes items in order", () => {
  const { next, plan } = draftState();
  const [forza, corsa] = plan.sessions;
  const [squat, affondi] = forza.exercises;
  const newIds = (() => {
    let n = 0;
    return () => `new-${++n}`;
  })();
  const result = applyPlanEdits(
    next,
    plan.id,
    [
      { tipo: "piano", title: " Hyrox v2 " },
      {
        tipo: "modifica_esercizio",
        sessioneId: forza.id,
        esercizioId: squat.id,
        campi: { sets: 5, reps: "5 @ 80%" },
      },
      {
        tipo: "modifica_sessione",
        sessioneId: forza.id,
        campi: { day: "Martedì", week: null },
      },
      {
        tipo: "aggiungi_esercizio",
        sessioneId: forza.id,
        esercizio: { name: "Plank", sets: 3, reps: "45 s", restSeconds: 30 },
        dopoEsercizioId: null,
      },
      {
        tipo: "sposta_esercizio",
        sessioneId: forza.id,
        esercizioId: affondi.id,
        versoSessioneId: corsa.id,
        dopoEsercizioId: null,
      },
      {
        tipo: "aggiungi_sessione",
        sessione: {
          name: "Mobilità",
          exercises: [
            { name: "Stretch", sets: 1, reps: "10 min", restSeconds: 0 },
          ],
        },
        dopoSessioneId: null,
      },
      { tipo: "sposta_sessione", sessioneId: corsa.id, dopoSessioneId: null },
    ],
    newIds,
  );
  const edited = result.plan;
  assert.equal(edited.title, "Hyrox v2");
  assert.equal(edited.status, "draft");
  assert.deepEqual(
    edited.sessions.map((s) => s.name),
    ["Corsa Z2", "Mobilità", "Forza A"],
  );
  const forzaAfter = edited.sessions.find((s) => s.id === forza.id);
  assert.equal(forzaAfter.day, "Martedì");
  assert.equal("week" in forzaAfter, false);
  assert.deepEqual(
    forzaAfter.exercises.map((e) => [e.name, e.sets, e.reps]),
    [
      ["Plank", 3, "45 s"],
      ["Squat", 5, "5 @ 80%"],
    ],
  );
  assert.deepEqual(
    edited.sessions[0].exercises.map((e) => e.name),
    ["Affondi", "Corsa"],
  );
  assert.equal(result.changes.length, 7);
  assert.doesNotThrow(() =>
    assertFitnessTransition(
      { ...next, assignments: [] },
      { ...result.state, assignments: [] },
    ),
  );
  assert.equal(
    next.plans.find((p) => p.id === plan.id).title,
    "Hyrox dicembre",
    "input state untouched",
  );
});

test("applyPlanEdits refuses published plans and reports the failing step", () => {
  const { next, plan } = draftState();
  assert.throws(
    () =>
      applyPlanEdits(
        next,
        plan.id,
        [
          { tipo: "piano", title: "Ok" },
          { tipo: "rimuovi_sessione", sessioneId: "manca" },
        ],
        ids(),
      ),
    /Operazione 2 \(rimuovi_sessione\): Sessione manca non trovata/,
  );
  assert.throws(
    () =>
      applyPlanEdits(
        next,
        plan.id,
        [
          {
            tipo: "modifica_esercizio",
            sessioneId: plan.sessions[0].id,
            esercizioId: plan.sessions[0].exercises[0].id,
            campi: { name: null },
          },
        ],
        ids(),
      ),
    /obbligatorio/,
  );
  const published = {
    ...state,
    plans: [{ ...state.plans[0], status: "published" }],
  };
  assert.throws(
    () =>
      applyPlanEdits(published, "p1", [{ tipo: "piano", title: "X" }], ids()),
    /solo le bozze/,
  );
});
