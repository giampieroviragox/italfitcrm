"use client";
import { createContext, useEffect, useState, type ReactNode } from "react";
import type { CrmState } from "./model";
import { isCrmEnvelope } from "./envelope";
import { assertCrmTransition } from "./logic";
import type { CrmEnvelope } from "./envelope";
export interface Viewer {
  role: "owner" | "admin" | "student";
  recordId: string;
}
export interface RemoteStore {
  viewer: Viewer | null;
  snapshot: () => CrmState;
  subscribe: (fn: () => void) => () => void;
  update: (fn: (state: CrmState) => CrmState) => Promise<void>;
  refresh: () => Promise<void>;
  pending: () => boolean;
  error: () => string;
}
export const RemoteContext = createContext<RemoteStore | null>(null);
export let activeRemoteStore: RemoteStore | null = null;
export function RemoteCrmProvider({
  initial,
  children,
  viewer = null,
}: {
  initial: CrmEnvelope;
  children: ReactNode;
  viewer?: Viewer | null;
}) {
  const [store] = useState(() => {
    let envelope = initial,
      error = "",
      pending = 0;
    const listeners = new Set<() => void>();
    let queue: Promise<void> = Promise.resolve();
    const emit = () => listeners.forEach((fn) => fn());
    const refresh = async () => {
      const response = await fetch("/api/crm", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Impossibile aggiornare il CRM.");
      if (!isCrmEnvelope(data)) throw new Error("Dati CRM non validi.");
      envelope = data;
      error = "";
      emit();
    };
    const remote: RemoteStore = {
      viewer,
      snapshot: () => envelope.state,
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      refresh,
      pending: () => pending > 0,
      error: () => error,
      update: (fn) => {
        pending++;
        emit();
        const operation = queue
          .catch(() => {})
          .then(async () => {
            try {
              const proposed = fn(envelope.state);
              assertCrmTransition(envelope.state, proposed);
              const response = await fetch("/api/crm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  revision: envelope.revision,
                  state: proposed,
                }),
              });
              const data = await response.json();
              if (!response.ok) {
                if (response.status === 409) await refresh();
                throw new Error(data.error ?? "Salvataggio non riuscito.");
              }
              if (!isCrmEnvelope(data))
                throw new Error("Risposta non valida. Ricarica il CRM.");
              envelope = data;
              error = "";
            } catch (e) {
              error = (e as Error).message;
              throw e;
            } finally {
              pending--;
              emit();
            }
          });
        queue = operation;
        return operation;
      },
    };
    return remote;
  });
  useEffect(() => {
    activeRemoteStore = store;
    const focus = () => {
      if (!store.pending()) void store.refresh().catch(() => {});
    };
    window.addEventListener("focus", focus);
    return () => {
      if (activeRemoteStore === store) activeRemoteStore = null;
      window.removeEventListener("focus", focus);
    };
  }, [store]);
  return (
    <RemoteContext.Provider value={store}>{children}</RemoteContext.Provider>
  );
}
