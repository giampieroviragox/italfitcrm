import test from "node:test";
import assert from "node:assert/strict";
import { createRemoteStore } from "../src/modules/crm/remote-adapter.ts";
import { defaultDirectory } from "../src/modules/crm/model.ts";
import { requestJson } from "../src/lib/request-json.ts";
const state = (query = "") => ({
  version: 1,
  students: [],
  properties: [],
  tiers: [],
  admins: [
    {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    },
  ],
  directory: { ...defaultDirectory, query },
});
const envelope = (revision = 1, query = "") => ({
  revision,
  state: state(query),
});
const response = (data, status = 200) => Response.json(data, { status });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const change = (query) => (s) => ({
  ...s,
  directory: { ...s.directory, query },
});

test("refresh started during a write waits and cannot roll back its result", async () => {
  const write = deferred(),
    started = deferred(),
    calls = [];
  const store = createRemoteStore(envelope(), null, async (_, init) => {
    calls.push(init.method ?? "GET");
    started.resolve();
    return init.method === "POST"
      ? write.promise
      : response(envelope(2, "saved"));
  });
  const saving = store.update(change("saved"));
  const reading = store.refresh();
  await started.promise;
  assert.deepEqual(calls, ["POST"]);
  write.resolve(response(envelope(2, "saved")));
  await Promise.all([saving, reading]);
  assert.deepEqual(calls, ["POST", "GET"]);
  assert.equal(store.snapshot().directory.query, "saved");
  assert.equal(store.pending(), false);
});

test("a write waits for the current read and uses its fresh revision", async () => {
  const read = deferred();
  let body;
  const store = createRemoteStore(envelope(), null, async (_, init) => {
    if (!init.method) return read.promise;
    body = JSON.parse(init.body);
    return response(envelope(3, body.state.directory.query));
  });
  const reading = store.refresh(),
    saving = store.update(change("new"));
  read.resolve(response(envelope(2, "other")));
  await Promise.all([reading, saving]);
  assert.equal(body.revision, 2);
  assert.equal(store.snapshot().directory.query, "new");
});

test("focus and visibility refreshes are deduplicated", async () => {
  const read = deferred();
  let count = 0;
  const store = createRemoteStore(envelope(), null, async () => {
    count++;
    return read.promise;
  });
  const a = store.refresh(),
    b = store.refresh();
  assert.equal(a, b);
  read.resolve(response(envelope()));
  await Promise.all([a, b]);
  assert.equal(count, 1);
  assert.equal(store.status().refreshing, false);
});

test("409 refreshes state without replaying the rejected mutation", async () => {
  const calls = [];
  const store = createRemoteStore(envelope(), null, async (_, init) => {
    calls.push(init.method ?? "GET");
    return init.method === "POST"
      ? response({ error: "Conflitto" }, 409)
      : response(envelope(2, "other"));
  });
  await assert.rejects(store.update(change("mine")), /Conflitto/);
  assert.deepEqual(calls, ["POST", "GET"]);
  assert.equal(store.snapshot().directory.query, "other");
  assert.equal(store.error(), "Conflitto");
});

test("uncertain network result blocks further writes until an explicit successful read", async () => {
  let calls = 0;
  const store = createRemoteStore(envelope(), null, async (_, init) => {
    calls++;
    if (init.method === "POST") throw new TypeError("Network failure");
    return response(envelope(2, "actually saved"));
  });
  await assert.rejects(store.update(change("mine")), /Connessione/);
  assert.equal(store.status().requiresRefresh, true);
  await assert.rejects(store.update(change("again")), /Aggiorna/);
  assert.equal(calls, 1);
  await store.refresh();
  assert.equal(store.snapshot().directory.query, "actually saved");
  assert.equal(store.status().requiresRefresh, false);
  assert.equal(store.error(), "");
});

test("offline saves fail immediately and do not discard the last confirmed snapshot", async () => {
  let calls = 0;
  const store = createRemoteStore(envelope(), null, async () => {
    calls++;
    return response(envelope());
  });
  store.setOnline(false);
  await assert.rejects(store.update(change("draft")), /offline/);
  assert.equal(calls, 0);
  assert.equal(store.snapshot().directory.query, "");
  assert.equal(store.pending(), false);
});

test("an obsolete read is rejected without replacing a newer snapshot", async () => {
  const store = createRemoteStore(envelope(3, "latest"), null, async () =>
    response(envelope(2, "old")),
  );
  await assert.rejects(store.refresh(), /non aggiornati/);
  assert.equal(store.snapshot().directory.query, "latest");
  assert.ok(store.error());
});

test("validation errors do not poison the next queued operation", async () => {
  const store = createRemoteStore(envelope(), null, async (_, init) =>
    response(envelope(2, JSON.parse(init.body).state.directory.query)),
  );
  await assert.rejects(
    store.update(() => {
      throw new Error("Campo non valido");
    }),
    /Campo/,
  );
  await store.update(change("valid"));
  assert.equal(store.snapshot().directory.query, "valid");
  assert.equal(store.error(), "");
});

test("expired sessions produce an actionable authentication state", async () => {
  const store = createRemoteStore(envelope(), null, async () =>
    response({ error: "Denied" }, 401),
  );
  await assert.rejects(store.refresh(), /sessione è scaduta/);
  assert.equal(store.status().authRequired, true);
});

test("requests time out, never retry and normalize unreadable responses", async () => {
  let calls = 0;
  await assert.rejects(
    requestJson(
      "/test",
      {},
      (_, init) => {
        calls++;
        return new Promise((_, reject) =>
          init.signal.addEventListener(
            "abort",
            () => reject(new Error("Abort")),
            { once: true },
          ),
        );
      },
      10,
    ),
    /troppo tempo/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    requestJson(
      "/test",
      {},
      async () => new Response("<html>gateway</html>", { status: 502 }),
    ),
    /servizio non ha risposto/,
  );
});
