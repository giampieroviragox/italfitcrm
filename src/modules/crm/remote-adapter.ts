import type { CrmState } from "./model.ts";
import { isCrmEnvelope, type CrmEnvelope } from "./envelope.ts";
import { assertCrmTransition } from "./logic.ts";
import { mutationState } from "./mutation.ts";
import type { RemovalTarget } from "./removal.ts";
import { requestJson, RequestError } from "../../lib/request-json.ts";

export interface Viewer {
  role: "owner" | "admin" | "student";
  recordId: string;
}
export interface SyncStatus {
  online: boolean;
  refreshing: boolean;
  error: string;
  authRequired: boolean;
  requiresRefresh: boolean;
}
export interface RemoteStore {
  viewer: Viewer | null;
  snapshot: () => CrmState;
  subscribe: (fn: () => void) => () => void;
  update: (fn: (state: CrmState) => CrmState) => Promise<void>;
  refresh: () => Promise<void>;
  comment: (studentId: string, text: string) => Promise<void>;
  remove: (target: RemovalTarget) => Promise<void>;
  pending: () => boolean;
  error: () => string;
  status: () => SyncStatus;
  setOnline: (online: boolean) => void;
}

export function createRemoteStore(
  initial: CrmEnvelope,
  viewer: Viewer | null,
  fetcher: typeof fetch = fetch,
): RemoteStore {
  let envelope = initial;
  let pending = 0;
  let status: SyncStatus = {
    online: true,
    refreshing: false,
    error: "",
    authRequired: false,
    requiresRefresh: false,
  };
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
  const read = async () => {
    const data = await requestJson("/api/crm", {}, fetcher);
    if (!isCrmEnvelope(data) || data.revision < envelope.revision)
      throw new Error("Dati non aggiornati. Riprova l’aggiornamento tra poco.");
    envelope = data;
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
    if (!isCrmEnvelope(data) || data.revision < envelope.revision) {
      patchStatus({ requiresRefresh: true });
      throw new Error(
        "Esito del salvataggio non verificato. Aggiorna i dati prima di riprovare.",
      );
    }
    envelope = data;
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
  const remote: RemoteStore = {
    viewer,
    snapshot: () => envelope.state,
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
        const proposed = fn(envelope.state);
        assertCrmTransition(envelope.state, proposed);
        return send("/api/crm", {
          revision: envelope.revision,
          state: mutationState(envelope.state, proposed),
        });
      }),
    comment: (studentId, text) =>
      write(() => send("/api/commenti", { studentId, text })),
    remove: (target) => write(() => send("/api/crm/rimozioni", target)),
  };
  return remote;
}
