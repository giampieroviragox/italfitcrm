import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CrmState, CrmStudent } from "../model";
import { isCrmEnvelope, type CrmEnvelope } from "../envelope";
import type { Json } from "@/lib/supabase/database.types";
import {
  collections,
  diffState,
  hasChanges,
  ChangeError,
  type Changes,
  type Collection,
  type CrmDelta,
  type Versions,
} from "../sync";
export type { CrmEnvelope } from "../envelope";
import { HttpError } from "./auth";

/** The whole state for the team, without the heavy detail of each student. */
export async function readCrm(actor: string): Promise<CrmEnvelope> {
  const { data, error } = await createAdminClient()
    .rpc("crm_load", { p_actor: actor })
    .retry(false);
  if (error || !isCrmEnvelope(data))
    throw new HttpError(503, "Impossibile caricare il CRM. Riprova.");
  return data;
}

type ChangeRows = { v: number; r: { id: string } }[];
/** Records changed after `since`, as a delta. Not filtered for any viewer yet. */
export async function readChanges(
  actor: string,
  since: number,
): Promise<{ revision: number; delta: CrmDelta }> {
  const { data, error } = await createAdminClient()
    .rpc("crm_load_changes", { p_actor: actor, p_since: since })
    .retry(false);
  const body = data as {
    revision?: number;
    changes?: Record<string, ChangeRows>;
    removed?: { k: Collection; id: string }[];
    preferences?: Record<string, unknown>;
  } | null;
  if (error || !body || typeof body.revision !== "number" || !body.changes)
    throw new HttpError(503, "Impossibile aggiornare il CRM. Riprova.");
  const delta: CrmDelta = { upserts: {}, removed: body.removed ?? [] };
  for (const collection of collections) {
    const rows = body.changes[collection] ?? [];
    if (rows.length)
      delta.upserts[collection] = rows.map((row) => ({
        id: row.r.id,
        v: row.v,
        r: row.r,
      }));
  }
  const preferences = body.preferences ?? {};
  const picked: Record<string, unknown> = {};
  for (const key of ["views", "directory", "activeViewId"])
    if (preferences[key] !== undefined) picked[key] = preferences[key];
  if (Object.keys(picked).length) delta.preferences = picked;
  return { revision: body.revision, delta };
}

/** One student with workout logs, notes and history. */
export async function readStudentDetail(
  studentId: string,
): Promise<{ revision: number; student: CrmStudent } | null> {
  const { data, error } = await createAdminClient()
    .rpc("crm_load_detail", { p_student: studentId })
    .retry(false);
  const body = data as {
    revision?: number;
    student?: CrmStudent | null;
  } | null;
  if (error || !body || typeof body.revision !== "number")
    throw new HttpError(503, "Impossibile caricare la scheda. Riprova.");
  return body.student
    ? { revision: body.revision, student: body.student }
    : null;
}

export async function readRecentActivity(limit: number) {
  const { data, error } = await createAdminClient()
    .rpc("crm_recent_activity", { p_limit: limit })
    .retry(false);
  if (error || !Array.isArray(data))
    throw new HttpError(503, "Impossibile caricare l’attività. Riprova.");
  return data as { student: string; event: Record<string, unknown> }[];
}

/** What a student's own session needs; nothing about other students. */
export interface StudentScope extends CrmEnvelope {
  /** Places taken per lesson, across all students. */
  occupancy: Record<string, number>;
}
export async function readStudentScope(
  studentId: string,
): Promise<StudentScope> {
  const { data, error } = await createAdminClient()
    .rpc("crm_load_scope", { p_student: studentId })
    .retry(false);
  const body = data as unknown as
    (CrmEnvelope & { occupancy?: Record<string, number> }) | null;
  if (error || !body || !isCrmEnvelope(body))
    throw new HttpError(503, "Impossibile caricare i tuoi dati. Riprova.");
  return { ...body, occupancy: body.occupancy ?? {} };
}

/** The scope of the student behind a login, or null for anyone else. */
export async function readStudentScopeForUser(
  userId: string,
): Promise<StudentScope | null> {
  const { data, error } = await createAdminClient()
    .rpc("crm_load_scope_user", { p_user: userId })
    .retry(false);
  if (error)
    throw new HttpError(503, "Impossibile caricare i tuoi dati. Riprova.");
  if (!data) return null;
  const body = data as unknown as CrmEnvelope & {
    occupancy?: Record<string, number>;
  };
  if (!isCrmEnvelope(body))
    throw new HttpError(503, "Impossibile caricare i tuoi dati. Riprova.");
  return { ...body, occupancy: body.occupancy ?? {} };
}

export interface Committed extends CrmEnvelope {
  changes: Changes;
}
const conflictMessage =
  "Qualcun altro ha modificato questi dati nel frattempo. Ricarica e riprova.";

/**
 * Writes what differs between what was read and `next`, record by record.
 * Each record states the version it was read at, so only edits to the same
 * record conflict.
 */
export async function writeCrm(
  actor: string,
  current: CrmEnvelope,
  next: CrmState,
  removed: { assignments?: string[]; plans?: string[] } = {},
): Promise<Committed> {
  let changes: Changes;
  try {
    changes = diffState(current.state, next, current.versions, removed);
  } catch (e) {
    if (e instanceof ChangeError) throw new HttpError(400, e.message);
    throw e;
  }
  return applyChanges(actor, current, changes, next);
}

export async function applyChanges(
  actor: string,
  current: CrmEnvelope,
  changes: Changes,
  next: CrmState,
): Promise<Committed> {
  if (!hasChanges(changes)) return { ...current, state: next, changes };
  const { data, error } = await createAdminClient()
    .rpc("crm_apply", { p_actor: actor, p_changes: changes as unknown as Json })
    .retry(false);
  if (error) throw mapWriteError(error);
  const result = data as { revision?: number; versions?: Versions } | null;
  if (!result || typeof result.revision !== "number")
    throw new HttpError(
      503,
      "Risposta database non valida. Ricarica prima di riprovare.",
    );
  const versions: Versions = {};
  for (const collection of collections)
    versions[collection] = {
      ...(current.versions[collection] ?? {}),
      ...(result.versions?.[collection] ?? {}),
    };
  for (const id of changes.removed?.assignments ?? [])
    delete versions.assignments?.[id];
  for (const id of changes.removed?.plans ?? []) delete versions.plans?.[id];
  return { revision: result.revision, versions, state: next, changes };
}

function mapWriteError(error: { code: string; message: string }) {
  if (["40001", "PT409"].includes(error.code))
    return new HttpError(409, conflictMessage);
  if (error.message.startsWith("capacity:"))
    return new HttpError(409, "Non ci sono più posti disponibili.");
  if (error.code === "23505")
    return new HttpError(
      409,
      "Esiste già un record con questi dati. Ricarica e riprova.",
    );
  if (error.code === "23503")
    return new HttpError(
      409,
      "Il piano è assegnato: rimuovi prima le assegnazioni oppure archivialo.",
    );
  console.error("CRM write failed", {
    code: error.code,
    message: error.message,
  });
  return new HttpError(
    503,
    "Il database non ha salvato le modifiche. Riprova.",
  );
}
