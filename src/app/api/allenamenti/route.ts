import { HttpError } from "@/modules/crm/server/auth";
import { studentCommand } from "@/modules/crm/server/commands";
import {
  prepareWorkoutEntry,
  type WorkoutInput,
} from "@/modules/crm/workout-progress";

/** A student logs a workout (sets, loads, effort). */
export function POST(request: Request) {
  return studentCommand(
    request,
    (state, studentId, input) => {
      if (
        typeof input.assignmentId !== "string" ||
        typeof input.assignmentCreatedAt !== "string" ||
        typeof input.sessionId !== "string" ||
        typeof input.notes !== "string" ||
        typeof input.completed !== "boolean"
      )
        throw new HttpError(400, "Allenamento non valido.");
      return prepareWorkoutEntry(state, studentId, {
        assignmentId: input.assignmentId,
        assignmentCreatedAt: input.assignmentCreatedAt,
        sessionId: input.sessionId,
        notes: input.notes,
        completed: input.completed,
        // Shape-checked by prepareWorkoutEntry.
        performedOn: input.performedOn as string | undefined,
        rpe: input.rpe as number | undefined,
        exercises: input.exercises as WorkoutInput["exercises"],
      });
    },
    { maxLength: 100_000, plans: false },
  );
}
