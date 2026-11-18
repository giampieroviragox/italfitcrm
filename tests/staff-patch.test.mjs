import test from "node:test";
import assert from "node:assert/strict";
import { stageStaffPatch } from "../src/modules/crm/server/staff-patch.ts";
import { buildPatch } from "../src/modules/crm/sync.ts";
import { mutationState } from "../src/modules/crm/mutation.ts";
import { projectState, staffScope } from "../src/modules/crm/permissions.ts";

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
const wallet = {
  credits: [],
  lessons: [
    {
      id: "manual-1",
      title: "1:1",
      startsAt: "2026-11-10T17:00:00.000Z",
      minutes: 60,
      price: 7000,
      venue: "milano",
      participants: 1,
      payments: [],
    },
  ],
};
const envelope = () => ({
  revision: 10,
  versions: {
    tiers: { t: 1 },
    admins: { giorgio: 2, marta: 3 },
    students: { anna: 5, luca: 6, sara: 7 },
    plans: { plan: 1 },
    assignments: { "p-sara": 1 },
    properties: {},
    lessons: {},
    bookings: {},
  },
  state: {
    version: 1,
    tiers: [{ id: "t", name: "T", description: "", archived: false }],
    properties: [],
    admins: [
      {
        id: "giorgio",
        name: "Giorgio Galbiati",
        email: "g@example.com",
        role: "owner",
        status: "active",
      },
      {
        id: "marta",
        name: "Marta",
        email: "m@example.com",
        role: "admin",
        status: "active",
        teamRole: "coach",
      },
    ],
    students: [
      student("anna", { coach: "Marta", lessonWallet: wallet }),
      student("luca", { coach: "Marta" }),
      student("sara", { lessonWallet: wallet }),
    ],
    plans: [
      {
        id: "plan",
        title: "Forza",
        description: "",
        status: "published",
        sessions: [
          {
            id: "s",
            name: "A",
            exercises: [
              {
                id: "e",
                name: "Squat",
                sets: 3,
                reps: "5",
                restSeconds: 60,
                notes: "",
              },
            ],
          },
        ],
      },
    ],
    assignments: [
      {
        id: "p-sara",
        studentId: "sara",
        planId: "plan",
        month: "2026-11",
        createdAt: "2026-11-01T10:00:00.000Z",
        snapshot: {
          title: "Forza",
          description: "",
          sessions: [
            {
              id: "s",
              name: "A",
              exercises: [
                {
                  id: "e",
                  name: "Squat",
                  sets: 3,
                  reps: "5",
                  restSeconds: 60,
                  notes: "",
                },
              ],
            },
          ],
        },
      },
    ],
  },
});
/** What the browser does: change its view, send only the difference. */
const browserPatch = (e, adminId, change) => {
  const scope = staffScope(e.state, adminId);
  const view = projectState(e.state, scope);
  const proposed = structuredClone(view);
  change(proposed);
  return buildPatch(
    mutationState(view, view),
    mutationState(view, proposed),
    e.versions,
  );
};
const owner = { role: "owner", record_id: "giorgio" };
const coach = { role: "admin", record_id: "marta" };

test("il proprietario cambia uno studente: viene scritto solo quel record, con wallet e dati protetti intatti", () => {
  const e = envelope();
  const patch = browserPatch(e, "giorgio", (s) => {
    s.students[2].lastName = "Rossi";
  });
  const { changes } = stageStaffPatch(e, patch, owner, projectState);
  assert.deepEqual(Object.keys(changes), ["students"]);
  assert.equal(changes.students.length, 1);
  assert.equal(changes.students[0].id, "sara");
  assert.equal(changes.students[0].expected, 7);
  assert.equal(changes.students[0].payload.lastName, "Rossi");
  assert.equal(changes.students[0].payload.lessonWallet.lessons.length, 1);
  assert.equal(changes.capacity, undefined);
});

test("un coach assegna un piano a un proprio studente: nascono solo l’assegnazione e le sue note di sistema", () => {
  const e = envelope();
  const patch = browserPatch(e, "marta", (s) => {
    s.assignments.push({
      ...e.state.assignments[0],
      id: "p-luca",
      studentId: "luca",
      month: "2026-12",
    });
  });
  const { changes } = stageStaffPatch(e, patch, coach, projectState);
  assert.deepEqual(
    changes.assignments.map((r) => [r.id, r.expected]),
    [["p-luca", null]],
  );
  // La cronologia dello studente si aggiorna sul suo record, senza toccare gli altri.
  assert.ok((changes.students ?? []).every((s) => s.id === "luca"));
});

test("un coach non può toccare studenti che non segue né le schede senza permesso", () => {
  const e = envelope();
  const hidden = browserPatch(e, "giorgio", (s) => {
    s.students[2].lastName = "Altrui";
  });
  assert.throws(
    () => stageStaffPatch(e, hidden, coach, projectState),
    /non segui/,
  );
  const own = browserPatch(e, "marta", (s) => {
    s.students[1].firstName = "Altro";
  });
  assert.throws(
    () => stageStaffPatch(e, own, coach, projectState),
    /schede studente/,
  );
});

test("solo il proprietario gestisce i membri del team", () => {
  const e = envelope();
  const patch = browserPatch(e, "giorgio", (s) => {
    s.admins[1].teamRole = "admin";
  });
  assert.throws(
    () => stageStaffPatch(e, patch, coach, projectState),
    /proprietario|permessi|non segui/,
  );
  const { changes } = stageStaffPatch(e, patch, owner, projectState);
  assert.deepEqual(
    changes.admins.map((a) => [a.id, a.expected]),
    [["marta", 3]],
  );
});

test("una versione vecchia è un conflitto solo per quel record", () => {
  const e = envelope();
  const patch = browserPatch(e, "giorgio", (s) => {
    s.students[2].lastName = "Rossi";
  });
  // Un altro ha cambiato Luca: nessun problema. Ha cambiato Sara: conflitto.
  const luca = {
    ...e,
    versions: { ...e.versions, students: { ...e.versions.students, luca: 99 } },
  };
  assert.doesNotThrow(() => stageStaffPatch(luca, patch, owner, projectState));
  const sara = {
    ...e,
    versions: { ...e.versions, students: { ...e.versions.students, sara: 8 } },
  };
  assert.throws(
    () => stageStaffPatch(sara, patch, owner, projectState),
    (error) => error.status === 409,
  );
});

test("una patch malformata o con record cancellati viene respinta", async () => {
  const { isPatch } = await import("../src/modules/crm/server/staff-patch.ts");
  assert.equal(
    isPatch({
      records: { students: [{ id: "a", base: 1, record: { id: "a" } }] },
    }),
    true,
  );
  assert.equal(
    isPatch({
      records: { students: [{ id: "a", base: 1, record: { id: "b" } }] },
    }),
    false,
  );
  assert.equal(isPatch({ records: { altro: [] } }), false);
  assert.equal(
    isPatch({
      records: { students: [{ id: "a", base: "1", record: { id: "a" } }] },
    }),
    false,
  );
  assert.equal(isPatch(null), false);
});
