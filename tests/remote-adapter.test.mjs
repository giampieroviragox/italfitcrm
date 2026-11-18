import test from "node:test";
import assert from "node:assert/strict";
import { createRemoteStore } from "../src/modules/crm/remote-adapter.ts";
import { defaultDirectory } from "../src/modules/crm/model.ts";
import { requestJson } from "../src/lib/request-json.ts";
const student = (id, extra = {}) => ({
  id,
  firstName: "TEST",
  lastName: id,
  email: `${id}@example.com`,
  tierId: "t",
  status: "active",
  coach: "",
  joinedAt: "2026-11-01",
  properties: {},
  ...extra,
});
const state = (query = "") => ({
  version: 1,
  students: [student("s1"), student("s2")],
  properties: [],
  tiers: [{ id: "t", name: "T", description: "", archived: false }],
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
  versions: {
    students: { s1: 4, s2: 7 },
    tiers: { t: 1 },
    admins: { owner: 1 },
  },
  state: state(query),
});
/** What the server answers to a read or a write: a delta. */
const delta = (revision = 1, query, upserts = {}, removed = []) => ({
  revision,
  delta: {
    upserts,
    removed,
    ...(query === undefined
      ? {}
      : { preferences: { directory: { ...defaultDirectory, query } } }),
  },
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
const rename = (id, lastName) => (s) => ({
  ...s,
  students: s.students.map((x) => (x.id === id ? { ...x, lastName } : x)),
});

test("refresh started during a write waits and cannot roll back its result", async () => {
  const write = deferred(),
    started = deferred(),
    calls = [];
  const store = createRemoteStore(envelope(), null, async (url, init) => {
    calls.push(`${init.method ?? "GET"} ${url}`);
    started.resolve();
    return init.method === "POST" ? write.promise : response(delta(2, "saved"));
  });
  const saving = store.update(change("saved"));
  const reading = store.refresh();
  await started.promise;
  assert.deepEqual(calls, ["POST /api/crm"]);
  write.resolve(response(delta(2, "saved")));
  await Promise.all([saving, reading]);
  assert.deepEqual(calls, ["POST /api/crm", "GET /api/crm?since=1"]);
  assert.equal(store.snapshot().directory.query, "saved");
  assert.equal(store.pending(), false);
});

test("a write waits for the current read and sends only what changed, with the versions it saw", async () => {
  const read = deferred();
  let body;
  const store = createRemoteStore(envelope(), null, async (_, init) => {
    if (!init.method) return read.promise;
    body = JSON.parse(init.body);
    return response(delta(3, "new"));
  });
  const reading = store.refresh(),
    saving = store.update(change("new"));
  read.resolve(response(delta(2, "other")));
  await Promise.all([reading, saving]);
  assert.deepEqual(Object.keys(body), ["patch"]);
  assert.deepEqual(body.patch.records, {});
  assert.equal(body.patch.preferences.directory.query, "new");
  assert.equal(store.snapshot().directory.query, "new");
});

test("only the changed record travels, with the version the browser has", async () => {
  let body;
  const store = createRemoteStore(envelope(), null, async (_, init) => {
    body = JSON.parse(init.body);
    return response(
      delta(2, undefined, {
        students: [{ id: "s2", v: 8, r: student("s2", { lastName: "Nuovo" }) }],
      }),
    );
  });
  await store.update(rename("s2", "Nuovo"));
  assert.deepEqual(
    body.patch.records.students.map((r) => [r.id, r.base]),
    [["s2", 7]],
  );
  assert.equal(body.patch.records.students[0].record.lastName, "Nuovo");
  assert.equal(
    store.snapshot().students.find((s) => s.id === "s2").lastName,
    "Nuovo",
  );
  // La seconda modifica parte dalla versione appena ricevuta.
  await store.update(rename("s2", "Ancora"));
  assert.equal(body.patch.records.students[0].base, 8);
  // Un'azione senza modifiche non genera richieste.
  let calls = 0;
  const quiet = createRemoteStore(envelope(), null, async () => {
    calls++;
    return response(delta());
  });
  await quiet.update((s) => s);
  assert.equal(calls, 0);
});

test("writes never move the read cursor: changes made by others in between still arrive", async () => {
  const urls = [];
  const store = createRemoteStore(envelope(5), null, async (url, init) => {
    urls.push(url);
    return init.method === "POST"
      ? response(delta(9, "mine"))
      : response(
          delta(9, undefined, {
            students: [
              { id: "s1", v: 5, r: student("s1", { lastName: "Altrui" }) },
            ],
          }),
        );
  });
  await store.update(change("mine"));
  await store.refresh();
  assert.deepEqual(urls, ["/api/crm", "/api/crm?since=5"]);
  assert.equal(
    store.snapshot().students.find((s) => s.id === "s1").lastName,
    "Altrui",
  );
  await store.refresh();
  assert.equal(urls.at(-1), "/api/crm?since=9");
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
  read.resolve(response(delta()));
  await Promise.all([a, b]);
  assert.equal(count, 1);
  assert.equal(store.status().refreshing, false);
});

test("409 refreshes state without replaying the rejected mutation", async () => {
  const calls = [];
  const store = createRemoteStore(envelope(), null, async (url, init) => {
    calls.push(`${init.method ?? "GET"} ${url}`);
    return init.method === "POST"
      ? response({ error: "Conflitto" }, 409)
      : response(delta(2, "other"));
  });
  await assert.rejects(store.update(change("mine")), /Conflitto/);
  assert.deepEqual(calls, ["POST /api/crm", "GET /api/crm?since=1"]);
  assert.equal(store.snapshot().directory.query, "other");
  assert.equal(store.error(), "Conflitto");
});

test("uncertain network result blocks further writes until an explicit successful read", async () => {
  let calls = 0;
  const store = createRemoteStore(envelope(), null, async (_, init) => {
    calls++;
    if (init.method === "POST") throw new TypeError("Network failure");
    return response(delta(2, "actually saved"));
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
    return response(delta());
  });
  store.setOnline(false);
  await assert.rejects(store.update(change("draft")), /offline/);
  assert.equal(calls, 0);
  assert.equal(store.snapshot().directory.query, "");
  assert.equal(store.pending(), false);
});

test("an obsolete read is rejected without replacing a newer snapshot", async () => {
  const store = createRemoteStore(envelope(3, "latest"), null, async () =>
    response(delta(2, "old")),
  );
  await assert.rejects(store.refresh(), /non aggiornati/);
  assert.equal(store.snapshot().directory.query, "latest");
  assert.ok(store.error());
});

test("validation errors do not poison the next queued operation", async () => {
  const store = createRemoteStore(envelope(), null, async (_, init) =>
    response(delta(2, JSON.parse(init.body).patch.preferences.directory.query)),
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

test("heavy student detail loads on demand, stays through list updates and goes stale when the student changes", async () => {
  const urls = [];
  const store = createRemoteStore(envelope(), null, async (url) => {
    urls.push(url);
    if (url.startsWith("/api/crm/studenti/"))
      return response({
        detail: {
          workoutEntries: [{ id: "w1", assignmentId: "a" }],
          notes: [{ id: "n1", text: "ciao", createdAt: "x" }],
          history: [{ id: "h1", text: "evento", createdAt: "x" }],
        },
      });
    return response(
      delta(2, undefined, {
        students: [
          { id: "s1", v: 5, r: student("s1", { lastName: "Cambiato" }) },
        ],
      }),
    );
  });
  assert.equal(store.detailStatus("s1"), "none");
  const loading = store.loadDetail("s1");
  assert.equal(store.detailStatus("s1"), "loading");
  await loading;
  assert.equal(store.detailStatus("s1"), "ready");
  const loaded = () => store.snapshot().students.find((s) => s.id === "s1");
  assert.equal(loaded().notes.length, 1);
  assert.equal(loaded().workoutEntries.length, 1);
  // Una seconda richiesta con i dati già pronti non va in rete.
  await store.loadDetail("s1");
  assert.equal(urls.filter((u) => u.includes("/studenti/")).length, 1);
  // Un aggiornamento leggero cambia lo studente: i dettagli restano ma sono da ricaricare.
  await store.refresh();
  assert.equal(loaded().lastName, "Cambiato");
  assert.equal(loaded().notes.length, 1);
  assert.equal(store.detailStatus("s1"), "stale");
  await store.loadDetail("s1");
  assert.equal(store.detailStatus("s1"), "ready");
  assert.equal(urls.filter((u) => u.includes("/studenti/")).length, 2);
  // Il dettaglio non viaggia mai in una modifica.
  let body;
  const writer = createRemoteStore(envelope(), null, async (_, init) => {
    body = JSON.parse(init.body);
    return response(delta(2));
  });
  await writer.update(rename("s1", "X"));
  assert.equal("notes" in body.patch.records.students[0].record, false);
  assert.equal("history" in body.patch.records.students[0].record, false);
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

test("comment writes send only student id and text, share the write queue and keep uncertain results blocked", async () => {
  const comment = deferred(),
    started = deferred(),
    calls = [];
  const store = createRemoteStore(envelope(), null, async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if (url === "/api/commenti") {
      started.resolve();
      return comment.promise;
    }
    return response(delta(3, "updated"));
  });
  const posting = store.comment("student", "Testo"),
    updating = store.update(change("updated"));
  await started.promise;
  assert.deepEqual(calls, [
    { url: "/api/commenti", body: { studentId: "student", text: "Testo" } },
  ]);
  comment.resolve(response(delta(2)));
  await Promise.all([posting, updating]);
  assert.equal(calls[1].url, "/api/crm");
  assert.equal(store.pending(), false);
  assert.equal(store.snapshot().directory.query, "updated");
  const failing = createRemoteStore(envelope(), null, async () => {
    throw new TypeError("Network");
  });
  await assert.rejects(failing.comment("student", "Testo"), /Connessione/);
  assert.equal(failing.status().requiresRefresh, true);
  await assert.rejects(failing.comment("student", "Testo"), /Aggiorna/);
});
