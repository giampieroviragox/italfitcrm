import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDelta,
  applyPatch,
  buildPatch,
  canonical,
  ChangeError,
  deltaBetween,
  diffState,
  lightStudent,
  staleRecords,
} from "../src/modules/crm/sync.ts";
import { createAvailability } from "../src/modules/crm/availability.ts";
import { projectState, staffScope } from "../src/modules/crm/permissions.ts";

const student = (id, extra = {}) => ({
  id,
  firstName: "TEST",
  lastName: id,
  email: `${id}@example.com`,
  tierId: "t",
  status: "active",
  coach: "",
  joinedAt: "2026-11-01",
  properties: {},
  ...extra,
});
const base = () => ({
  version: 1,
  tiers: [{ id: "t", name: "T", description: "", archived: false }],
  properties: [],
  admins: [
    {
      id: "owner",
      name: "Owner",
      email: "o@example.com",
      role: "owner",
      status: "active",
      access: { status: "active" },
    },
    {
      id: "marta",
      name: "Marta",
      email: "m@example.com",
      role: "admin",
      status: "active",
      teamRole: "coach",
    },
  ],
  students: [student("a", { coach: "Marta" }), student("b"), student("c")],
  plans: [],
  assignments: [],
  lessons: [
    {
      id: "l1",
      title: "Gruppo",
      startsAt: "2090-01-01T10:00:00.000Z",
      durationMinutes: 60,
      capacity: 2,
      coach: "Owner",
      location: "Sala",
      cancelled: false,
    },
  ],
  bookings: [
    {
      id: "bk1",
      lessonId: "l1",
      studentId: "a",
      createdAt: "2026-11-01T10:00:00.000Z",
      cancelled: false,
    },
  ],
});
const versions = () => ({
  tiers: { t: 1 },
  admins: { owner: 3, marta: 1 },
  students: { a: 4, b: 2, c: 1 },
  lessons: { l1: 5 },
  bookings: { bk1: 1 },
  plans: {},
  assignments: {},
  properties: {},
});

test("canonical ignora l’ordine delle chiavi", () => {
  assert.equal(
    canonical({ a: 1, b: { d: 1, c: 2 } }),
    canonical({ b: { c: 2, d: 1 }, a: 1 }),
  );
  assert.notEqual(canonical({ a: 1 }), canonical({ a: 2 }));
});

test("il diff contiene solo i record cambiati, ognuno con la versione letta", () => {
  const current = base();
  const next = structuredClone(current);
  next.students[1].lastName = "Cambiato";
  const changes = diffState(current, next, versions());
  assert.deepEqual(Object.keys(changes), ["students"]);
  assert.equal(changes.students.length, 1);
  assert.equal(changes.students[0].id, "b");
  assert.equal(changes.students[0].expected, 2);
  assert.equal(changes.students[0].payload.lastName, "Cambiato");
  assert.equal("properties" in changes.students[0], false);
  // Nessuna modifica: nessun cambiamento, anche con chiavi in ordine diverso.
  const same = structuredClone(current);
  same.students[0] = Object.fromEntries(
    Object.entries(same.students[0]).reverse(),
  );
  assert.deepEqual(diffState(current, same, versions()), {});
});

test("un record nuovo parte da expected null e l’accesso dell’admin non si scrive", () => {
  const current = base();
  const next = structuredClone(current);
  next.students.push(student("d", { properties: { x: 1 } }));
  next.admins[1].name = "Marta R.";
  const changes = diffState(current, next, versions());
  assert.equal(changes.students[0].expected, null);
  assert.deepEqual(changes.students[0].properties, { x: 1 });
  assert.equal(changes.admins[0].expected, 1);
  assert.equal("access" in changes.admins[0].payload, false);
  // L’accesso cambiato da solo non è una modifica.
  const onlyAccess = structuredClone(current);
  onlyAccess.admins[0].access = { status: "invited" };
  assert.deepEqual(diffState(current, onlyAccess, versions()), {});
});

test("note e cronologia: si scrivono solo le voci nuove; il dettaglio pesante solo se era caricato", () => {
  const current = base();
  current.students[0].notes = [{ id: "n1", text: "vecchia", createdAt: "x" }];
  current.students[0].history = [{ id: "h1", text: "vecchio", createdAt: "x" }];
  const next = structuredClone(current);
  next.students[0].notes.push({ id: "n2", text: "nuova", createdAt: "y" });
  next.students[0].history.push({ id: "h2", text: "nuovo", createdAt: "y" });
  const write = diffState(current, next, versions()).students[0];
  assert.deepEqual(
    write.notes.map((n) => n.id),
    ["n2"],
  );
  assert.deepEqual(
    write.history.map((h) => h.id),
    ["h2"],
  );
  // Stato leggero: i log non caricati non si toccano, nemmeno se il server li riscrive vuoti.
  const light = base();
  const lightNext = structuredClone(light);
  lightNext.students[1].workoutEntries = [];
  lightNext.students[1].lastName = "X";
  assert.equal(
    "heavy" in diffState(light, lightNext, versions()).students[0],
    false,
  );
  // Stato completo dello studente: i log cambiati si scrivono.
  const full = base();
  full.students[0].workoutEntries = [{ id: "w1", assignmentId: "as" }];
  const fullNext = structuredClone(full);
  fullNext.students[0].workoutEntries.push({ id: "w2", assignmentId: "as" });
  assert.equal(
    diffState(full, fullNext, versions()).students[0].heavy.workoutEntries
      .length,
    2,
  );
});

test("non si cancella nulla senza averlo chiesto; piani e assegnazioni rimossi vanno dichiarati", () => {
  const current = base();
  current.plans = [{ id: "p1" }];
  current.assignments = [
    { id: "as1", studentId: "a", planId: "p1", month: "2026-11" },
  ];
  const next = structuredClone(current);
  next.assignments = [];
  assert.throws(
    () =>
      diffState(current, next, {
        ...versions(),
        plans: { p1: 1 },
        assignments: { as1: 1 },
      }),
    ChangeError,
  );
  const changes = diffState(
    current,
    next,
    { ...versions(), plans: { p1: 1 }, assignments: { as1: 1 } },
    { assignments: ["as1"] },
  );
  assert.deepEqual(changes.removed, { assignments: ["as1"] });
  const noStudent = structuredClone(current);
  noStudent.students = noStudent.students.slice(1);
  assert.throws(() => diffState(current, noStudent, versions()), ChangeError);
});

test("le prenotazioni in più generano il controllo di capienza della lezione", () => {
  const current = base();
  const next = structuredClone(current);
  next.bookings.push({
    id: "bk2",
    lessonId: "l1",
    studentId: "b",
    createdAt: "x",
    cancelled: false,
  });
  const changes = diffState(current, next, versions());
  assert.deepEqual(changes.capacity, [{ lesson: "l1", max: 2 }]);
  assert.equal(changes.bookings[0].expected, null);
  // Annullare non richiede controlli.
  const cancel = structuredClone(current);
  cancel.bookings[0].cancelled = true;
  assert.equal(diffState(current, cancel, versions()).capacity, undefined);
});

test("la capienza di una fascia prenotabile è quella pubblicata dall’admin", () => {
  const current = base();
  const start = "2090-03-01T10:00:00.000Z";
  current.admins[1].availability = [
    createAvailability(start, "2090-03-01T11:00:00.000Z", 3),
  ];
  const next = structuredClone(current);
  const id = `availability:marta:${Date.parse(start)}:60`;
  next.lessons.push({
    id,
    title: "Allenamento in sede",
    startsAt: start,
    durationMinutes: 60,
    capacity: 3,
    coach: "Marta",
    location: "Sala",
    cancelled: false,
    availability: { adminId: "marta" },
  });
  next.bookings.push({
    id: "bk9",
    lessonId: id,
    studentId: "b",
    createdAt: "x",
    cancelled: false,
  });
  const changes = diffState(current, next, versions());
  assert.deepEqual(changes.capacity, [{ lesson: id, max: 3 }]);
});

test("patch del browser: solo i record cambiati, conflitti sulle versioni vecchie, sovrapposizione sullo stato", () => {
  const current = base();
  const proposed = structuredClone(current);
  proposed.students[2].lastName = "Nuovo";
  proposed.students[2].notes = [{ id: "n", text: "t", createdAt: "x" }];
  proposed.students.push(student("z"));
  const patch = buildPatch(current, proposed, versions());
  assert.deepEqual(
    patch.records.students.map((r) => [r.id, r.base]),
    [
      ["c", 1],
      ["z", null],
    ],
  );
  // Il patch non porta note né cronologia.
  assert.equal("notes" in patch.records.students[0].record, false);
  assert.deepEqual(staleRecords(patch, versions()), []);
  assert.deepEqual(
    staleRecords(patch, {
      ...versions(),
      students: { ...versions().students, c: 2 },
    }),
    [{ collection: "students", id: "c" }],
  );
  assert.deepEqual(
    staleRecords(patch, { ...versions(), students: { a: 4, b: 2 } }),
    [{ collection: "students", id: "c" }],
  );
  const merged = applyPatch(current, patch);
  assert.equal(merged.students.find((s) => s.id === "c").lastName, "Nuovo");
  assert.equal(merged.students.length, 4);
  assert.equal(merged.students[0].id, "a");
});

test("delta: applicarlo allo stato precedente dà quello nuovo, senza tornare indietro di versione", () => {
  const before = base();
  const after = structuredClone(before);
  after.students[1].lastName = "Cambiato";
  after.students.push(student("d", { joinedAt: "2026-11-05" }));
  after.bookings.push({
    id: "bk2",
    lessonId: "l1",
    studentId: "b",
    createdAt: "x",
    cancelled: false,
  });
  after.lessons[0].cancelled = true;
  const v = {
    ...versions(),
    students: { ...versions().students, b: 3, d: 1 },
    bookings: { bk1: 1, bk2: 1 },
    lessons: { l1: 6 },
  };
  const delta = deltaBetween(before, after, v);
  assert.deepEqual(Object.keys(delta.upserts).sort(), [
    "bookings",
    "lessons",
    "students",
  ]);
  assert.deepEqual(delta.upserts.students.map((r) => r.id).sort(), ["b", "d"]);
  const merged = applyDelta(before, versions(), delta);
  assert.equal(
    canonical(merged.state.students.map(lightStudent)),
    canonical(
      [...after.students]
        .sort((x, y) =>
          x.joinedAt < y.joinedAt
            ? 1
            : x.joinedAt > y.joinedAt
              ? -1
              : x.id < y.id
                ? -1
                : 1,
        )
        .map(lightStudent),
    ),
  );
  assert.equal(merged.state.lessons[0].cancelled, true);
  assert.equal(merged.versions.students.b, 3);
  // Un delta vecchio non sovrascrive un record più recente.
  const stale = {
    upserts: {
      students: [
        { id: "b", v: 1, r: { ...student("b"), lastName: "Vecchio" } },
      ],
    },
    removed: [],
  };
  const again = applyDelta(merged.state, merged.versions, stale);
  assert.equal(
    again.state.students.find((s) => s.id === "b").lastName,
    "Cambiato",
  );
});

test("il dettaglio caricato di uno studente resta quando arriva un delta leggero", () => {
  const state = base();
  state.students[0].notes = [{ id: "n1", text: "t", createdAt: "x" }];
  state.students[0].workoutEntries = [{ id: "w", assignmentId: "a" }];
  const delta = {
    upserts: {
      students: [
        {
          id: "a",
          v: 5,
          r: { ...student("a", { coach: "Marta" }), lastName: "Nuovo" },
        },
      ],
    },
    removed: [],
  };
  const merged = applyDelta(state, versions(), delta);
  const a = merged.state.students.find((s) => s.id === "a");
  assert.equal(a.lastName, "Nuovo");
  assert.equal(a.notes.length, 1);
  assert.equal(a.workoutEntries.length, 1);
  assert.deepEqual(merged.changedStudents, ["a"]);
});

test("uno studente che esce dal perimetro porta via assegnazioni e prenotazioni", () => {
  const state = base();
  state.assignments = [
    { id: "as", studentId: "a", planId: "p", month: "2026-11" },
  ];
  const merged = applyDelta(state, versions(), {
    upserts: {},
    removed: [{ k: "students", id: "a" }],
  });
  assert.equal(
    merged.state.students.some((s) => s.id === "a"),
    false,
  );
  assert.equal(merged.state.assignments.length, 0);
  assert.equal(merged.state.bookings.length, 0);
});

test("un coach vede la stessa cosa leggendo uno stato intero o applicando i delta", () => {
  const before = base();
  before.admins[1].teamRole = "coach";
  const scope = staffScope(before, "marta");
  const after = structuredClone(before);
  after.students[0].lastName = "Cambiata"; // visibile
  after.students[1].lastName = "Altrui"; // non visibile
  after.bookings.push({
    id: "bk2",
    lessonId: "l1",
    studentId: "b",
    createdAt: "x",
    cancelled: false,
  });
  const seenBefore = projectState(before, scope);
  const seenAfter = projectState(after, staffScope(after, "marta"));
  const v = {
    ...versions(),
    students: { a: 5, b: 3, c: 1 },
    bookings: { bk1: 1, bk2: 1 },
  };
  const delta = deltaBetween(seenBefore, seenAfter, v);
  assert.deepEqual(
    delta.upserts.students.map((r) => r.id),
    ["a"],
  );
  assert.equal(delta.upserts.bookings, undefined);
  const merged = applyDelta(seenBefore, versions(), delta);
  assert.equal(canonical(merged.state.students), canonical(seenAfter.students));
  assert.equal(canonical(merged.state.bookings), canonical(seenAfter.bookings));
});

test("un delta senza novità non crea un nuovo stato", () => {
  const state = base();
  const same = applyDelta(state, versions(), { upserts: {}, removed: [] });
  assert.equal(same.state, state);
  const prefs = applyDelta(state, versions(), {
    upserts: {},
    removed: [],
    preferences: { views: [] },
  });
  assert.equal(prefs.state, state);
  const changed = applyDelta(state, versions(), {
    upserts: {},
    removed: [],
    preferences: { activeViewId: "v1" },
  });
  assert.notEqual(changed.state, state);
  assert.equal(changed.state.activeViewId, "v1");
});
