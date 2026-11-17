import { z } from "zod";
import { validDate, type CrmState, type CrmStudent } from "./model.ts";
import type { PlanAssignment, WorkoutEntry } from "./fitness-model.ts";

/** End-of-cycle questionnaire (one per monthly plan) and the student's race calendar. */
const identifier = z.string().min(1).max(200);
const day = z.string().refine(validDate, "Data non valida.");
const text = (max: number) => z.string().trim().max(max);

export const overallRatings = {
  1: "Male",
  2: "Così così",
  3: "Bene",
  4: "Molto bene",
  5: "Benissimo",
} as const;
export const sessionLengths = {
  right: "Giusta",
  long: "Troppo lunga",
  short: "Troppo corta",
} as const;

export const raceInput = z.object({
  name: text(120).min(1, "Inserisci il nome della gara."),
  date: day,
  location: text(120),
  notes: text(500).optional(),
});
export const race = raceInput.extend({
  id: identifier,
  createdAt: z.iso.datetime({ offset: true }),
  /** Coach who added it; absent when the student did. */
  addedBy: text(120).optional(),
});
export type Race = z.infer<typeof race>;
export type RaceInput = z.infer<typeof raceInput>;
export const races = z.array(race).max(300);

export const cycleFeedback = z.object({
  assignmentId: identifier,
  assignmentCreatedAt: z.iso.datetime({ offset: true }),
  submittedAt: z.iso.datetime({ offset: true }),
  rating: z.number().int().min(1).max(5),
  sessionLength: z.enum(["right", "long", "short"]),
  sessionsPerWeek: z.number().int().min(1).max(14),
  changes: text(3000),
  notes: text(5000),
});
export type CycleFeedback = z.infer<typeof cycleFeedback>;
export const cycleFeedbacks = z.array(cycleFeedback).max(500);

export const feedbackCommand = z.object({
  assignmentId: identifier,
  assignmentCreatedAt: z.iso.datetime({ offset: true }),
  rating: cycleFeedback.shape.rating,
  sessionLength: cycleFeedback.shape.sessionLength,
  sessionsPerWeek: cycleFeedback.shape.sessionsPerWeek,
  changes: cycleFeedback.shape.changes,
  notes: cycleFeedback.shape.notes,
  /** Upcoming races the student no longer takes part in. */
  removeRaces: z.array(identifier).max(100),
  addRaces: z.array(raceInput).max(20),
});
export type FeedbackCommand = z.infer<typeof feedbackCommand>;

export const raceCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), race: raceInput }),
  z.object({ action: z.literal("update"), id: identifier, race: raceInput }),
  z.object({ action: z.literal("remove"), id: identifier }),
]);
export type RaceCommand = z.infer<typeof raceCommand>;

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Last day of a plan: the program end date, else the end of its month. */
export function planEndDate(assignment: PlanAssignment) {
  if (assignment.snapshot.program?.endsOn)
    return assignment.snapshot.program.endsOn;
  const [y, m] = assignment.month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
}
/** Planned sessions per week, as a starting point for the next plan. */
export function plannedSessionsPerWeek(assignment: PlanAssignment) {
  const weeks = new Map<number, number>();
  for (const s of assignment.snapshot.sessions)
    weeks.set(s.week ?? 1, (weeks.get(s.week ?? 1) ?? 0) + 1);
  return Math.max(1, Math.min(14, Math.max(0, ...weeks.values())));
}

export const feedbackOpensDaysBefore = 7;
export const feedbackStaysOpenDays = 45;
/**
 * The questionnaire opens in the last week of the plan (or once every session
 * is done) and stays available for a while after it ends.
 */
export function feedbackIsOpen(
  assignment: PlanAssignment,
  entries: WorkoutEntry[],
  today: string,
) {
  const end = planEndDate(assignment);
  if (today > shift(end, feedbackStaysOpenDays)) return false;
  if (today >= shift(end, -(feedbackOpensDaysBefore - 1))) return true;
  const done = new Set(
    entries
      .filter(
        (e) =>
          e.completed &&
          e.assignmentId === assignment.id &&
          e.assignmentCreatedAt === assignment.createdAt,
      )
      .map((e) => e.sessionId),
  );
  return (
    assignment.snapshot.sessions.length > 0 &&
    assignment.snapshot.sessions.every((s) => done.has(s.id))
  );
}
export function feedbackFor(
  student: Pick<CrmStudent, "cycleFeedback">,
  assignment: PlanAssignment,
) {
  return student.cycleFeedback?.find(
    (f) =>
      f.assignmentId === assignment.id &&
      f.assignmentCreatedAt === assignment.createdAt,
  );
}
/** The plan whose questionnaire the student should fill in now, if any. */
export function pendingFeedback(
  student: Pick<CrmStudent, "cycleFeedback">,
  assignments: PlanAssignment[],
  entries: WorkoutEntry[],
  today: string,
) {
  return assignments
    .filter(
      (a) => feedbackIsOpen(a, entries, today) && !feedbackFor(student, a),
    )
    .toSorted((a, b) => b.month.localeCompare(a.month))[0];
}
export const upcomingRaces = (list: Race[] | undefined, today: string) =>
  (list ?? [])
    .filter((r) => r.date >= today)
    .toSorted((a, b) => a.date.localeCompare(b.date));

const newRace = (input: RaceInput, now: Date, addedBy?: string): Race => ({
  name: input.name.trim(),
  date: input.date,
  location: input.location.trim(),
  ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  id: crypto.randomUUID(),
  createdAt: now.toISOString(),
  ...(addedBy ? { addedBy } : {}),
});
const raceLimit = (list: Race[]) => {
  if (list.length > 300)
    throw new Error("Hai raggiunto il numero massimo di gare salvate.");
  return list;
};
function updateStudent(
  state: CrmState,
  id: string,
  patch: (s: CrmStudent) => Partial<CrmStudent>,
): CrmState {
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === id ? { ...s, ...patch(s) } : s,
    ),
  };
}

/** Student submits (or updates) the questionnaire of one monthly plan. */
export function applyFeedback(
  state: CrmState,
  studentId: string,
  command: FeedbackCommand,
  today: string,
  now = new Date(),
): CrmState {
  const student = state.students.find(
    (s) => s.id === studentId && !s.archived && !s.accessDisabled,
  );
  if (!student) throw new Error("Studente non disponibile.");
  const assignment = state.assignments?.find(
    (a) => a.id === command.assignmentId && a.studentId === studentId,
  );
  if (!assignment || assignment.createdAt !== command.assignmentCreatedAt)
    throw new Error("Il piano è cambiato. Aggiorna la pagina.");
  if (
    !feedbackFor(student, assignment) &&
    !feedbackIsOpen(assignment, student.workoutEntries ?? [], today)
  )
    throw new Error("Il questionario si apre nell’ultima settimana del piano.");
  if (command.addRaces.some((r) => r.date < today))
    throw new Error("Inserisci solo gare con data futura.");
  const current = student.races ?? [];
  if (command.removeRaces.some((id) => !current.some((r) => r.id === id)))
    throw new Error("L’elenco gare è cambiato. Aggiorna la pagina.");
  const feedback: CycleFeedback = {
    assignmentId: assignment.id,
    assignmentCreatedAt: assignment.createdAt,
    submittedAt: now.toISOString(),
    rating: command.rating,
    sessionLength: command.sessionLength,
    sessionsPerWeek: command.sessionsPerWeek,
    changes: command.changes.trim(),
    notes: command.notes.trim(),
  };
  return updateStudent(state, studentId, (s) => ({
    cycleFeedback: [
      ...(s.cycleFeedback ?? []).filter(
        (f) =>
          !(
            f.assignmentId === feedback.assignmentId &&
            f.assignmentCreatedAt === feedback.assignmentCreatedAt
          ),
      ),
      feedback,
    ],
    races: raceLimit([
      ...current.filter((r) => !command.removeRaces.includes(r.id)),
      ...command.addRaces.map((r) => newRace(r, now)),
    ]),
  }));
}

/** Students manage their races; staff pass their name and may edit any race. */
export function applyRaceCommand(
  state: CrmState,
  studentId: string,
  command: RaceCommand,
  today: string,
  now = new Date(),
  staffName?: string,
): CrmState {
  const student = state.students.find(
    (s) =>
      s.id === studentId &&
      !s.archived &&
      (staffName !== undefined || !s.accessDisabled),
  );
  if (!student) throw new Error("Studente non disponibile.");
  const current = student.races ?? [];
  if (command.action !== "remove" && command.race.date < today && !staffName)
    throw new Error("Inserisci solo gare con data futura.");
  if (command.action === "add")
    return updateStudent(state, studentId, () => ({
      races: raceLimit([...current, newRace(command.race, now, staffName)]),
    }));
  const existing = current.find((r) => r.id === command.id);
  if (!existing) throw new Error("La gara non esiste più. Aggiorna la pagina.");
  return updateStudent(state, studentId, () => ({
    races:
      command.action === "remove"
        ? current.filter((r) => r.id !== command.id)
        : current.map((r) =>
            r.id === command.id
              ? {
                  ...newRace(command.race, now, r.addedBy),
                  id: r.id,
                  createdAt: r.createdAt,
                }
              : r,
          ),
  }));
}

/** Races in the next `days` days across students, for the coach reminder. */
export function racesSoon(state: CrmState, today: string, days = 14) {
  const until = shift(today, days);
  return state.students
    .filter((s) => !s.archived)
    .flatMap((student) =>
      (student.races ?? [])
        .filter((r) => r.date >= today && r.date <= until)
        .map((race) => ({ student, race })),
    )
    .toSorted((a, b) => a.race.date.localeCompare(b.race.date));
}
export const daysUntil = (today: string, date: string) =>
  Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );
