import type { CrmState } from "./model.ts";

/** Audit rows stay on the server instead of growing every mutation request. */
export function mutationState(current: CrmState, proposed: CrmState): CrmState {
  return {
    ...proposed,
    students: proposed.students.map((s) => {
      const old = current.students.find((x) => x.id === s.id);
      return {
        ...s,
        history: undefined,
        notes:
          JSON.stringify(s.notes ?? []) === JSON.stringify(old?.notes ?? [])
            ? undefined
            : s.notes,
      };
    }),
  };
}
