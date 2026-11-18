"use client";
import { useContext, useEffect, useState, useSyncExternalStore } from "react";
import { tiers } from "@/modules/students/config";
import type { CrmState } from "./model";
import { applyWalletCommand, type WalletCommand } from "./lesson-wallet";
import { applyCoachingCommand, type CoachingCommand } from "./online-coaching";
import { applyMaxCommand, type MaxCommand } from "./workout-log";
import { applyRaceCommand, type RaceCommand } from "./cycle-feedback";
import { todayRome } from "./fitness-logic";
import type { Permission } from "./permissions";
import { isCrmState } from "./schema";
import { assertCrmTransition } from "./logic";
import { prepareTransition } from "./transition";
import { removalState, type RemovalTarget } from "./removal";
import { RemoteContext, activeRemoteStore } from "./remote-store";
import { supabaseConfigured } from "@/lib/supabase/config";
import { requestJson } from "@/lib/request-json";
// v1 saves still hold the old fictional students: they are discarded on load.
const KEY = "italfit.crm.v2";
const LEGACY_KEYS = ["italfit.crm.v1"];
const EVENT = "italfit-crm-change";
export const initialState: CrmState = {
  version: 1,
  students: [],
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
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
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
/**
 * Workout logs, notes and history of one student come with the profile, not
 * with the list. Returns whether they are still loading.
 */
export function useStudentDetail(studentId: string) {
  const remote = useContext(RemoteContext);
  const status = useSyncExternalStore(
    remote?.subscribe ?? subscribe,
    () => remote?.detailStatus(studentId) ?? "ready",
    () => "ready",
  );
  useEffect(() => {
    if (remote && (status === "none" || status === "stale"))
      void remote.loadDetail(studentId).catch(() => {});
  }, [remote, studentId, status]);
  return { loading: status === "none" || status === "loading" };
}

/** Latest events across students for the home page. */
export function useRecentActivity() {
  const remote = useContext(RemoteContext);
  const version = useSyncExternalStore(
    remote?.subscribe ?? subscribe,
    () => remote?.snapshot() ?? snapshot(),
    () => initialState,
  );
  const [events, setEvents] = useState<
    | {
        student: string;
        event: { id: string; text: string; createdAt: string };
      }[]
    | null
  >(null);
  useEffect(() => {
    if (!remote) return;
    let live = true;
    requestJson("/api/crm/attivita")
      .then((data) => {
        const rows = (data as { events?: typeof events })?.events;
        if (live && Array.isArray(rows)) setEvents(rows);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // A change to the CRM can add an event: ask again.
  }, [remote, version]);
  return events;
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
/** Whether the signed-in team member has a permission (always in local mode). */
export function useCan() {
  const viewer = useViewer();
  return (permission: Permission) =>
    !viewer ||
    viewer.role === "owner" ||
    Boolean(viewer.permissions?.includes(permission));
}
export function useIsOwner() {
  const viewer = useViewer();
  return !viewer || viewer.role === "owner";
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

/** Removes an assignment or a never-assigned plan (server-side transaction). */
export async function removeCrmRecord(target: RemovalTarget) {
  if (supabaseConfigured) {
    if (!activeRemoteStore)
      throw new Error("Il CRM si sta caricando. Riprova tra un istante.");
    return activeRemoteStore.remove(target);
  }
  return updateCrm((s) => removalState(s, target).state);
}

export async function updateLessonWallet(command: WalletCommand) {
  if (supabaseConfigured) {
    if (!activeRemoteStore)
      throw new Error("Il CRM si sta caricando. Riprova tra un istante.");
    return activeRemoteStore.wallet(command);
  }
  return updateCrm((state) =>
    applyWalletCommand(state, command, new Date(), "Amministratore demo"),
  );
}

export async function updateOnlineCoaching(command: CoachingCommand) {
  if (supabaseConfigured) {
    if (!activeRemoteStore)
      throw new Error("Il CRM si sta caricando. Riprova tra un istante.");
    return activeRemoteStore.coaching(command);
  }
  return updateCrm((state) => applyCoachingCommand(state, command));
}

/** Staff record or remove a student's maxes from the profile. */
export async function updateStudentMaxes(
  studentId: string,
  command: MaxCommand,
) {
  if (supabaseConfigured) {
    if (!activeRemoteStore)
      throw new Error("Il CRM si sta caricando. Riprova tra un istante.");
    return activeRemoteStore.maxes(studentId, command);
  }
  return updateCrm((state) =>
    applyMaxCommand(
      state,
      studentId,
      command,
      todayRome(),
      new Date(),
      "Amministratore demo",
    ),
  );
}

/** Staff add, edit or remove a student's races. */
export async function updateStudentRaces(
  studentId: string,
  command: RaceCommand,
) {
  if (supabaseConfigured) {
    if (!activeRemoteStore)
      throw new Error("Il CRM si sta caricando. Riprova tra un istante.");
    return activeRemoteStore.races(studentId, command);
  }
  return updateCrm((state) =>
    applyRaceCommand(
      state,
      studentId,
      command,
      todayRome(),
      new Date(),
      "Amministratore demo",
    ),
  );
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
