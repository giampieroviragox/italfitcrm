import type { CrmEnvelope } from "./envelope.ts";
import { projectState, staffScope } from "./permissions.ts";
import {
  collections,
  emptyDelta,
  lightStudent,
  type Collection,
  type CrmDelta,
} from "./sync.ts";
import type { CrmState, CrmStudent } from "./model.ts";

const list = (state: CrmState, collection: Collection) =>
  (state[collection] ?? []) as { id: string }[];

/**
 * Limits a delta to what one team member may see. `envelope` is the whole
 * state; the delta says which records changed. A changed record the member
 * cannot see becomes a removal, which is harmless if they never had it.
 */
export function projectDelta(
  envelope: CrmEnvelope,
  delta: CrmDelta,
  adminId: string,
): CrmDelta {
  const view = projectState(
    envelope.state,
    staffScope(envelope.state, adminId),
  );
  const out = emptyDelta();
  out.removed = [...delta.removed];
  if (delta.preferences) out.preferences = delta.preferences;
  const visible = new Map(
    collections.map(
      (c) => [c, new Map(list(view, c).map((r) => [r.id, r]))] as const,
    ),
  );
  const sent = new Set<string>();
  const send = (collection: Collection, id: string, fallback: number) => {
    const record = visible.get(collection)?.get(id);
    if (!record || sent.has(`${collection}:${id}`)) return !record;
    sent.add(`${collection}:${id}`);
    (out.upserts[collection] ??= []).push({
      id,
      v: envelope.versions[collection]?.[id] ?? fallback,
      r:
        collection === "students" ? lightStudent(record as CrmStudent) : record,
    });
    return false;
  };
  for (const collection of collections)
    for (const row of delta.upserts[collection] ?? [])
      if (send(collection, row.id, row.v))
        out.removed.push({ k: collection, id: row.id });
  // A visible booking needs its lesson, even when the lesson itself is unchanged.
  for (const row of out.upserts.bookings ?? []) {
    const lessonId = (row.r as { lessonId: string }).lessonId;
    send("lessons", lessonId, 0);
  }
  return out;
}
