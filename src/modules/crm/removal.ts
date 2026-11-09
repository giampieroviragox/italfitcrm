import type { CrmState } from "./model.ts";

export type RemovalTarget = { assignmentId: string } | { planId: string };

export interface Removal {
  state: CrmState;
  assignments: string[];
  plans: string[];
}

/**
 * Removes an assignment (the student stops seeing that plan and its logs) or
 * a plan that was never assigned. Assigned plans can only be archived.
 */
export function removalState(state: CrmState, target: RemovalTarget): Removal {
  if ("assignmentId" in target) {
    const assignment = state.assignments?.find(
      (a) => a.id === target.assignmentId,
    );
    if (!assignment) throw new Error("Assegnazione non trovata.");
    return {
      assignments: [assignment.id],
      plans: [],
      state: {
        ...state,
        assignments: (state.assignments ?? []).filter(
          (a) => a.id !== assignment.id,
        ),
        students: state.students.map((s) =>
          s.id === assignment.studentId && s.workoutEntries
            ? {
                ...s,
                workoutEntries: s.workoutEntries.filter(
                  (e) => e.assignmentId !== assignment.id,
                ),
              }
            : s,
        ),
      },
    };
  }
  const plan = state.plans?.find((p) => p.id === target.planId);
  if (!plan) throw new Error("Piano non trovato.");
  if (state.assignments?.some((a) => a.planId === plan.id))
    throw new Error(
      "Il piano è assegnato: rimuovi prima le assegnazioni oppure archivialo.",
    );
  return {
    assignments: [],
    plans: [plan.id],
    state: {
      ...state,
      plans: (state.plans ?? []).filter((p) => p.id !== plan.id),
    },
  };
}

export function isRemovalTarget(value: unknown): value is RemovalTarget {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const id = (x: unknown) =>
    typeof x === "string" && x.length > 0 && x.length <= 200;
  return Object.keys(v).length === 1 && (id(v.assignmentId) || id(v.planId));
}
