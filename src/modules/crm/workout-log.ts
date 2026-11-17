import { z } from "zod";
import { normalize, validDate, type CrmState } from "./model.ts";
import type {
  PlanAssignment,
  WorkoutEntry,
  WorkoutSession,
} from "./fitness-model.ts";

/** Per-set workout log, perceived effort and personal maxes (1RM, 3RM, 5RM). */
const identifier = z.string().min(1).max(200);
const day = z.string().refine(validDate, "Data non valida.");
/** Kilograms rounded to two decimals (e.g. 102.5). */
const kilograms = z
  .number()
  .min(0)
  .max(1000)
  .transform((kg) => Math.round(kg * 100) / 100);
export const setLog = z.object({
  reps: z.number().int().min(0).max(1000).optional(),
  kg: kilograms.optional(),
});
export type SetLog = z.infer<typeof setLog>;
export const exerciseLog = z.object({
  exerciseId: identifier,
  sets: z.array(setLog).max(30),
});
export type ExerciseLog = z.infer<typeof exerciseLog>;
export const maxSetsPerExercise = 30;
export const rpe = z.number().int().min(1).max(10);
export const rpeLabels: Record<number, string> = {
  1: "Molto facile",
  2: "Facile",
  3: "Leggero",
  4: "Moderato",
  5: "Impegnativo",
  6: "Impegnativo +",
  7: "Duro",
  8: "Molto duro",
  9: "Quasi al limite",
  10: "Al limite",
};
/** Optional details of a WorkoutEntry, validated on read and write. */
export const workoutDetails = z.object({
  performedOn: day.optional(),
  rpe: rpe.optional(),
  exercises: z.array(exerciseLog).max(60).optional(),
});
export type WorkoutDetails = z.infer<typeof workoutDetails>;

/** Drops empty sets and exercises; rejects exercises outside the session. */
export function cleanExerciseLogs(
  session: WorkoutSession,
  logs: ExerciseLog[] | undefined,
): ExerciseLog[] | undefined {
  if (!logs) return undefined;
  const ids = new Set(session.exercises.map((e) => e.id));
  if (new Set(logs.map((l) => l.exerciseId)).size !== logs.length)
    throw new Error("Ogni esercizio può comparire una sola volta.");
  if (logs.some((l) => !ids.has(l.exerciseId)))
    throw new Error("Il piano è cambiato. Aggiornalo prima di salvare.");
  const cleaned = logs
    .map((l) => ({
      exerciseId: l.exerciseId,
      sets: l.sets
        .filter((s) => s.reps !== undefined || s.kg !== undefined)
        .map((s) => ({
          ...(s.reps !== undefined ? { reps: s.reps } : {}),
          ...(s.kg !== undefined ? { kg: s.kg } : {}),
        })),
    }))
    .filter((l) => l.sets.length);
  return cleaned.length ? cleaned : undefined;
}

export const formatKg = (kg: number) =>
  `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(kg)} kg`;
/** "5 × 100 kg", "12 rip.", "80 kg". */
export function setLabel(set: SetLog) {
  if (set.reps !== undefined && set.kg !== undefined)
    return `${set.reps} × ${formatKg(set.kg)}`;
  if (set.reps !== undefined) return `${set.reps} rip.`;
  return set.kg !== undefined ? formatKg(set.kg) : "—";
}

export interface LoggedSession {
  entry: WorkoutEntry;
  assignment: PlanAssignment;
  session: WorkoutSession;
  /** Effective date: the declared one, else the day it was saved (Rome). */
  date: string;
}
const romeDay = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(iso),
  );
/** Completed sessions whose plan still exists, newest first. */
export function loggedSessions(
  assignments: PlanAssignment[],
  entries: WorkoutEntry[],
): LoggedSession[] {
  return entries
    .flatMap((entry) => {
      if (!entry.completed) return [];
      const assignment = assignments.find(
        (a) =>
          a.id === entry.assignmentId &&
          a.createdAt === entry.assignmentCreatedAt,
      );
      const session = assignment?.snapshot.sessions.find(
        (s) => s.id === entry.sessionId,
      );
      return assignment && session
        ? [
            {
              entry,
              assignment,
              session,
              date: entry.performedOn ?? romeDay(entry.updatedAt),
            },
          ]
        : [];
    })
    .toSorted(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.entry.updatedAt.localeCompare(a.entry.updatedAt),
    );
}

/** The most recent logged sets for an exercise name, to show "last time". */
export function lastLoggedSets(
  history: LoggedSession[],
  exerciseName: string,
  exclude?: { assignmentId: string; sessionId: string },
) {
  const name = normalize(exerciseName);
  for (const item of history) {
    if (
      exclude &&
      item.entry.assignmentId === exclude.assignmentId &&
      item.entry.sessionId === exclude.sessionId
    )
      continue;
    for (const log of item.entry.exercises ?? []) {
      const exercise = item.session.exercises.find(
        (e) => e.id === log.exerciseId,
      );
      if (exercise && normalize(exercise.name) === name && log.sets.length)
        return { date: item.date, sets: log.sets };
    }
  }
  return undefined;
}

export const maxRepetitions = [1, 3, 5] as const;
export const maxRecord = z.object({
  id: identifier,
  exercise: z.string().trim().min(1).max(100),
  reps: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  kg: kilograms.refine((kg) => kg > 0, "Inserisci il carico."),
  date: day,
  createdAt: z.iso.datetime({ offset: true }),
  /** Coach who entered the record; absent when the student did. */
  recordedBy: z.string().trim().min(1).max(120).optional(),
});
export type MaxRecord = z.infer<typeof maxRecord>;
export const maxRecords = z.array(maxRecord).max(500);
export const maxCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    record: maxRecord.omit({ id: true, createdAt: true, recordedBy: true }),
  }),
  z.object({ action: z.literal("remove"), id: identifier }),
]);
export type MaxCommand = z.infer<typeof maxCommand>;

/** Latest record for each exercise and RM, plus the full history per exercise. */
export function currentMaxes(records: MaxRecord[]) {
  const byExercise = new Map<
    string,
    {
      exercise: string;
      latest: Partial<Record<1 | 3 | 5, MaxRecord>>;
      history: MaxRecord[];
    }
  >();
  const sorted = records.toSorted(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  for (const record of sorted) {
    const key = normalize(record.exercise);
    const group = byExercise.get(key) ?? {
      exercise: record.exercise,
      latest: {},
      history: [],
    };
    group.latest[record.reps] ??= record;
    group.history.push(record);
    byExercise.set(key, group);
  }
  return [...byExercise.values()].toSorted((a, b) =>
    a.exercise.localeCompare(b.exercise, "it"),
  );
}

export function applyMaxCommand(
  state: CrmState,
  studentId: string,
  command: MaxCommand,
  today: string,
  now = new Date(),
  /** Coach name when staff record it on the student's profile. */
  staffName?: string,
): CrmState {
  const student = state.students.find(
    (s) =>
      s.id === studentId &&
      !s.archived &&
      (staffName !== undefined || !s.accessDisabled),
  );
  if (!student) throw new Error("Studente non disponibile.");
  const current = student.maxes ?? [];
  let next: MaxRecord[];
  if (command.action === "add") {
    if (command.record.date > today)
      throw new Error("La data del massimale non può essere nel futuro.");
    if (current.length >= 500)
      throw new Error("Hai raggiunto il numero massimo di massimali salvati.");
    next = [
      ...current,
      {
        ...command.record,
        exercise: command.record.exercise.trim().replace(/\s+/g, " "),
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        ...(staffName ? { recordedBy: staffName } : {}),
      },
    ];
  } else {
    const record = current.find((r) => r.id === command.id);
    if (!record)
      throw new Error("Il massimale non esiste più. Aggiorna la pagina.");
    if (record.recordedBy && staffName === undefined)
      throw new Error(
        "Questo massimale è stato inserito dal coach: chiedi al team di modificarlo.",
      );
    next = current.filter((r) => r.id !== command.id);
  }
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === student.id ? { ...s, maxes: next } : s,
    ),
  };
}
