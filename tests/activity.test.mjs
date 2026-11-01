import test from "node:test";
import assert from "node:assert/strict";
import { prepareTransition } from "../src/modules/crm/transition.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
import { defaultDirectory } from "../src/modules/crm/model.ts";
import { sanitizeDirectory, selectStudents } from "../src/modules/crm/logic.ts";
import { studentsCsv } from "../src/modules/crm/csv.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";
const actor = { id: "owner", name: "Test Admin" };
const access = { record_id: "owner", role: "owner" };
const state = () => ({
  version: 1,
  students: ["a", "b"].map((id) => ({
    id,
    firstName: "Test",
    lastName: id,
    email: `${id}@example.com`,
    coach: "",
    joinedAt: "2026-11-01",
    tierId: "full",
    status: "active",
    properties: {},
    notes: [],
    history: [],
    revision: 0,
  })),
  tiers: [
    {
      id: "full",
      name: "Completo",
      description: "",
      archived: false,
      entitlements: { plans: true, lessons: true, monthlyBookingLimit: null },
    },
  ],
  admins: [
    { ...actor, email: "owner@example.com", role: "owner", status: "active" },
  ],
  properties: [],
  plans: [],
  assignments: [],
  lessons: [],
  bookings: [],
});
const events = (s, id = "a") => s.students.find((x) => x.id === id).history;
const lesson = {
  id: "lesson",
  title: "Forza",
  startsAt: "2099-11-06T10:00:00Z",
  durationMinutes: 60,
  capacity: 10,
  coach: "Test Coach",
  location: "Sala A",
  cancelled: false,
};
const bookedState = () => ({
  ...state(),
  lessons: [lesson],
  bookings: [
    {
      id: "booking",
      lessonId: "lesson",
      studentId: "a",
      createdAt: "2026-11-01T10:00:00Z",
      cancelled: false,
    },
  ],
});

test("profile history records every field, before/after values and verified actor without touching others", () => {
  const before = state(),
    next = structuredClone(before);
  Object.assign(next.students[0], {
    firstName: "Nuovo",
    phone: "+39 333 1234567",
    coach: "Coach B",
    joinedAt: "2026-10-30",
    status: "paused",
  });
  const saved = validateStaffUpdate(before, next, access);
  const history = events(saved);
  assert.equal(history.length, 2);
  assert.ok(history[0].details.includes("Nome: Test → Nuovo"));
  assert.ok(
    history[0].details.includes("Aggiunto il: 2026-11-01 → 2026-10-30"),
  );
  assert.ok(history[1].details.includes("Stato: Attivo → In pausa"));
  assert.ok(
    history.every(
      (e) =>
        e.actorId === "owner" &&
        e.actorName === "Test Admin" &&
        Number.isFinite(Date.parse(e.createdAt)),
    ),
  );
  assert.equal(saved.students[0].revision, 1);
  assert.equal(events(saved, "b").length, 0);
  assert.deepEqual(
    events(prepareTransition(saved, structuredClone(saved), actor)),
    history,
  );
});

test("comments are append-only, trimmed, timestamped and attributed by the server; history cannot be forged", () => {
  const before = state(),
    proposed = structuredClone(before);
  proposed.students[0].notes.push({
    id: "forged",
    text: "  Primo commento\nseconda riga  ",
    actorName: "Fake",
    actorId: "fake",
    createdAt: "2000-01-01T00:00:00Z",
  });
  proposed.students[0].history.push({
    id: "forged-history",
    text: "Falso",
    createdAt: "2000-01-01T00:00:00Z",
  });
  const saved = validateStaffUpdate(before, proposed, access);
  const comment = saved.students[0].notes[0];
  assert.equal(comment.actorName, "Test Admin");
  assert.equal(comment.actorId, "owner");
  assert.equal(comment.text, "Primo commento\nseconda riga");
  assert.notEqual(comment.id, "forged");
  assert.notEqual(comment.createdAt, "2000-01-01T00:00:00Z");
  assert.deepEqual(
    events(saved).map((e) => e.text),
    ["Commento aggiunto"],
  );
  assert.deepEqual(events(saved)[0].details, [comment.text]);
  for (const mutate of [
    (s) => {
      s.students[0].notes = [];
    },
    (s) => {
      s.students[0].notes[0].text = "Sovrascritto";
    },
    (s) => {
      s.students[0].notes[0].actorName = "Altro";
    },
    (s) => {
      s.students[0].notes[0].createdAt = "2000-01-01T00:00:00Z";
    },
    (s) => {
      s.students[0].notes.push(s.students[0].notes[0]);
    },
  ]) {
    const changed = structuredClone(saved);
    mutate(changed);
    assert.throws(
      () => validateStaffUpdate(saved, changed, access),
      /commenti|Commenti/,
    );
  }
  const second = structuredClone(saved);
  second.students[0].notes.push({
    id: "second",
    text: "Altro commento",
    createdAt: new Date().toISOString(),
  });
  second.students[0].history = [];
  const withSecond = validateStaffUpdate(saved, second, access);
  assert.deepEqual(withSecond.students[0].notes[0], comment);
  assert.deepEqual(events(withSecond).slice(0, 1), events(saved));
  assert.equal(events(withSecond).length, 2);
});

test("blank and oversized comments are rejected and legacy notes remain intact", () => {
  for (const text of [" \n ", "x".repeat(5001)]) {
    const before = state(),
      next = structuredClone(before);
    next.students[0].notes.push({
      id: "new",
      text,
      createdAt: new Date().toISOString(),
    });
    assert.throws(() => validateStaffUpdate(before, next, access), /5000/);
  }
  const before = state();
  before.students[0].notes = [
    { id: "legacy", text: "Vecchia nota", createdAt: "2026-10-31T12:00:00Z" },
  ];
  const next = structuredClone(before);
  next.students[0].coach = "Nuovo coach";
  const saved = validateStaffUpdate(before, next, access);
  assert.deepEqual(saved.students[0].notes, before.students[0].notes);
  assert.ok(isCrmState(saved));
});

test("property values and configuration keep the original labels and values in history", () => {
  const before = state();
  before.properties.push({
    id: "weight",
    name: "Peso",
    type: "number",
    group: "Misure",
    description: "",
    required: false,
    archived: false,
    options: [],
  });
  before.students[0].properties.weight = 70;
  const next = structuredClone(before);
  next.students[0].properties.weight = 71.5;
  const saved = prepareTransition(before, next, actor);
  assert.deepEqual(events(saved)[0].details, ["Peso: 70 → 71,5"]);
  const rename = structuredClone(saved);
  rename.properties[0].name = "Peso corporeo";
  const renamed = prepareTransition(saved, rename, actor);
  assert.deepEqual(events(renamed)[0], events(saved)[0]);
  assert.equal(events(renamed)[1].text, "Proprietà “Peso” aggiornata");
  assert.equal(events(renamed, "b").length, 0);
});

test("tier changes and entitlements propagate to the affected students' histories", () => {
  const before = state(),
    next = structuredClone(before);
  next.tiers[0].entitlements.monthlyBookingLimit = 5;
  const saved = prepareTransition(before, next, actor);
  assert.equal(events(saved)[0].text, "Configurazione del tier aggiornata");
  assert.ok(
    events(saved)[0].details.includes(
      "Limite lezioni al mese: Nessun limite → 5",
    ),
  );
  assert.equal(events(saved, "b").length, 1);
  const reassigned = structuredClone(saved);
  reassigned.tiers.push({ ...reassigned.tiers[0], id: "other", name: "Altro" });
  reassigned.students[0].tierId = "other";
  assert.ok(
    events(prepareTransition(saved, reassigned, actor))
      .at(-1)
      .details.includes("Tier: Completo → Altro"),
  );
});

test("booking, cancellation, rebooking and student actor are recorded with lesson details", () => {
  const before = state();
  before.lessons = [lesson];
  const next = bookedState();
  const studentActor = { id: "a", name: "Test a" };
  const saved = prepareTransition(before, next, studentActor);
  assert.equal(events(saved)[0].text, "Lezione prenotata");
  assert.equal(events(saved)[0].actorName, "Test a");
  assert.match(events(saved)[0].details[0], /Forza.*11:00/);
  const cancelled = structuredClone(saved);
  cancelled.bookings[0].cancelled = true;
  const after = prepareTransition(saved, cancelled, studentActor);
  assert.equal(events(after).at(-1).text, "Prenotazione annullata");
  const restored = structuredClone(after);
  restored.bookings[0].cancelled = false;
  assert.equal(
    events(prepareTransition(after, restored, actor)).at(-1).text,
    "Prenotazione ripristinata",
  );
});

test("lesson edits, cancellation and restore are traced even when no student or booking is changed", () => {
  const before = bookedState(),
    next = structuredClone(before);
  next.lessons[0].startsAt = "2099-11-06T11:00:00Z";
  next.lessons[0].coach = "Altro coach";
  const saved = prepareTransition(before, next, actor);
  assert.equal(events(saved)[0].text, "Lezione aggiornata");
  assert.ok(
    events(saved)[0].details.includes("Coach: Test Coach → Altro coach"),
  );
  assert.equal(saved.students[0].revision, 1);
  assert.equal(events(saved, "b").length, 0);
  const cancelled = structuredClone(saved);
  cancelled.lessons[0].cancelled = true;
  const after = prepareTransition(saved, cancelled, actor);
  assert.equal(events(after).at(-1).text, "Lezione annullata");
  const restore = structuredClone(after);
  restore.lessons[0].cancelled = false;
  assert.equal(
    events(prepareTransition(after, restore, actor)).at(-1).text,
    "Lezione ripristinata",
  );
});

test("archiving atomically records cancellation and preserves comments and previous history on restore", () => {
  const before = bookedState();
  before.students[0].notes = [
    { id: "legacy", text: "Da conservare", createdAt: "2026-10-31T12:00:00Z" },
  ];
  const next = structuredClone(before);
  next.students[0].archived = true;
  const saved = prepareTransition(before, next, actor);
  assert.equal(saved.bookings[0].cancelled, true);
  assert.deepEqual(
    events(saved).map((e) => e.text),
    ["Studente archiviato", "Prenotazione annullata"],
  );
  assert.deepEqual(saved.students[0].notes, before.students[0].notes);
  const restore = structuredClone(saved);
  restore.students[0].archived = false;
  const restored = prepareTransition(saved, restore, actor);
  assert.deepEqual(events(restored).slice(0, 2), events(saved));
  assert.equal(events(restored).at(-1).text, "Studente ripristinato");
});

test("monthly plan assignment and replacement preserve the original exercise prescription in history", () => {
  const before = state();
  const sessions = [
    {
      id: "session",
      name: "Sessione A",
      exercises: [
        {
          id: "exercise",
          name: "Squat",
          sets: 3,
          reps: "10",
          restSeconds: 60,
          notes: "Lento",
        },
      ],
    },
  ];
  before.plans.push({
    id: "plan",
    title: "Piano A",
    description: "",
    status: "published",
    sessions,
  });
  const next = structuredClone(before);
  next.assignments.push({
    id: "assignment",
    studentId: "a",
    planId: "plan",
    month: "2099-11",
    createdAt: new Date().toISOString(),
    snapshot: { title: "Piano A", description: "", sessions },
  });
  const saved = prepareTransition(before, next, actor);
  assert.equal(events(saved)[0].text, "Piano mensile assegnato");
  assert.ok(
    events(saved)[0].details.includes(
      "Squat: 3 serie × 10, recupero 60s · Lento",
    ),
  );
  const replace = structuredClone(saved);
  replace.assignments[0].snapshot.sessions[0].exercises[0].sets = 4;
  const after = prepareTransition(saved, replace, actor);
  assert.equal(events(after).at(-1).text, "Piano mensile aggiornato");
  assert.ok(
    events(after)
      .at(-1)
      .details.includes("Squat: 3 serie × 10, recupero 60s · Lento"),
  );
  assert.ok(
    events(after)
      .at(-1)
      .details.includes("Squat: 4 serie × 10, recupero 60s · Lento"),
  );
  assert.deepEqual(events(after)[0], events(saved)[0]);
});

test("tags disappear from saved views, search and CSV while old payloads remain readable", () => {
  const before = state();
  before.students[0].tags = ["TagSegreto"];
  assert.ok(isCrmState(before));
  assert.ok(isCrmState(state()));
  const config = {
    ...defaultDirectory,
    columns: ["tags", "tier"],
    query: "TagSegreto",
  };
  assert.deepEqual(sanitizeDirectory(config, before).columns, ["tier"]);
  assert.equal(
    selectStudents(before.students, config, [], before.tiers).length,
    0,
  );
  const csv = studentsCsv(before.students, before.tiers, [], config.columns);
  assert.ok(!csv.includes('"Tag"'));
  assert.ok(!csv.includes("TagSegreto"));
});

test("large histories and unchanged comments are omitted from mutation requests and preserved by the server", async () => {
  const { mutationState } = await import("../src/modules/crm/mutation.ts");
  const before = state();
  before.students[0].notes = [
    { id: "note", text: "Testo conservato", createdAt: "2026-11-01T10:00:00Z" },
  ];
  before.students[0].history = [
    {
      id: "old",
      text: "x".repeat(2_000_000),
      createdAt: "2026-11-01T10:00:00Z",
    },
  ];
  const proposed = structuredClone(before);
  proposed.students[0].coach = "Coach nuovo";
  const payload = mutationState(before, proposed);
  assert.ok(JSON.stringify(payload).length < 5000);
  const saved = validateStaffUpdate(
    before,
    JSON.parse(JSON.stringify(payload)),
    access,
  );
  assert.deepEqual(saved.students[0].notes, before.students[0].notes);
  assert.deepEqual(events(saved)[0], events(before)[0]);
  assert.equal(events(saved).length, 2);
});
