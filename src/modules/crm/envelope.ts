import type { CrmState } from "./model.ts";
import { isCrmState } from "./schema.ts";
export interface CrmEnvelope {
  revision: number;
  state: CrmState;
}
export function isCrmEnvelope(value: unknown): value is CrmEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "revision" in value &&
    typeof value.revision === "number" &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    "state" in value &&
    isCrmState(value.state)
  );
}
