import type { WorkoutEntry } from "./fitness-model.ts";
export function isWorkoutEntries(value: unknown): value is WorkoutEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= 1000 &&
    value.every(
      (e) =>
        e &&
        typeof e === "object" &&
        [
          "assignmentId",
          "assignmentCreatedAt",
          "sessionId",
          "notes",
          "updatedAt",
        ].every((k) => typeof e[k] === "string") &&
        e.notes.length <= 5000 &&
        typeof e.completed === "boolean" &&
        Number.isFinite(Date.parse(e.assignmentCreatedAt)) &&
        Number.isFinite(Date.parse(e.updatedAt)),
    ) &&
    new Set(
      value.map(
        (e) => `${e.assignmentId}:${e.assignmentCreatedAt}:${e.sessionId}`,
      ),
    ).size === value.length
  );
}
