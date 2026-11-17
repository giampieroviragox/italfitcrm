import type { WorkoutEntry } from "./fitness-model.ts";
import type { CrmState } from "./model.ts";
import { studentAccess } from "./tier-access.ts";
import { prepareTransition } from "./transition.ts";
import { todayRome } from "./fitness-logic.ts";
import { cleanExerciseLogs, workoutDetails } from "./workout-log.ts";

export type WorkoutInput = Pick<
  WorkoutEntry,
  | "assignmentId"
  | "assignmentCreatedAt"
  | "sessionId"
  | "completed"
  | "notes"
  | "performedOn"
  | "rpe"
  | "exercises"
>;
export function prepareWorkoutEntry(
  state: CrmState,
  studentId: string,
  input: WorkoutInput,
): CrmState {
  const student = state.students.find(
    (s) => s.id === studentId && !s.archived && !s.accessDisabled,
  );
  if (!student || !studentAccess(state, student).plans)
    throw new Error("Il tuo accesso non include i piani.");
  const assignment = state.assignments?.find(
    (a) => a.id === input.assignmentId && a.studentId === studentId,
  );
  const session = assignment?.snapshot.sessions.find(
    (s) => s.id === input.sessionId,
  );
  if (
    !assignment ||
    !session ||
    assignment.createdAt !== input.assignmentCreatedAt
  )
    throw new Error("Il piano è cambiato. Aggiornalo prima di salvare.");
  const details = workoutDetails.safeParse({
    performedOn: input.performedOn,
    rpe: input.rpe,
    exercises: input.exercises,
  });
  if (!details.success)
    throw new Error("Controlla data, fatica e serie registrate.");
  const today = todayRome();
  if (details.data.performedOn && details.data.performedOn > today)
    throw new Error("La data dell’allenamento non può essere nel futuro.");
  const exercises = cleanExerciseLogs(session, details.data.exercises);
  if (
    typeof input.notes !== "string" ||
    input.notes.length > 5000 ||
    typeof input.completed !== "boolean"
  )
    throw new Error(
      "Note o completamento non validi (massimo 5000 caratteri).",
    );
  const entry: WorkoutEntry = {
    assignmentId: assignment.id,
    assignmentCreatedAt: assignment.createdAt,
    sessionId: input.sessionId,
    completed: input.completed,
    notes: input.notes.trim(),
    updatedAt: new Date().toISOString(),
    ...(input.completed
      ? { performedOn: details.data.performedOn ?? today }
      : {}),
    ...(input.completed && details.data.rpe ? { rpe: details.data.rpe } : {}),
    ...(input.completed && exercises ? { exercises } : {}),
  };
  const entries = (student.workoutEntries ?? []).filter(
    (e) =>
      !(
        e.assignmentId === entry.assignmentId &&
        e.assignmentCreatedAt === entry.assignmentCreatedAt &&
        e.sessionId === entry.sessionId
      ),
  );
  if (entries.length >= 1000)
    throw new Error(
      "Contatta il team per aggiornare il tuo storico allenamenti.",
    );
  return prepareTransition(
    state,
    {
      ...state,
      students: state.students.map((s) =>
        s.id === studentId ? { ...s, workoutEntries: [...entries, entry] } : s,
      ),
    },
    { id: student.id, name: `${student.firstName} ${student.lastName}` },
  );
}
