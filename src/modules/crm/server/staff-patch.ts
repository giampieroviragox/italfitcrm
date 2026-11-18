import type { CrmState } from "../model.ts";
import type { CrmEnvelope } from "../envelope.ts";
import { restrictUpdate, staffScope, type StaffScope } from "../permissions.ts";
import { isCrmState } from "../schema.ts";
import {
  applyPatch,
  ChangeError,
  collections,
  diffState,
  staleRecords,
  type Changes,
  type Patch,
  type Versions,
} from "../sync.ts";
import type { Access } from "./auth";
import { HttpError } from "./errors.ts";
import { validateStaffUpdate } from "./validation.ts";

/** Checks the shape of a patch received from a browser. */
export function isPatch(value: unknown): value is Patch {
  if (!value || typeof value !== "object" || !("records" in value))
    return false;
  const records = (value as { records: unknown }).records;
  if (!records || typeof records !== "object") return false;
  return Object.entries(records).every(
    ([collection, items]) =>
      (collections as readonly string[]).includes(collection) &&
      Array.isArray(items) &&
      items.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          (item.base === null || Number.isSafeInteger(item.base)) &&
          item.record &&
          typeof item.record === "object" &&
          (item.record as { id?: unknown }).id === item.id,
      ),
  );
}

/** The part of the state and versions a member may see. */
export function visibleState(
  envelope: CrmEnvelope,
  scope: StaffScope,
  project: (state: CrmState, scope: StaffScope) => CrmState,
): CrmState {
  return project(envelope.state, scope);
}

/**
 * Turns a patch from the browser into validated changes. The patch is laid
 * over the part of the CRM the member sees, goes through the permission and
 * integrity checks, and only the records that really differ are returned.
 */
export function stageStaffPatch(
  current: CrmEnvelope,
  patch: Patch,
  access: Access,
  project: (state: CrmState, scope: StaffScope) => CrmState,
): { next: CrmState; changes: Changes; scope: StaffScope } {
  if (staleRecords(patch, current.versions).length)
    throw new HttpError(
      409,
      "Qualcun altro ha modificato questi dati. Verifica e riprova.",
    );
  const scope = staffScope(current.state, access.record_id);
  const visible = applyPatch(project(current.state, scope), patch);
  if (!isCrmState(visible)) throw new HttpError(400, "Dati CRM non validi.");
  let next: CrmState;
  try {
    next = validateStaffUpdate(
      current.state,
      restrictUpdate(current.state, visible, scope),
      access,
    );
  } catch (e) {
    throw e instanceof HttpError ? e : new HttpError(403, (e as Error).message);
  }
  try {
    return {
      next,
      changes: diffState(current.state, next, current.versions as Versions),
      scope,
    };
  } catch (e) {
    if (e instanceof ChangeError) throw new HttpError(400, e.message);
    throw e;
  }
}
