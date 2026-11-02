import test from "node:test";
import assert from "node:assert/strict";
import {
  assignedStudentCoach,
  validCoachImage,
} from "../src/modules/crm/student-coach.ts";
import {
  studentProjection,
  parseStudentPortalData,
} from "../src/modules/crm/student-portal-model.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
const state = () => ({
  version: 1,
  students: [
    {
      id: "s",
      firstName: "Test",
      lastName: "Studente",
      email: "s@example.com",
      tierId: "online",
      status: "active",
      joinedAt: "2026-11-01",
      coach: "Coach assegnato",
      properties: {},
    },
  ],
  admins: [
    {
      id: "owner",
      name: "Coach assegnato",
      email: "private@example.com",
      role: "owner",
      status: "active",
      avatarUrl: "https://example.com/coach.jpg",
    },
    {
      id: "other",
      name: "Altro coach",
      email: "other@example.com",
      role: "admin",
      status: "active",
      avatarUrl: "https://example.com/other.jpg",
    },
  ],
  properties: [],
  tiers: [
    {
      id: "online",
      name: "Online",
      description: "",
      archived: false,
      entitlements: { plans: true, lessons: false, monthlyBookingLimit: null },
    },
  ],
});
test("la vista studente mostra soltanto nome e foto del coach assegnato", () => {
  const s = state(),
    data = studentProjection(s, "s");
  assert.deepEqual(data.coach, {
    name: "Coach assegnato",
    avatarUrl: "https://example.com/coach.jpg",
  });
  assert.equal("email" in data.coach, false);
  assert.equal(JSON.stringify(data).includes("other.jpg"), false);
  assert.equal(parseStudentPortalData(data), data);
  s.students[0].coach = "Altro coach";
  assert.equal(
    studentProjection(s, "s").coach.avatarUrl,
    "https://example.com/other.jpg",
  );
});
test("nessun ritratto viene inventato se coach o corrispondenza sono assenti o ambigui", () => {
  const s = state();
  s.students[0].coach = "";
  assert.equal(assignedStudentCoach(s, s.students[0]), undefined);
  s.students[0].coach = "Coach esterno";
  assert.deepEqual(assignedStudentCoach(s, s.students[0]), {
    name: "Coach esterno",
  });
  s.students[0].coach = " coach ASSEGNATO ";
  assert.equal(
    assignedStudentCoach(s, s.students[0]).avatarUrl,
    "https://example.com/coach.jpg",
  );
  s.admins.push({ ...s.admins[1], name: "Coach assegnato" });
  assert.equal(assignedStudentCoach(s, s.students[0]).avatarUrl, undefined);
});
test("URL foto e payload del coach sono validati", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/png;base64,x",
    "//example.com/a.jpg",
    "http://example.com/a.jpg",
    null,
    22,
  ])
    assert.equal(validCoachImage(url), false);
  assert.equal(validCoachImage("/coaches/photo.jpg"), true);
  const d = studentProjection(state(), "s");
  d.coach.avatarUrl = "javascript:alert(1)";
  assert.throws(() => parseStudentPortalData(d), /non validi/);
});
test("la foto del team rispetta gli stessi permessi dei dati amministratore", () => {
  const s = state(),
    proposed = structuredClone(s);
  proposed.admins[0].avatarUrl = "https://example.com/new.jpg";
  assert.throws(
    () =>
      validateStaffUpdate(s, proposed, { role: "admin", record_id: "other" }),
    /Solo il proprietario/,
  );
  assert.equal(
    validateStaffUpdate(s, proposed, { role: "owner", record_id: "owner" })
      .admins[0].avatarUrl,
    "https://example.com/new.jpg",
  );
});
