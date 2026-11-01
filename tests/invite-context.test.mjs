import test from "node:test";
import assert from "node:assert/strict";
import { signInvite, readInvite } from "../src/modules/auth/invite-context.ts";
const secret = "technical-test-secret";
const context = {
  email: "student@example.com",
  token_hash: "a".repeat(64),
  type: "invite",
};
test("invitation and reinvitation preserve the fixed email and token", () => {
  for (const type of ["invite", "recovery"]) {
    const data = { ...context, type };
    assert.deepEqual(readInvite(signInvite(data, secret), secret), data);
  }
});
test("email, type and token cannot be substituted in an invitation", () => {
  const signed = signInvite(context, secret);
  const signature = signed.split(".")[1];
  for (const patch of [
    { email: "other@example.com" },
    { type: "recovery" },
    { token_hash: "b".repeat(64) },
  ]) {
    const payload = Buffer.from(
      JSON.stringify({ ...context, ...patch }),
    ).toString("base64url");
    assert.equal(readInvite(payload + "." + signature, secret), null);
  }
  assert.equal(readInvite(signed, "wrong-key"), null);
  assert.equal(readInvite(signed + ".extra", secret), null);
  assert.equal(readInvite("invalid", secret), null);
  assert.equal(readInvite(signed, ""), null);
});
test("malformed signed contexts are rejected", () => {
  for (const patch of [
    { email: "" },
    { type: "signup" },
    { token_hash: "short" },
  ])
    assert.equal(
      readInvite(signInvite({ ...context, ...patch }, secret), secret),
      null,
    );
});
