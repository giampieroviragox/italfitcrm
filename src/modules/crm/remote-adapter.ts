import type { WalletCommand } from "./lesson-wallet.ts";
import type { CoachingCommand } from "./online-coaching.ts";
import type { MaxCommand } from "./workout-log.ts";
import type { RaceCommand } from "./cycle-feedback.ts";
import type { CrmState, CrmStudent } from "./model.ts";
import type { CrmEnvelope } from "./envelope.ts";
import { assertCrmTransition } from "./logic.ts";
import { mutationState } from "./mutation.ts";
import type { RemovalTarget } from "./removal.ts";
import { requestJson, RequestError } from "../../lib/request-json.ts";
import {
  applyDelta,
  buildPatch,
  collections,
  type CrmDelta,
  type Versions,
} from "./sync.ts";

export interface Viewer {
  role: "owner" | "admin" | "student";
  recordId: string;
  /** Staff permissions resolved on the server; the UI only hides what they exclude. */
  permissions?: import("./permissions.ts").Permission[];
}
export interface SyncStatus {
  online: boolean;
  refreshing: boolean;
  error: string;
  authRequired: boolean;
  requiresRefresh: boolean;
}
/** Heavy parts of a student are loaded when their profile opens. */
export type DetailStatus = "none" | "loading" | "ready" | "stale";
export interface RemoteStore {
  viewer: Viewer | null;
  snapshot: () => CrmState;
  subscribe: (fn: () => void) => () => void;
  update: (fn: (state: CrmState) => CrmState) => Promise<void>;
  refresh: () => Promise<void>;
  comment: (studentId: string, text: string) => Promise<void>;
  wallet: (command: WalletCommand) => Promise<void>;
  coaching: (command: CoachingCommand) => Promise<void>;
  maxes: (studentId: string, command: MaxCommand) => Promise<void>;
  races: (studentId: string, command: RaceCommand) => Promise<void>;
  remove: (target: RemovalTarget) => Promise<void>;
  detailStatus: (studentId: string) => DetailStatus;
  loadDetail: (studentId: string) => Promise<void>;
  pending: () => boolean;
  error: () => string;
  status: () => SyncStatus;
  setOnline: (online: boolean) => void;
}

function isDelta(value: unknown): value is CrmDelta {
  if (!value || typeof value !== "object") return false;
  const { upserts, removed } = value as Partial<CrmDelta>;
  return (
    !!upserts &&
    typeof upserts === "object" &&
    Array.isArray(removed) &&
    Object.entries(upserts).every(
      ([collection, rows]) =>
        (collections as readonly string[]).includes(collection) &&
        Array.isArray(rows),
    )
  );
}
const isDeltaResponse = (
  value: unknown,
): value is { revision: number; delta: CrmDelta } =>
  !!value &&
  typeof value === "object" &&
  "revision" in value &&
  typeof value.revision === "number" &&
  "delta" in value &&
  isDelta(value.delta);

export function createRemoteStore(
  initial: CrmEnvelope,
  viewer: Viewer | null,
  fetcher: typeof fetch = fetch,
): RemoteStore {
  let state = initial.state;
  let versions: Versions = initial.versions ?? {};
  /** Every change up to this revision is in `state`. Only reads move it. */
  let revision = initial.revision;
  let pending = 0;
  let status: SyncStatus = {
    online: true,
    refreshing: false,
    error: "",
    authRequired: false,
    requiresRefresh: false,
  };
  const detail = new Map<
    string,
    { status: DetailStatus; generation: number }
  >();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  const patchStatus = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch };
    emit();
  };
  let queue: Promise<void> = Promise.resolve();
  let reading: Promise<void> | null = null;
  const enqueue = (operation: () => Promise<void>) => {
    const result = queue.catch(() => {}).then(operation);
    queue = result;
    return result;
  };
  const fail = (error: unknown) => {
    const failure =
      error instanceof Error ? error : new Error("Operazione non riuscita.");
    patchStatus({
      error: failure.message,
      authRequired: error instanceof RequestError && error.status === 401,
    });
    return failure;
  };
  const merge = (delta: CrmDelta) => {
    const merged = applyDelta(state, versions, delta);
    state = merged.state;
    versions = merged.versions;
    // Loaded detail of a student whose record changed may be out of date.
    for (const id of merged.changedStudents) {
      const entry = detail.get(id);
      if (entry)
        detail.set(id, {
          status: entry.status === "ready" ? "stale" : entry.status,
          generation: entry.generation + 1,
        });
    }
  };
  /** Reads what changed since the last read; the cursor moves only here. */
  const read = async () => {
    const data = await requestJson(`/api/crm?since=${revision}`, {}, fetcher);
    if (!isDeltaResponse(data) || data.revision < revision)
      throw new Error("Dati non aggiornati. Riprova l’aggiornamento tra poco.");
    merge(data.delta);
    revision = data.revision;
    patchStatus({ error: "", authRequired: false, requiresRefresh: false });
  };
  const send = async (url: string, body: unknown) => {
    let data;
    try {
      data = await requestJson(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        fetcher,
      );
    } catch (e) {
      if (e instanceof RequestError && e.status === 409) {
        try {
          await read();
        } catch {
          patchStatus({ requiresRefresh: true });
        }
      } else if (
        !(e instanceof RequestError) ||
        e.status === 0 ||
        e.status >= 500 ||
        e.status < 300
      ) {
        patchStatus({ requiresRefresh: true });
      }
      throw e;
    }
    if (!isDeltaResponse(data)) {
      patchStatus({ requiresRefresh: true });
      throw new Error(
        "Esito del salvataggio non verificato. Aggiorna i dati prima di riprovare.",
      );
    }
    // The delta holds this change only; the read cursor stays where it is,
    // so changes made by others in the meantime still arrive with the next read.
    merge(data.delta);
    patchStatus({ error: "", authRequired: false });
  };
  const write = (operation: () => Promise<void>) => {
    pending++;
    emit();
    return enqueue(async () => {
      try {
        if (!status.online)
          throw new Error(
            "Sei offline. Le modifiche restano nel form: riconnettiti prima di salvare.",
          );
        if (status.requiresRefresh)
          throw new Error(
            "Aggiorna i dati per verificare l’ultimo salvataggio prima di riprovare.",
          );
        await operation();
      } catch (e) {
        throw fail(e);
      } finally {
        pending--;
        emit();
      }
    });
  };
  const loadDetail = async (studentId: string) => {
    const entry = detail.get(studentId);
    if (entry?.status === "loading" || entry?.status === "ready") return;
    const generation = (entry?.generation ?? 0) + 1;
    detail.set(studentId, { status: "loading", generation });
    emit();
    try {
      const data = await requestJson(
        `/api/crm/studenti/${encodeURIComponent(studentId)}`,
        {},
        fetcher,
      );
      const loaded = (data as { detail?: Partial<CrmStudent> } | null)?.detail;
      if (!loaded) throw new Error("Scheda non disponibile.");
      state = {
        ...state,
        students: state.students.map((s) =>
          s.id === studentId
            ? {
                ...s,
                workoutEntries: loaded.workoutEntries ?? [],
                notes: loaded.notes ?? [],
                history: loaded.history ?? [],
              }
            : s,
        ),
      };
      const now = detail.get(studentId);
      // A change that arrived while loading makes this copy stale already.
      detail.set(studentId, {
        status: now && now.generation !== generation ? "stale" : "ready",
        generation: now?.generation ?? generation,
      });
      emit();
    } catch (e) {
      detail.set(studentId, { status: "none", generation });
      emit();
      throw fail(e);
    }
  };
  const remote: RemoteStore = {
    viewer,
    snapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    status: () => status,
    setOnline: (online) => patchStatus({ online }),
    pending: () => pending > 0,
    error: () => status.error,
    detailStatus: (id) => detail.get(id)?.status ?? "none",
    loadDetail: (id) => {
      const entry = detail.get(id);
      // A stale copy is replaced by loading again.
      if (entry?.status === "stale")
        detail.set(id, { ...entry, status: "none" });
      return loadDetail(id);
    },
    refresh: () => {
      if (reading) return reading;
      patchStatus({ refreshing: true });
      reading = enqueue(async () => {
        try {
          await read();
        } catch (e) {
          throw fail(e);
        } finally {
          reading = null;
          patchStatus({ refreshing: false });
        }
      });
      return reading;
    },
    update: (fn) =>
      write(() => {
        const proposed = fn(state);
        assertCrmTransition(state, proposed);
        // Both sides go through the same filter, so only what the browser
        // may really change shows up in the patch.
        const patch = buildPatch(
          mutationState(state, state),
          mutationState(state, proposed),
          versions,
        );
        if (!Object.keys(patch.records).length && !patch.preferences)
          return Promise.resolve();
        return send("/api/crm", { patch });
      }),
    wallet: (command) => write(() => send("/api/wallet-lezioni", { command })),
    coaching: (command) =>
      write(() => send("/api/coaching-online", { command })),
    maxes: (studentId, command) =>
      write(() => send("/api/crm/massimali", { studentId, command })),
    races: (studentId, command) =>
      write(() => send("/api/crm/gare", { studentId, command })),
    comment: (studentId, text) =>
      write(() => send("/api/commenti", { studentId, text })),
    remove: (target) => write(() => send("/api/crm/rimozioni", target)),
  };
  return remote;
}
