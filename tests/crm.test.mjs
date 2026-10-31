import test from "node:test";
import assert from "node:assert/strict";
import { validPropertyValue, displayValue } from "../src/modules/crm/model.ts";
const property = (type, required = false) => ({
  id: "test",
  name: "Test",
  type,
  description: "",
  group: "Generale",
  required,
  options: ["Forza", "Mobilità"],
  archived: false,
});
test("i booleani obbligatori accettano No, ma non un valore non impostato", () => {
  assert.equal(validPropertyValue(property("boolean", true), false), true);
  assert.equal(validPropertyValue(property("boolean", true), ""), false);
});
test("i campi multipli accettano solo opzioni definite e richiedono almeno una scelta quando obbligatori", () => {
  assert.equal(
    validPropertyValue(property("multiselect", true), ["Forza"]),
    true,
  );
  assert.equal(validPropertyValue(property("multiselect", true), []), false);
  assert.equal(
    validPropertyValue(property("multiselect"), ["Sconosciuta"]),
    false,
  );
});
test("link ed email vengono validati, inclusi protocolli non consentiti", () => {
  assert.equal(
    validPropertyValue(property("url"), "https://example.com"),
    true,
  );
  assert.equal(
    validPropertyValue(property("url"), "javascript:alert(1)"),
    false,
  );
  assert.equal(validPropertyValue(property("url"), "ftp://example.com"), false);
  assert.equal(validPropertyValue(property("email"), "non-valida"), false);
  assert.equal(validPropertyValue(property("email"), "test@example.com"), true);
});
test("numeri finiti, zero e campi opzionali", () => {
  assert.equal(validPropertyValue(property("number", true), 0), true);
  assert.equal(validPropertyValue(property("number"), Infinity), false);
  assert.equal(validPropertyValue(property("text"), undefined), true);
  assert.equal(validPropertyValue(property("text", true), ""), false);
});
test("le scelte singole devono essere presenti tra le opzioni", () => {
  for (const type of ["select", "radio"]) {
    assert.equal(validPropertyValue(property(type), "Forza"), true);
    assert.equal(validPropertyValue(property(type), "Altro"), false);
  }
});
test("visualizzazione coerente di valori vuoti, falsi, zero e liste", () => {
  assert.equal(displayValue(false), "No");
  assert.equal(displayValue(0), "0");
  assert.equal(displayValue([]), "—");
  assert.equal(displayValue(["Forza", "Mobilità"]), "Forza, Mobilità");
});

test("i formati delle proprietà rispettano lingua italiana e valori falsi", async () => {
  const { formatPropertyValue } = await import("../src/modules/crm/model.ts");
  assert.equal(formatPropertyValue(property("number"), 1234.5), "1.234,5");
  assert.equal(
    formatPropertyValue(property("date"), "2026-10-31"),
    "31 ott 2026",
  );
  assert.equal(formatPropertyValue(property("boolean"), false), "No");
});
