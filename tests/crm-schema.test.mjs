import test from "node:test";
import assert from "node:assert/strict";
import { isCrmState } from "../src/modules/crm/schema.ts";
import { defaultDirectory } from "../src/modules/crm/model.ts";
const state = () => ({
  version: 1,
  students: [],
  tiers: [],
  properties: [],
  admins: [
    {
      id: "owner",
      name: "Admin",
      email: "admin@example.com",
      role: "owner",
      status: "active",
    },
  ],
});
test("i payload precedenti senza viste o cronologia restano compatibili", () =>
  assert.equal(isCrmState(state()), true));
test("configurazioni di vista malformate vengono respinte prima del render", () => {
  assert.equal(
    isCrmState({
      ...state(),
      directory: { ...defaultDirectory, columns: null },
    }),
    false,
  );
  assert.equal(
    isCrmState({
      ...state(),
      directory: { ...defaultDirectory, pageSize: "25" },
    }),
    false,
  );
  assert.equal(
    isCrmState({ ...state(), views: [{ id: "v", name: "Test", config: {} }] }),
    false,
  );
});
test("non si accettano ID vuoti o duplicati, ruoli inventati o proprietario assente", () => {
  assert.equal(
    isCrmState({ ...state(), admins: [{ ...state().admins[0], id: "" }] }),
    false,
  );
  assert.equal(
    isCrmState({ ...state(), admins: [...state().admins, ...state().admins] }),
    false,
  );
  assert.equal(
    isCrmState({
      ...state(),
      admins: [{ ...state().admins[0], role: "superuser" }],
    }),
    false,
  );
});
test("viste complete sono serializzabili e rileggibili senza perdere booleani o ordinamento", () => {
  const next = {
    ...state(),
    directory: { ...defaultDirectory, archived: true, sortDirection: "asc" },
    views: [
      {
        id: "v",
        name: "Archivio",
        config: { ...defaultDirectory, archived: true },
      },
    ],
  };
  assert.equal(isCrmState(JSON.parse(JSON.stringify(next))), true);
});
