import type { CrmState, CrmStudent } from "./model.ts";
import { withAvailabilityCapacity } from "./availability-lessons.ts";

/**
 * Record-level sync. The state is a set of collections of records, each with
 * a version. Writes are patches (only changed records, each stating the
 * version it was based on); reads are deltas (only records that changed
 * since a revision). Nothing here touches the network or the database.
 */
export const collections = [
  "tiers",
  "properties",
  "admins",
  "plans",
  "lessons",
  "students",
  "assignments",
  "bookings",
] as const;
export type Collection = (typeof collections)[number];
export type Versions = Partial<Record<Collection, Record<string, number>>>;

type Preferences = Pick<CrmState, "views" | "directory" | "activeViewId">;
const preferenceKeys = ["views", "directory", "activeViewId"] as const;

/** Heavy, unbounded parts of a student, loaded only when a profile opens. */
export const detailKeys = ["workoutEntries", "notes", "history"] as const;
/** Kept inside the stored student payload, but not sent in the list. */
export const heavyPayloadKeys = ["workoutEntries"] as const;

export type Records = Record<string, { id: string }>;

/** JSON with sorted keys: equal records compare equal whatever their key order. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

const list = <K extends Exclude<Collection, never>>(
  state: CrmState,
  collection: K,
) => (state[collection] ?? []) as { id: string }[];

/** The list view of a student: no heavy detail. */
export function lightStudent(student: CrmStudent): CrmStudent {
  const { workoutEntries, notes, history, ...rest } = student;
  void workoutEntries;
  void notes;
  void history;
  return rest;
}
/**
 * A student's stored payload for comparison: the server stamps `revision: 0`
 * on records that never had one, which is not a change.
 */
function comparable(payload: Record<string, unknown>) {
  const { revision, ...rest } = payload;
  return revision ? { ...rest, revision } : rest;
}
/** Preferences as compared: an empty list of views equals none. */
const preference = (state: CrmState, key: (typeof preferenceKeys)[number]) =>
  key === "views" ? (state.views ?? []) : state[key];
/** What identifies a student record apart from audit rows and server data. */
function studentParts(student: CrmStudent) {
  const { properties, notes, history, access, workoutEntries, ...payload } =
    student;
  void access;
  return { payload, properties, notes, history, workoutEntries };
}

// ---------------------------------------------------------------- writes ---
export interface RecordWrite {
  id: string;
  /** Version this change is based on; null creates the record. */
  expected: number | null;
  payload: unknown;
}
export interface StudentWrite extends RecordWrite {
  properties?: CrmStudent["properties"];
  heavy?: Record<string, unknown>;
  notes?: unknown[];
  history?: unknown[];
}
export interface Changes {
  tiers?: RecordWrite[];
  properties?: RecordWrite[];
  admins?: RecordWrite[];
  plans?: RecordWrite[];
  lessons?: RecordWrite[];
  assignments?: RecordWrite[];
  bookings?: RecordWrite[];
  students?: StudentWrite[];
  removed?: { assignments?: string[]; plans?: string[] };
  /** Active bookings may not exceed `max` once the change is applied. */
  capacity?: { lesson: string; max: number }[];
  preferences?: Preferences;
}

export class ChangeError extends Error {}

const versionOf = (versions: Versions, collection: Collection, id: string) => {
  const version = versions[collection]?.[id];
  if (version === undefined)
    throw new ChangeError("Versione del record sconosciuta. Ricarica i dati.");
  return version;
};

/** Changes needed to go from `current` to `next`, based on the versions read with `current`. */
export function diffState(
  current: CrmState,
  next: CrmState,
  versions: Versions,
  removed: { assignments?: string[]; plans?: string[] } = {},
): Changes {
  const changes: Changes = {};
  for (const collection of collections) {
    if (collection === "students") continue;
    const before = new Map(list(current, collection).map((r) => [r.id, r]));
    const after = list(next, collection);
    const writes: RecordWrite[] = [];
    for (const record of after) {
      const old = before.get(record.id);
      // `access` is derived from the accounts table on the server.
      const payload =
        collection === "admins"
          ? (({ access, ...rest }) => (void access, rest))(
              record as Record<string, unknown> & { id: string },
            )
          : record;
      const oldPayload =
        collection === "admins" && old
          ? (({ access, ...rest }) => (void access, rest))(
              old as Record<string, unknown> & { id: string },
            )
          : old;
      if (old && canonical(payload) === canonical(oldPayload)) continue;
      writes.push({
        id: record.id,
        expected: old ? versionOf(versions, collection, record.id) : null,
        payload,
      });
    }
    if (writes.length) changes[collection] = writes;
    const gone = [...before.keys()].filter(
      (id) => !after.some((r) => r.id === id),
    );
    const allowed = removed[collection as "assignments" | "plans"] ?? [];
    if (gone.some((id) => !allowed.includes(id)))
      throw new ChangeError(
        "Archivia i record per conservarne i collegamenti.",
      );
  }

  const students: StudentWrite[] = [];
  const oldStudents = new Map(current.students.map((s) => [s.id, s]));
  for (const student of next.students) {
    const old = oldStudents.get(student.id);
    const now = studentParts(student);
    const write: StudentWrite = {
      id: student.id,
      expected: old ? versionOf(versions, "students", student.id) : null,
      payload: now.payload,
    };
    let changed = !old;
    if (old) {
      const before = studentParts(old);
      if (
        canonical(comparable(now.payload)) !==
        canonical(comparable(before.payload))
      )
        changed = true;
      if (
        canonical(now.properties ?? {}) !== canonical(before.properties ?? {})
      ) {
        write.properties = now.properties ?? {};
        changed = true;
      }
      const knownNotes = new Set((before.notes ?? []).map((n) => n.id));
      const newNotes = (now.notes ?? []).filter((n) => !knownNotes.has(n.id));
      if (newNotes.length) {
        write.notes = newNotes;
        changed = true;
      }
      const knownEvents = new Set((before.history ?? []).map((h) => h.id));
      const newEvents = (now.history ?? []).filter(
        (h) => !knownEvents.has(h.id),
      );
      if (newEvents.length) {
        write.history = newEvents;
        changed = true;
      }
      // Heavy data is written only when it was loaded to begin with.
      if (
        before.workoutEntries !== undefined &&
        now.workoutEntries !== undefined &&
        canonical(now.workoutEntries) !== canonical(before.workoutEntries)
      ) {
        write.heavy = { workoutEntries: now.workoutEntries };
        changed = true;
      }
    } else {
      write.properties = now.properties ?? {};
      if (now.notes?.length) write.notes = now.notes;
      if (now.history?.length) write.history = now.history;
      if (now.workoutEntries !== undefined)
        write.heavy = { workoutEntries: now.workoutEntries };
    }
    if (changed) students.push(write);
  }
  if (students.length) changes.students = students;

  const gone = current.students.filter(
    (s) => !next.students.some((x) => x.id === s.id),
  );
  if (gone.length)
    throw new ChangeError("Archivia i record per conservarne i collegamenti.");

  if (removed.assignments?.length || removed.plans?.length)
    changes.removed = {
      ...(removed.assignments?.length
        ? { assignments: removed.assignments }
        : {}),
      ...(removed.plans?.length ? { plans: removed.plans } : {}),
    };

  const activeBefore = activeBookings(current);
  const guards: { lesson: string; max: number }[] = [];
  for (const [lesson, count] of activeBookings(next)) {
    if (count <= (activeBefore.get(lesson) ?? 0)) continue;
    const saved = next.lessons?.find((l) => l.id === lesson);
    if (saved)
      guards.push({
        lesson,
        max: withAvailabilityCapacity(next, saved).capacity,
      });
  }
  if (guards.length) changes.capacity = guards;

  const preferences: Preferences = {};
  let preferencesChanged = false;
  for (const key of preferenceKeys)
    if (
      canonical(preference(current, key)) !== canonical(preference(next, key))
    )
      preferencesChanged = true;
  if (preferencesChanged) {
    for (const key of preferenceKeys)
      if (next[key] !== undefined)
        (preferences as Record<string, unknown>)[key] = next[key];
    changes.preferences = preferences;
  }
  return changes;
}

function activeBookings(state: CrmState) {
  const counts = new Map<string, number>();
  const cancelled = new Set(
    (state.lessons ?? []).filter((l) => l.cancelled).map((l) => l.id),
  );
  for (const booking of state.bookings ?? [])
    if (!booking.cancelled && !cancelled.has(booking.lessonId))
      counts.set(booking.lessonId, (counts.get(booking.lessonId) ?? 0) + 1);
  return counts;
}

export function hasChanges(changes: Changes) {
  return Object.keys(changes).length > 0;
}

/** Ids of the records a set of changes writes, per collection. */
export function changedIds(changes: Changes) {
  const ids: Partial<Record<Collection, string[]>> = {};
  for (const collection of collections) {
    const writes = changes[collection];
    if (writes?.length) ids[collection] = writes.map((w) => w.id);
  }
  return ids;
}

// --------------------------------------------------- patches from clients ---
export interface PatchRecord {
  id: string;
  /** Version the browser had; null for a new record. */
  base: number | null;
  record: unknown;
}
export interface Patch {
  records: Partial<Record<Collection, PatchRecord[]>>;
  preferences?: Preferences;
}

/** The browser's change as a patch: changed records only, with their base versions. */
export function buildPatch(
  base: CrmState,
  proposed: CrmState,
  versions: Versions,
): Patch {
  const patch: Patch = { records: {} };
  for (const collection of collections) {
    const before = new Map(list(base, collection).map((r) => [r.id, r]));
    const out: PatchRecord[] = [];
    for (const record of list(proposed, collection)) {
      const old = before.get(record.id);
      const a =
        collection === "students" ? lightStudent(record as CrmStudent) : record;
      const b =
        old && collection === "students"
          ? lightStudent(old as CrmStudent)
          : old;
      if (old && canonical(a) === canonical(b)) continue;
      out.push({
        id: record.id,
        base: old ? (versions[collection]?.[record.id] ?? null) : null,
        record: a,
      });
    }
    if (out.length) patch.records[collection] = out;
  }
  const preferences: Preferences = {};
  let changed = false;
  for (const key of preferenceKeys)
    if (
      canonical(preference(base, key)) !== canonical(preference(proposed, key))
    ) {
      changed = true;
      if (proposed[key] !== undefined)
        (preferences as Record<string, unknown>)[key] = proposed[key];
    }
  if (changed) patch.preferences = preferences;
  return patch;
}

/** Records in the patch whose base version is no longer the current one. */
export function staleRecords(patch: Patch, current: Versions) {
  const stale: { collection: Collection; id: string }[] = [];
  for (const collection of collections)
    for (const item of patch.records[collection] ?? [])
      if ((current[collection]?.[item.id] ?? null) !== item.base)
        stale.push({ collection, id: item.id });
  return stale;
}

/** Puts a patch on top of a state (what the browser proposed). */
export function applyPatch(state: CrmState, patch: Patch): CrmState {
  const next: CrmState = { ...state };
  for (const collection of collections) {
    const items = patch.records[collection];
    if (!items?.length) continue;
    const byId = new Map(items.map((i) => [i.id, i.record]));
    const existing = list(state, collection);
    const merged = existing.map((r) => (byId.has(r.id) ? byId.get(r.id)! : r));
    for (const item of items)
      if (!existing.some((r) => r.id === item.id))
        merged.push(item.record as never);
    (next as unknown as Record<string, unknown>)[collection] = merged;
  }
  if (patch.preferences) Object.assign(next, patch.preferences);
  return next;
}

// ---------------------------------------------------------------- deltas ---
export interface DeltaRecord {
  id: string;
  v: number;
  r: unknown;
}
export interface CrmDelta {
  upserts: Partial<Record<Collection, DeltaRecord[]>>;
  removed: { k: Collection; id: string }[];
  preferences?: Preferences;
}
export const emptyDelta = (): CrmDelta => ({ upserts: {}, removed: [] });
export const deltaIsEmpty = (delta: CrmDelta) =>
  !delta.removed.length &&
  !Object.values(delta.upserts).some((rows) => rows?.length) &&
  !delta.preferences;

/**
 * The records that differ between two states of the same viewer, with the
 * versions they now have. Used after a write, so the browser only receives
 * what its own change touched.
 */
export function deltaBetween(
  before: CrmState,
  after: CrmState,
  versions: Versions,
  hint?: Partial<Record<Collection, string[]>>,
): CrmDelta {
  const delta = emptyDelta();
  for (const collection of collections) {
    const old = new Map(list(before, collection).map((r) => [r.id, r]));
    const rows: DeltaRecord[] = [];
    const seen = new Set<string>();
    for (const record of list(after, collection)) {
      seen.add(record.id);
      const prior = old.get(record.id);
      const view =
        collection === "students" ? lightStudent(record as CrmStudent) : record;
      const priorView =
        prior && collection === "students"
          ? lightStudent(prior as CrmStudent)
          : prior;
      const touched = hint?.[collection]?.includes(record.id);
      if (!touched && prior && canonical(view) === canonical(priorView))
        continue;
      rows.push({
        id: record.id,
        v: versions[collection]?.[record.id] ?? 0,
        r: view,
      });
    }
    if (rows.length) delta.upserts[collection] = rows;
    for (const id of old.keys())
      if (!seen.has(id)) delta.removed.push({ k: collection, id });
  }
  const preferences: Preferences = {};
  let changed = false;
  for (const key of preferenceKeys)
    if (
      canonical(preference(before, key)) !== canonical(preference(after, key))
    ) {
      changed = true;
      if (after[key] !== undefined)
        (preferences as Record<string, unknown>)[key] = after[key];
    }
  if (changed) delta.preferences = preferences;
  return delta;
}

/** Merges a delta into a state, never going back to an older version. */
export function applyDelta(
  state: CrmState,
  versions: Versions,
  delta: CrmDelta,
): { state: CrmState; versions: Versions; changedStudents: string[] } {
  // Nothing new: keep the same objects, so nothing re-renders.
  const preferencesChanged =
    !!delta.preferences &&
    preferenceKeys.some(
      (key) =>
        key in delta.preferences! &&
        canonical(preference(state, key)) !==
          canonical(preference(delta.preferences as CrmState, key)),
    );
  if (
    !delta.removed.length &&
    !Object.values(delta.upserts).some((rows) => rows?.length) &&
    !preferencesChanged
  )
    return { state, versions, changedStudents: [] };
  const next: CrmState = { ...state };
  const nextVersions: Versions = { ...versions };
  const changedStudents: string[] = [];
  const removedStudents = new Set<string>();
  for (const { k, id } of delta.removed) {
    const known = (nextVersions[k] = { ...(nextVersions[k] ?? {}) });
    delete known[id];
    (next as unknown as Record<string, unknown>)[k] = list(next, k).filter(
      (r) => r.id !== id,
    );
    if (k === "students") removedStudents.add(id);
  }
  if (removedStudents.size) {
    // A student who leaves the viewer's scope takes their records with them.
    next.assignments = (next.assignments ?? []).filter(
      (a) => !removedStudents.has(a.studentId),
    );
    next.bookings = (next.bookings ?? []).filter(
      (b) => !removedStudents.has(b.studentId),
    );
  }
  for (const collection of collections) {
    const rows = delta.upserts[collection];
    if (!rows?.length) continue;
    const known = (nextVersions[collection] = {
      ...(nextVersions[collection] ?? {}),
    });
    const current = new Map(list(next, collection).map((r) => [r.id, r]));
    for (const row of rows) {
      if ((known[row.id] ?? -1) > row.v) continue;
      known[row.id] = row.v;
      let record = row.r as { id: string };
      if (collection === "students") {
        // Loaded detail stays until it is refreshed explicitly.
        const old = current.get(row.id) as CrmStudent | undefined;
        record = {
          ...(old ? pickDetail(old) : {}),
          ...(row.r as CrmStudent),
        } as { id: string };
        changedStudents.push(row.id);
      }
      current.set(row.id, record);
    }
    const merged = [...current.values()] as { id: string }[];
    (next as unknown as Record<string, unknown>)[collection] =
      collection === "students"
        ? sortStudents(merged as CrmStudent[])
        : merged.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  if (preferencesChanged) Object.assign(next, delta.preferences);
  return { state: next, versions: nextVersions, changedStudents };
}

export function pickDetail(student: CrmStudent) {
  const detail: Partial<CrmStudent> = {};
  for (const key of detailKeys)
    if (student[key] !== undefined)
      (detail as Record<string, unknown>)[key] = student[key];
  return detail;
}

/** Orders the list the way the database does, so clients and server agree. */
export function sortStudents(students: CrmStudent[]) {
  return students.toSorted((a, b) =>
    a.joinedAt === b.joinedAt
      ? a.id < b.id
        ? -1
        : 1
      : a.joinedAt < b.joinedAt
        ? 1
        : -1,
  );
}

/** Places taken per lesson after one student's own bookings changed. */
export function adjustOccupancy(
  occupancy: Record<string, number>,
  before: CrmState,
  after: CrmState,
  studentId: string,
) {
  const count = (state: CrmState) => {
    const active = new Map<string, number>();
    for (const b of state.bookings ?? [])
      if (b.studentId === studentId && !b.cancelled) active.set(b.lessonId, 1);
    return active;
  };
  const was = count(before),
    now = count(after);
  const next = { ...occupancy };
  for (const lesson of new Set([...was.keys(), ...now.keys()])) {
    const change = (now.get(lesson) ?? 0) - (was.get(lesson) ?? 0);
    if (change) next[lesson] = Math.max(0, (next[lesson] ?? 0) + change);
  }
  return next;
}
