"use client";
import { createContext, useEffect, useState, type ReactNode } from "react";
import type { CrmEnvelope } from "./envelope";
import {
  createRemoteStore,
  type RemoteStore,
  type Viewer,
} from "./remote-adapter";
export type { RemoteStore, Viewer } from "./remote-adapter";
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
  const [store] = useState(() => createRemoteStore(initial, viewer));
  useEffect(() => {
    activeRemoteStore = store;
    store.setOnline(navigator.onLine);
    const refresh = () => {
      if (navigator.onLine && !store.pending())
        void store.refresh().catch(() => {});
    };
    const online = () => {
      store.setOnline(true);
      refresh();
    };
    const offline = () => store.setOnline(false);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (store.pending()) event.preventDefault();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", visible);
    return () => {
      if (activeRemoteStore === store) activeRemoteStore = null;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [store]);
  return (
    <RemoteContext.Provider value={store}>{children}</RemoteContext.Provider>
  );
}
