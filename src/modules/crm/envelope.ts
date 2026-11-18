import type { CrmState } from "./model.ts";
import { isCrmState } from "./schema.ts";
import { collections, type Versions } from "./sync.ts";

/** The state with the revision it was read at and the version of every record. */
export interface CrmEnvelope {
  revision: number;
  versions: Versions;
  state: CrmState;
}
function isVersions(value: unknown): value is Versions {
  if (typeof value !== "object" || value === null) return false;
  return collections.every((collection) => {
    const map = (value as Record<string, unknown>)[collection];
    return (
      map === undefined ||
      (typeof map === "object" &&
        map !== null &&
        Object.values(map).every((v) => Number.isSafeInteger(v)))
    );
  });
}
export function isCrmEnvelope(value: unknown): value is CrmEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "revision" in value &&
    typeof value.revision === "number" &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    "versions" in value &&
    isVersions(value.versions) &&
    "state" in value &&
    isCrmState(value.state)
  );
}
