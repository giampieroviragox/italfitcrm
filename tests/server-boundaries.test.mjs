import test from "node:test";
import assert from "node:assert/strict";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
import { studentProjection } from "../src/modules/crm/student-portal-model.ts";
const student = (id) => ({
  id,
  firstName: "Nome",
  lastName: id,
  email: `${id}@example.com`,
  tierId: "online",
  status: "active",
  coach: "",
  tags: [],
  joinedAt: "2026-10-31",
  properties: {},
  notes: [],
  history: [],
});
const state = () => ({
  version: 1,
  students: [student("a"), student("b")],
  tiers: [{ id: "online", name: "Online", description: "", archived: false }],
  properties: [],
  admins: [
    {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    },
    {
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      status: "draft",
    },
  ],
});
const access = (role) => ({
  role,
  user_id: role,
  record_id: role,
  active: true,
  accepted_at: null,
});
test("server rejects hard removals, owner replacement and forged active admin creation", () => {
  const s = state();
  assert.throws(
    () => validateStaffUpdate(s, { ...s, students: [] }, access("owner")),
    /Archivia/,
  );
  assert.throws(
    () =>
      validateStaffUpdate(
        s,
        {
          ...s,
          admins: [
            { ...s.admins[0], role: "admin" },
            { ...s.admins[1], role: "owner" },
          ],
        },
        access("owner"),
      ),
    /proprietario/,
  );
  assert.throws(
    () =>
      validateStaffUpdate(
        s,
        {
          ...s,
          admins: [
            ...s.admins,
            {
              id: "intruder",
              name: "Intruder",
              email: "x@example.com",
              role: "admin",
              status: "active",
            },
          ],
        },
        access("owner"),
      ),
    /ruoli/,
  );
});
test("only owner can change admins; linked account emails cannot be changed through CRM", () => {
  const s = state();
  assert.throws(
    () =>
      validateStaffUpdate(
        s,
        { ...s, admins: s.admins.map((a) => ({ ...a, name: "Changed" })) },
        access("admin"),
      ),
    /proprietario/,
  );
  s.students[0].access = {
    status: "active",
    invitedAt: new Date().toISOString(),
  };
  const next = structuredClone(s);
  next.students[0].email = "other@example.com";
  assert.throws(() => validateStaffUpdate(s, next, access("owner")), /email/);
});
test("history and revisions come from server, existing notes cannot be overwritten", () => {
  const s = state();
  s.students[0].notes = [
    { id: "note", text: "Original", createdAt: new Date().toISOString() },
  ];
  const next = structuredClone(s);
  next.students[0].coach = "Coach";
  next.students[0].history = [
    { id: "forged", text: "Forged", createdAt: new Date().toISOString() },
  ];
  next.students[0].revision = 999;
  const saved = validateStaffUpdate(s, next, access("owner"));
  assert.equal(saved.students[0].revision, 1);
  assert.ok(!saved.students[0].history.some((x) => x.id === "forged"));
  const changed = structuredClone(s);
  changed.students[0].notes[0].text = "Rewritten";
  assert.throws(
    () => validateStaffUpdate(s, changed, access("owner")),
    /commenti/,
  );
});
test("student projection excludes other students, contacts, properties, notes, history and admin list", () => {
  const s = state();
  s.students[0].notes = [{ id: "n", text: "INTERNAL NOTE" }];
  s.students[0].properties = { private: "PRIVATE VALUE" };
  s.assignments = [
    { id: "own", studentId: "a", snapshot: { title: "OWN PLAN" } },
    { id: "other", studentId: "b", snapshot: { title: "OTHER PLAN" } },
  ];
  s.lessons = [{ id: "l", title: "Lesson", cancelled: false }];
  s.bookings = [{ id: "b1", studentId: "b", lessonId: "l", cancelled: false }];
  const data = studentProjection(s, "a");
  const json = JSON.stringify(data);
  assert.equal(data.assignments.length, 1);
  assert.equal(data.lessons[0].occupied, 1);
  assert.equal(data.lessons[0].enrolled, false);
  for (const forbidden of [
    "INTERNAL NOTE",
    "PRIVATE VALUE",
    "OTHER PLAN",
    "owner@example.com",
    "b@example.com",
  ])
    assert.ok(!json.includes(forbidden));
  assert.deepEqual(Object.keys(data.student).sort(), [
    "firstName",
    "id",
    "lastName",
    "status",
  ]);
  assert.throws(() => studentProjection(s, "missing"));
});

test("server attaches actor information to new notes and activities", () => {
  const s = state();
  const next = structuredClone(s);
  next.students[0].notes.push({
    id: "client-id",
    text: "New note",
    createdAt: "2000-01-01T00:00:00Z",
  });
  const saved = validateStaffUpdate(s, next, access("owner"));
  assert.equal(saved.students[0].notes[0].actorName, "Owner");
  assert.equal(saved.students[0].history[0].actorName, "Owner");
  assert.notEqual(saved.students[0].notes[0].id, "client-id");
});

test("student refresh payload rejects malformed responses before render", async () => {
  const { parseStudentPortalData } =
    await import("../src/modules/crm/student-portal-model.ts");
  const valid = studentProjection(state(), "a");
  assert.deepEqual(parseStudentPortalData(valid), valid);
  for (const malformed of [
    null,
    [],
    {},
    { ...valid, lessons: [null] },
    { ...valid, student: null },
    { ...valid, assignments: [{ snapshot: {} }] },
  ]) {
    assert.throws(() => parseStudentPortalData(malformed), /non validi/);
  }
});

test("students retain visibility of their cancelled lessons without other students’ bookings", () => {
  const s = state();
  s.lessons = [
    { id: "own-cancelled", cancelled: true },
    { id: "other-cancelled", cancelled: true },
  ];
  s.bookings = [
    { id: "own", studentId: "a", lessonId: "own-cancelled", cancelled: true },
    {
      id: "other",
      studentId: "b",
      lessonId: "other-cancelled",
      cancelled: false,
    },
  ];
  const data = studentProjection(s, "a");
  assert.deepEqual(
    data.lessons.map((l) => l.id),
    ["own-cancelled"],
  );
  assert.equal(data.lessons[0].enrolled, false);
});
