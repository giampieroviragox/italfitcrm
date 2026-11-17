import test from "node:test";
import assert from "node:assert/strict";
import {
  accessEmail,
  emailReadiness,
  sendAccessEmail,
} from "../src/modules/crm/server/access-email.ts";
const config = {
  apiKey: "test-key",
  from: "accessi@example.com",
  appUrl: "https://italfit.example.com",
};
const link =
  config.appUrl + "/invito?token_hash=" + "a".repeat(64) + "&type=invite";
test("email requires a public HTTPS origin and an explicit sender", () => {
  assert.equal(emailReadiness(config), "");
  for (const patch of [
    { apiKey: "" },
    { from: "" },
    { from: "a\r\nBcc:other@example.com" },
    { appUrl: "http://127.0.0.1:3000" },
    { appUrl: "not a URL" },
  ])
    assert.ok(emailReadiness({ ...config, ...patch }));
});
test("email escapes recipient-controlled markup and contains HTML and plain text", () => {
  const message = accessEmail("<img src=x onerror=alert(1)>", link);
  assert.ok(!message.html.includes("<img"));
  assert.match(message.html, /&lt;img/);
  assert.match(message.html, /&amp;type=invite/);
  assert.match(message.text, /https:\/\//);
});
test("Resend request has private auth, bounded wait, explicit recipient and stable idempotency", async () => {
  const sent = [];
  const fetcher = async (url, init) => {
    sent.push({ url, ...init });
    return Response.json({ id: "email-id" });
  };
  assert.equal(
    await sendAccessEmail(
      config,
      "student@example.com",
      "Student",
      link,
      fetcher,
    ),
    "email-id",
  );
  await sendAccessEmail(
    config,
    "student@example.com",
    "Student",
    link,
    fetcher,
  );
  assert.equal(
    sent[0].headers["Idempotency-Key"],
    sent[1].headers["Idempotency-Key"],
  );
  assert.equal(sent[0].headers.Authorization, "Bearer test-key");
  assert.ok(sent[0].signal);
  assert.deepEqual(JSON.parse(sent[0].body).to, ["student@example.com"]);
});
test("provider failure is not reported as success and no send occurs for an untrusted link", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return Response.json({ message: "not verified" }, { status: 403 });
  };
  await assert.rejects(
    sendAccessEmail(config, "student@example.com", "Student", link, fetcher),
    /non ha confermato/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    sendAccessEmail(
      config,
      "student@example.com",
      "Student",
      "https://evil.example/invito",
      fetcher,
    ),
    /non valido/,
  );
  assert.equal(calls, 1);
});

test("first invite, renewed invite and recovery have distinct copy and preserve the confirmation link", async () => {
  const { recoveryEmailTemplate } =
    await import("../src/modules/auth/email-template.ts");
  const { readFileSync } = await import("node:fs");
  const recovery = recoveryEmailTemplate();
  const invite = accessEmail("Giulia", link);
  const renewed = accessEmail("Giulia", link, "reinvite");
  assert.equal(
    new Set([recovery.subject, invite.subject, renewed.subject]).size,
    3,
  );
  assert.match(invite.html, /Attiva il tuo accesso/);
  assert.match(renewed.html, /Torna nel tuo account/);
  const href =
    "{{ .SiteURL }}/invito?token_hash={{ .TokenHash }}&amp;type=recovery";
  assert.ok(recovery.html.includes(`href="${href}"`));
  const deployable = readFileSync(
    new URL("../supabase/templates/recovery.html", import.meta.url),
    "utf8",
  );
  assert.ok(deployable.includes(`href="${href}"`));
  assert.ok(deployable.includes(recovery.subject));
});
