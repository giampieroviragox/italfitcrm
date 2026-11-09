import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedOAuthRedirect,
  safeLoginNext,
  validAuthorizationId,
} from "../src/modules/auth/oauth-consent.ts";

test("only Claude callbacks receive codes in production", () => {
  assert.ok(
    allowedOAuthRedirect("https://claude.ai/api/mcp/auth_callback", false),
  );
  assert.ok(
    allowedOAuthRedirect("https://claude.com/api/mcp/auth_callback", false),
  );
  for (const uri of [
    "http://claude.ai/api/mcp/auth_callback",
    "https://claude.ai.evil.com/api/mcp/auth_callback",
    "https://evil.com/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/other",
    "https://user@claude.ai/api/mcp/auth_callback",
    "http://127.0.0.1:3999/callback",
    "not a url",
  ])
    assert.equal(allowedOAuthRedirect(uri, false), false, uri);
});

test("loopback redirects are accepted only in development", () => {
  assert.ok(allowedOAuthRedirect("http://127.0.0.1:3999/callback", true));
  assert.ok(allowedOAuthRedirect("http://localhost:6274/oauth/callback", true));
  assert.equal(allowedOAuthRedirect("https://evil.com/cb", true), false);
});

test("login only returns to the consent page", () => {
  assert.equal(
    safeLoginNext("/oauth/consenso?authorization_id=abc12345"),
    "/oauth/consenso?authorization_id=abc12345",
  );
  for (const next of [
    "https://evil.com/oauth/consenso?authorization_id=abc12345",
    "//evil.com/oauth/consenso?authorization_id=abc12345",
    "/oauth/consenso?authorization_id=x",
    "/admin",
    "/oauth/consenso/../../admin?authorization_id=abc12345",
    undefined,
    ["/oauth/consenso?authorization_id=abc12345"],
  ])
    assert.equal(safeLoginNext(next), null, String(next));
  assert.equal(validAuthorizationId("abc12345"), true);
  assert.equal(validAuthorizationId("abc 12345"), false);
});
