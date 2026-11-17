import assert from "node:assert/strict";
import test from "node:test";
import {
  agendaCommand,
  applyAgendaCommand,
} from "../src/modules/crm/agenda.ts";
import { busyFromCrm } from "../src/modules/crm/agenda-busy.ts";
import {
  desiredItems,
  googleEventId,
  itemHash,
  planSync,
} from "../src/modules/crm/calendar-sync.ts";

const state = () => ({
  version: 1,
  tiers: [{ id: "t", name: "T", description: "", archived: false }],
  properties: [],
  admins: [
    {
      id: "giorgio",
      name: "Giorgio Galbiati",
      email: "g@example.com",
      role: "owner",
      status: "active",
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
  students: [
    {
      id: "anna",
      firstName: "Anna",
      lastName: "Rossi",
      email: "a@example.com",
      status: "active",
      tierId: "t",
      joinedAt: "2026-10-01",
      coach: "Marta",
      properties: {},
      races: [
        {
          id: "r1",
          name: "HYROX Milano",
          date: "2026-12-06",
          location: "Rho",
          createdAt: "2026-11-01T10:00:00.000Z",
        },
      ],
    },
    {
      id: "luca",
      firstName: "Luca",
      lastName: "Bianchi",
      email: "l@example.com",
      status: "active",
      tierId: "t",
      joinedAt: "2026-10-01",
      coach: "",
      properties: {},
      races: [
        {
          id: "r2",
          name: "Maratona",
          date: "2026-12-13",
          location: "Firenze",
          createdAt: "2026-11-01T10:00:00.000Z",
        },
      ],
    },
  ],
  lessons: [
    {
      id: "l1",
      title: "Gruppo mattina",
      startsAt: "2026-11-20T07:00:00.000Z",
      durationMinutes: 60,
      capacity: 8,
      coach: "Giorgio Galbiati",
      location: "Milano",
      cancelled: false,
    },
    {
      id: "l2",
      title: "Annullata",
      startsAt: "2026-11-21T07:00:00.000Z",
      durationMinutes: 60,
      capacity: 8,
      coach: "Giorgio Galbiati",
      location: "Milano",
      cancelled: true,
    },
  ],
  bookings: [
    {
      id: "b1",
      studentId: "anna",
      lessonId: "l1",
      createdAt: "2026-11-10T10:00:00.000Z",
      cancelled: false,
    },
  ],
});
const call = {
  id: "e1",
  title: "Call con Marta",
  startsAt: "2026-11-19T15:00:00.000Z",
  durationMinutes: 30,
  participants: ["giorgio", "marta"],
  studentId: "anna",
  location: "https://meet.google.com/abc",
  createdBy: "marta",
  createdAt: "2026-11-18T10:00:00.000Z",
  updatedAt: "2026-11-18T10:00:00.000Z",
};

test("agenda: crea, modifica solo chi l’ha creato o il super admin, annulla", () => {
  const s = state();
  const created = applyAgendaCommand(
    s,
    [],
    {
      action: "create",
      event: {
        title: " Call ",
        startsAt: call.startsAt,
        durationMinutes: 30,
        participants: ["marta", "giorgio"],
        location: " ",
      },
    },
    { id: "marta", owner: false },
    new Date("2026-11-18T10:00:00Z"),
  );
  assert.equal(created.title, "Call");
  assert.equal(created.createdBy, "marta");
  assert.equal("location" in created, false);
  assert.throws(
    () =>
      applyAgendaCommand(
        s,
        [created],
        { action: "cancel", id: created.id },
        { id: "luca-admin", owner: false },
      ),
    /Solo chi ha creato/,
  );
  assert.equal(
    applyAgendaCommand(
      s,
      [created],
      { action: "cancel", id: created.id },
      { id: "giorgio", owner: true },
    ).cancelled,
    true,
  );
  assert.throws(
    () =>
      applyAgendaCommand(
        s,
        [],
        {
          action: "create",
          event: {
            title: "X",
            startsAt: call.startsAt,
            durationMinutes: 30,
            participants: ["ghost"],
          },
        },
        { id: "marta", owner: false },
      ),
    /non fa parte del team/,
  );
  assert.equal(
    agendaCommand.safeParse({
      action: "create",
      event: {
        title: "X",
        startsAt: call.startsAt,
        durationMinutes: 5,
        participants: ["marta"],
      },
    }).success,
    false,
  );
});

test("ogni calendario riceve le proprie lezioni, call e gare", () => {
  const s = state();
  const giorgio = desiredItems(s, [call], "giorgio", "https://crm.test");
  assert.deepEqual(giorgio.map((i) => i.ref).sort(), [
    "event:e1",
    "lesson:l1",
    "race:anna:r1",
    "race:luca:r2",
  ]);
  const lesson = giorgio.find((i) => i.ref === "lesson:l1");
  assert.match(lesson.description, /Iscritti: 1\/8/);
  assert.doesNotMatch(lesson.description, /Anna/);
  assert.deepEqual(lesson.attendees, ["a@example.com"]);
  assert.deepEqual(lesson.end, { dateTime: "2026-11-20T08:00:00.000Z" });
  const race = giorgio.find((i) => i.ref === "race:anna:r1");
  assert.deepEqual(
    [race.start, race.end],
    [{ date: "2026-12-06" }, { date: "2026-12-07" }],
  );
  // Marta: la call e solo la gara della sua studentessa, nessuna lezione.
  assert.deepEqual(
    desiredItems(s, [call], "marta", "https://crm.test")
      .map((i) => i.ref)
      .sort(),
    ["event:e1", "race:anna:r1"],
  );
  assert.match(
    desiredItems(s, [call], "marta", "https://crm.test")[0].description,
    /Con: Giorgio Galbiati\nStudente: Anna Rossi/,
  );
  assert.deepEqual(
    desiredItems(
      s,
      [{ ...call, cancelled: true }],
      "marta",
      "https://crm.test",
    ).map((i) => i.ref),
    ["race:anna:r1"],
  );
});

test("il piano scrive solo il nuovo o il cambiato e rimuove ciò che non esiste più", () => {
  const s = state();
  const items = desiredItems(s, [call], "giorgio", "https://crm.test");
  const window = { from: "2026-11-01T00:00:00Z", to: "2027-11-01T00:00:00Z" };
  const first = planSync(items, [], window);
  assert.equal(first.write.length, 4);
  const links = first.write.map((w) => ({
    ref: w.item.ref,
    googleEventId: `g-${w.item.ref}`,
    hash: w.hash,
  }));
  assert.deepEqual(planSync(items, links, window), { write: [], remove: [] });
  // La lezione cambia orario, la call viene annullata.
  const moved = structuredClone(s);
  moved.lessons[0].startsAt = "2026-11-20T08:00:00.000Z";
  const next = planSync(
    desiredItems(
      moved,
      [{ ...call, cancelled: true }],
      "giorgio",
      "https://crm.test",
    ),
    links,
    window,
  );
  assert.deepEqual(
    next.write.map((w) => [w.item.ref, w.googleEventId]),
    [["lesson:l1", "g-lesson:l1"]],
  );
  assert.deepEqual(
    next.remove.map((l) => l.ref),
    ["event:e1"],
  );
  // Fuori finestra non si riscrive, ma non si cancella.
  const narrow = planSync(items, [], {
    from: "2026-12-10T00:00:00Z",
    to: "2026-12-31T00:00:00Z",
  });
  assert.deepEqual(
    narrow.write.map((w) => w.item.ref),
    ["race:luca:r2"],
  );
  assert.notEqual(
    itemHash(items[0]),
    itemHash({ ...items[0], summary: "Altro" }),
  );
});

test("ID Google deterministici e validi, diversi per persona", async () => {
  const a = await googleEventId("giorgio", "lesson:l1");
  assert.equal(a, await googleEventId("giorgio", "lesson:l1"));
  assert.notEqual(a, await googleEventId("marta", "lesson:l1"));
  assert.match(a, /^[0-9a-v]{40}$/);
});

test("orari occupati dal CRM: lezioni del coach e appuntamenti, senza annullati", () => {
  const s = state();
  const busy = busyFromCrm(
    s,
    [call],
    "giorgio",
    "2026-11-19T00:00:00Z",
    "2026-11-21T00:00:00Z",
  );
  assert.deepEqual(
    busy.map((b) => [b.label, b.start]),
    [
      ["Lezione · Gruppo mattina", "2026-11-20T07:00:00.000Z"],
      ["Call con Marta", "2026-11-19T15:00:00.000Z"],
    ],
  );
  assert.deepEqual(
    busyFromCrm(
      s,
      [call],
      "marta",
      "2026-11-20T00:00:00Z",
      "2026-11-21T00:00:00Z",
    ),
    [],
  );
});

test("gli iscritti diventano ospiti Google, senza duplicati, annullati o archiviati", () => {
  const s = state();
  s.students.push(
    { ...s.students[0], id: "dup", email: "A@Example.com" },
    { ...s.students[1], id: "arch", email: "x@example.com", archived: true },
    { ...s.students[1], id: "bad", email: "non-una-email" },
    { ...s.students[1], id: "out", email: "out@example.com" },
  );
  s.bookings.push(
    {
      id: "b2",
      studentId: "dup",
      lessonId: "l1",
      createdAt: "x",
      cancelled: false,
    },
    {
      id: "b3",
      studentId: "arch",
      lessonId: "l1",
      createdAt: "x",
      cancelled: false,
    },
    {
      id: "b4",
      studentId: "bad",
      lessonId: "l1",
      createdAt: "x",
      cancelled: false,
    },
    {
      id: "b5",
      studentId: "out",
      lessonId: "l1",
      createdAt: "x",
      cancelled: true,
    },
  );
  const lesson = desiredItems(s, [], "giorgio", "https://crm.test").find(
    (i) => i.ref === "lesson:l1",
  );
  assert.deepEqual(lesson.attendees, ["a@example.com"]);
  // Cambiare gli ospiti cambia l’impronta: l’evento viene riscritto.
  const before = itemHash(lesson);
  assert.notEqual(before, itemHash({ ...lesson, attendees: [] }));
  // Le gare non hanno ospiti.
  assert.equal(
    desiredItems(s, [], "giorgio", "https://crm.test").find((i) =>
      i.ref.startsWith("race:"),
    ).attendees,
    undefined,
  );
});

test("la risincronizzazione completa riscrive anche ciò che sembra invariato", () => {
  const s = state();
  const items = desiredItems(s, [call], "giorgio", "https://crm.test");
  const window = { from: "2026-11-01T00:00:00Z", to: "2027-11-01T00:00:00Z" };
  const links = planSync(items, [], window).write.map((w) => ({
    ref: w.item.ref,
    googleEventId: `g-${w.item.ref}`,
    hash: w.hash,
  }));
  assert.equal(planSync(items, links, window).write.length, 0);
  const forced = planSync(items, links, window, true);
  assert.equal(forced.write.length, 4);
  assert.ok(forced.write.every((w) => w.googleEventId === `g-${w.item.ref}`));
});
