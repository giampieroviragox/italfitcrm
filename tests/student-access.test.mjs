import test from "node:test";
import assert from "node:assert/strict";
import {
  setStudentAccess,
  studentAccessEnabled,
  studentAccessLabel,
} from "../src/modules/crm/student-access.ts";
import { validateStaffUpdate } from "../src/modules/crm/server/validation.ts";
import { isCrmState } from "../src/modules/crm/schema.ts";
const fixture = () => ({
  version: 1,
  students: [
    {
      id: "test-student",
      firstName: "Test",
      lastName: "Accesso",
      email: "test-student@example.com",
      tierId: "tier",
      status: "active",
      joinedAt: "2026-11-02",
      coach: "",
      properties: {},
      revision: 0,
      access: { status: "active", invitedAt: "2026-11-02T00:00:00Z" },
    },
  ],
  admins: [
    {
      id: "admin",
      name: "Test Admin",
      email: "admin@example.com",
      role: "owner",
      status: "active",
    },
  ],
  tiers: [{ id: "tier", name: "Tier", description: "", archived: false }],
  properties: [],
});
const staff = {
  role: "owner",
  user_id: "test-owner",
  record_id: "admin",
  active: true,
  accepted_at: "2026-11-02T00:00:00Z",
};
test("accesso attivabile e disattivabile più volte senza alterare identità, tier, stato e credenziali", () => {
  let current = fixture();
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const enabled of [false, true]) {
      const original = current.students[0];
      current = validateStaffUpdate(
        current,
        setStudentAccess(current, original, enabled),
        staff,
      );
      assert.equal(studentAccessEnabled(current.students[0]), enabled);
      assert.equal(current.students[0].tierId, "tier");
      assert.equal(current.students[0].status, "active");
      assert.equal(current.students[0].email, "test-student@example.com");
      assert.equal(
        current.students[0].access.invitedAt,
        original.access.invitedAt,
      );
      assert.equal(current.students[0].revision, original.revision + 1);
      assert.equal(current.students[0].history.at(-1).actorId, "admin");
      assert.match(
        current.students[0].history.at(-1).text,
        enabled ? /riattivato/ : /disattivato/,
      );
    }
  }
});
test("un salvataggio di altre informazioni non riattiva un accesso disabilitato", () => {
  const before = fixture();
  const disabled = validateStaffUpdate(
    before,
    setStudentAccess(before, before.students[0], false),
    staff,
  );
  const unrelated = structuredClone(disabled);
  unrelated.students[0].coach = "Test Coach";
  const saved = validateStaffUpdate(disabled, unrelated, staff);
  assert.equal(studentAccessEnabled(saved.students[0]), false);
  assert.equal(studentAccessLabel(saved.students[0]), "Disattivato");
});
test("il controllo richiede una scheda aggiornata e un account collegato", () => {
  const state = fixture();
  assert.throws(
    () => setStudentAccess(state, { ...state.students[0], revision: 2 }, false),
    /scheda è cambiata/,
  );
  const unlinked = fixture();
  unlinked.students[0].access = null;
  assert.throws(
    () => setStudentAccess(unlinked, unlinked.students[0], true),
    /link personale/,
  );
  assert.equal(studentAccessLabel(unlinked.students[0]), "Non attivato");
  state.students[0].archived = true;
  assert.throws(
    () => setStudentAccess(state, state.students[0], true),
    /non è disponibile/,
  );
});
test("l’accesso derivato non può essere falsificato dal client e i flag malformati sono rifiutati", () => {
  const before = fixture();
  const proposed = setStudentAccess(before, before.students[0], false);
  proposed.students[0].access.enabled = true;
  const saved = validateStaffUpdate(before, proposed, staff);
  assert.equal(studentAccessEnabled(saved.students[0]), false);
  const malformed = fixture();
  malformed.students[0].accessDisabled = "false";
  assert.equal(isCrmState(malformed), false);
});
test("i campi predefiniti rimossi restano assenti dalle viste e il nome è riutilizzabile dall’admin", () => {
  const current = fixture();
  current.properties = [
    {
      id: "legacy",
      name: "Obiettivo",
      type: "text",
      group: "Allenamento",
      description: "",
      required: false,
      options: [],
      archived: true,
      deleted: true,
    },
  ];
  const next = structuredClone(current);
  next.properties.push({
    ...next.properties[0],
    id: "new-explicit-field",
    archived: false,
    deleted: false,
  });
  assert.ok(isCrmState(validateStaffUpdate(current, next, staff)));
  next.properties[0].archived = false;
  assert.throws(() => validateStaffUpdate(current, next, staff), /rimossa/);
});
