"use client";
import { useContext, useSyncExternalStore } from "react";
import { demoStudents } from "@/modules/students/demo-data";
import { tiers } from "@/modules/students/config";
import type { CrmState } from "./model";
import { isCrmState } from "./schema";
import { assertCrmTransition } from "./logic";
import { prepareTransition } from "./transition";
import { RemoteContext, activeRemoteStore } from "./remote-store";
import { supabaseConfigured } from "@/lib/supabase/config";
const KEY = "italfit.crm.v1";
const EVENT = "italfit-crm-change";
export const initialState: CrmState = {
  version: 1,
  students: supabaseConfigured
    ? []
    : demoStudents.map((s) => ({ ...s, properties: {} })),
  tiers: Object.values(tiers).map((t) => ({ ...t, archived: false })),
  properties: [],
  admins: [
    {
      id: "owner-demo",
      name: "Amministratore demo",
      email: "admin@example.com",
      role: "owner",
      status: "active",
    },
  ],
};
export { isCrmState } from "./schema";
let cachedRaw: string | null | undefined;
let cached: CrmState = initialState;
let issue = "";
function snapshot(): CrmState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw || issue) {
      const parsed: unknown = raw ? JSON.parse(raw) : initialState;
      if (!supabaseConfigured && isCrmState(parsed)) {
        parsed.tiers = parsed.tiers.map((tier) => ({
          ...tier,
          entitlements:
            tier.entitlements ??
            Object.values(tiers).find((t) => t.id === tier.id)?.entitlements,
        }));
      }
      if (!isCrmState(parsed)) throw new Error("Formato non valido");
      assertCrmTransition(parsed, parsed);
      cachedRaw = raw;
      cached = parsed;
      issue = "";
    }
  } catch {
    issue =
      "Impossibile leggere i dati locali. Non salvare modifiche prima di aver verificato le impostazioni del browser.";
  }
  return cached;
}
function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
export function useCrm() {
  const remote = useContext(RemoteContext);
  return useSyncExternalStore(
    remote?.subscribe ?? subscribe,
    remote?.snapshot ?? snapshot,
    remote?.snapshot ?? (() => initialState),
  );
}
export function useSaving() {
  const remote = useContext(RemoteContext);
  return useSyncExternalStore(
    remote?.subscribe ?? subscribe,
    remote?.pending ?? (() => false),
    () => false,
  );
}
export function useViewer() {
  return useContext(RemoteContext)?.viewer ?? null;
}
export function useRemoteMode() {
  return useContext(RemoteContext) !== null;
}
export function useSyncStatus() {
  const remote = useContext(RemoteContext);
  return useSyncExternalStore(
    remote?.subscribe ?? subscribe,
    remote?.status ?? (() => null),
    remote?.status ?? (() => null),
  );
}
export function storageIssue() {
  return issue;
}
export async function updateCrm(update: (state: CrmState) => CrmState) {
  if (supabaseConfigured) {
    if (!activeRemoteStore)
      throw new Error("Il CRM si sta caricando. Riprova tra un istante.");
    return activeRemoteStore.update(update);
  }
  const current = snapshot();
  if (issue) throw new Error(issue);
  const next = prepareTransition(current, update(current), {
    id: "owner-demo",
    name: "Amministratore demo",
  });
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      "Salvataggio non riuscito: spazio esaurito o archiviazione del browser non disponibile.",
    );
  }
  cachedRaw = JSON.stringify(next);
  cached = next;
  window.dispatchEvent(new Event(EVENT));
}

export async function addStudentComment(studentId: string, text: string) {
  if (supabaseConfigured) {
    if (!activeRemoteStore)
      throw new Error("Il CRM si sta caricando. Riprova tra un istante.");
    return activeRemoteStore.comment(studentId, text);
  }
  return updateCrm((s) => ({
    ...s,
    students: s.students.map((student) =>
      student.id === studentId
        ? {
            ...student,
            notes: [
              ...(student.notes ?? []),
              {
                id: crypto.randomUUID(),
                text,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : student,
    ),
  }));
}

export function useStorageIssue() {
  const remote = useContext(RemoteContext);
  return useSyncExternalStore(
    remote?.subscribe ?? subscribe,
    remote?.error ??
      (() => {
        snapshot();
        return issue;
      }),
    () => "",
  );
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
export function retryStorage() {
  if (activeRemoteStore) {
    void activeRemoteStore.refresh().catch(() => {});
    return;
  }
  cachedRaw = undefined;
  window.dispatchEvent(new Event(EVENT));
}
export function downloadBackup() {
  const raw = activeRemoteStore
    ? JSON.stringify(activeRemoteStore.snapshot())
    : (localStorage.getItem(KEY) ?? JSON.stringify(snapshot()));
  const url = URL.createObjectURL(
    new Blob([raw], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "team-italfit-crm-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
