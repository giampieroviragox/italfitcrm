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
