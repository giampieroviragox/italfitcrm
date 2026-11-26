import {
  feedbackFor,
  overallRatings,
  sessionLengths,
  upcomingRaces,
} from "./cycle-feedback.ts";
import { loggedSessions, setLabel } from "./workout-log.ts";
import { todayRome } from "./fitness-logic.ts";
import type {
  PlanAssignment,
  WorkoutExercise,
  WorkoutPlan,
  WorkoutSession,
} from "./fitness-model.ts";
import type { CrmState } from "./model.ts";
import {
  assignmentPeriod,
  byStart,
  guidedLabel,
  isGuidedCategory,
  type GuidedCategory,
} from "./plan-cycles.ts";
import { studentTierLabel } from "./student-tiers.ts";
import { studentAccess } from "./tier-access.ts";

// Projections and draft writes for the MCP connector. Reads never include
// contacts, internal notes, CRM properties, history or other admins.

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface McpStudentSummary {
  id: string;
  nome: string;
  tier: string;
  pianiAbilitati: boolean;
  /** Assigned four-week cycles, oldest first. */
  cicli: McpCycle[];
  /** Guided programs the student follows. */
  programmiGuidati: string[];
}
export interface McpCycle {
  inizio: string;
  fine: string;
  titolo: string;
  programmaGuidato?: string;
}
const cycleSummary = (a: PlanAssignment): McpCycle => {
  const p = assignmentPeriod(a);
  return {
    inizio: p.startsOn,
    fine: p.endsOn,
    titolo: a.snapshot.title,
    ...(a.guidedCategory
      ? { programmaGuidato: guidedLabel(a.guidedCategory) }
      : {}),
  };
};

export interface McpStudentList {
  /** Students matching the search, before the limit. */
  totale: number;
  /** True when every matching student is listed. */
  completo: boolean;
  studenti: McpStudentSummary[];
}

export function mcpStudents(
  state: CrmState,
  query = "",
  limit = 50,
): McpStudentList {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = state.students
    .filter((student) => !student.archived)
    .filter((student) => {
      const name = normalize(`${student.firstName} ${student.lastName}`);
      return terms.every((term) => name.includes(term));
    })
    .sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
        "it",
      ),
    );
  return {
    totale: matches.length,
    completo: matches.length <= limit,
    studenti: matches.slice(0, limit).map(summary),
  };
  function summary(student: CrmState["students"][number]) {
    return {
      id: student.id,
      nome: `${student.firstName} ${student.lastName}`.trim(),
      tier: studentTierLabel(student, state.tiers),
      pianiAbilitati: studentAccess(state, student).plans,
      cicli: byStart(
        (state.assignments ?? []).filter(
          (assignment) => assignment.studentId === student.id,
        ),
      ).map(cycleSummary),
      programmiGuidati: (student.guidedPrograms ?? []).map((g) =>
        guidedLabel(g.category),
      ),
    };
  }
}

export type McpStudentPlan =
  | { trovato: false; motivo: string; cicliDisponibili?: McpCycle[] }
  | {
      trovato: true;
      studente: string;
      /** The four-week cycle (start and end day). */
      periodo: { inizio: string; fine: string };
      programmaGuidato?: string;
      modelloId: string;
      piano: PlanAssignment["snapshot"];
      /** Questionnaire answers for this plan, when submitted. */
      feedbackFinePiano?: {
        comeEAndato: string;
        durataSessioni: string;
        sessioniSettimanaProssimoPiano: number;
        daCambiare: string;
        note: string;
        inviatoIl: string;
      };
      /** What the student logged for each completed session. */
      registroAllenamenti: {
        sessione: string;
        data: string;
        fatica?: number;
        note: string;
        esercizi: { esercizio: string; serie: string[] }[];
      }[];
      gareInProgramma: {
        nome: string;
        data: string;
        luogo: string;
        note?: string;
      }[];
    };

/**
 * A student's plan: the cycle covering a day (AAAA-MM-GG), the latest cycle
 * starting in a month (AAAA-MM), or the latest cycle. Personalized plans first.
 */
export function mcpStudentPlan(
  state: CrmState,
  studentId: string,
  when?: string,
): McpStudentPlan {
  const student = state.students.find(
    (item) => item.id === studentId && !item.archived,
  );
  if (!student)
    return {
      trovato: false,
      motivo: "Studente non trovato. Usa cerca_studenti per ottenere l’ID.",
    };
  const assignments = byStart(
    (state.assignments ?? []).filter(
      (assignment) => assignment.studentId === student.id,
    ),
  );
  const matching = assignments.filter((item) => {
    if (!when) return true;
    const p = assignmentPeriod(item);
    return when.length === 7
      ? p.startsOn.startsWith(when)
      : p.startsOn <= when && when <= p.endsOn;
  });
  // Latest start wins; at equal start the personalized plan comes last, so it wins.
  const assignment = byStart(matching)
    .toSorted(
      (a, b) =>
        assignmentPeriod(a).startsOn.localeCompare(
          assignmentPeriod(b).startsOn,
        ) ||
        Number(Boolean(b.guidedCategory)) - Number(Boolean(a.guidedCategory)),
    )
    .at(-1);
  if (!assignment)
    return {
      trovato: false,
      motivo: when
        ? `Nessun piano assegnato per ${when}.`
        : "Lo studente non ha ancora piani assegnati.",
      cicliDisponibili: byStart(assignments).map(cycleSummary),
    };
  const feedback = feedbackFor(student, assignment);
  return {
    trovato: true,
    studente: `${student.firstName} ${student.lastName}`.trim(),
    periodo: {
      inizio: assignmentPeriod(assignment).startsOn,
      fine: assignmentPeriod(assignment).endsOn,
    },
    ...(assignment.guidedCategory
      ? { programmaGuidato: guidedLabel(assignment.guidedCategory) }
      : {}),
    modelloId: assignment.planId,
    piano: assignment.snapshot,
    ...(feedback
      ? {
          feedbackFinePiano: {
            comeEAndato:
              overallRatings[feedback.rating as keyof typeof overallRatings],
            durataSessioni: sessionLengths[feedback.sessionLength],
            sessioniSettimanaProssimoPiano: feedback.sessionsPerWeek,
            daCambiare: feedback.changes,
            note: feedback.notes,
            inviatoIl: feedback.submittedAt,
          },
        }
      : {}),
    registroAllenamenti: loggedSessions(
      [assignment],
      student.workoutEntries ?? [],
    )
      .toReversed()
      .map(({ entry, session, date }) => ({
        sessione: session.name,
        data: date,
        ...(entry.rpe ? { fatica: entry.rpe } : {}),
        note: entry.notes,
        esercizi: (entry.exercises ?? []).flatMap((log) => {
          const exercise = session.exercises.find(
            (e) => e.id === log.exerciseId,
          );
          return exercise
            ? [{ esercizio: exercise.name, serie: log.sets.map(setLabel) }]
            : [];
        }),
      })),
    gareInProgramma: upcomingRaces(student.races, todayRome()).map((r) => ({
      nome: r.name,
      data: r.date,
      luogo: r.location,
      ...(r.notes ? { note: r.notes } : {}),
    })),
  };
}

export interface McpPlanSummary {
  id: string;
  titolo: string;
  stato: WorkoutPlan["status"];
  sessioni: number;
  obiettivo?: string;
  /** Client the plan belongs to, or guided program it is a version of. */
  studenteId?: string;
  programmaGuidato?: GuidedCategory;
}

export function mcpPlanTemplates(state: CrmState): McpPlanSummary[] {
  return (state.plans ?? [])
    .filter((plan) => plan.status !== "archived")
    .map((plan) => ({
      id: plan.id,
      titolo: plan.title,
      stato: plan.status,
      sessioni: plan.sessions.length,
      ...(plan.program?.goal ? { obiettivo: plan.program.goal } : {}),
      ...(plan.studentId ? { studenteId: plan.studentId } : {}),
      ...(plan.guidedCategory ? { programmaGuidato: plan.guidedCategory } : {}),
    }));
}

export function mcpPlanTemplate(
  state: CrmState,
  planId: string,
): WorkoutPlan | null {
  return (
    (state.plans ?? []).find(
      (plan) => plan.id === planId && plan.status !== "archived",
    ) ?? null
  );
}

export const mcpPlanFormat = `Formato dei piani Team Italfit (JSON).

Piano: { title, description, program?, sessions[] }
- title, description: testo.
- program (facoltativo): { goal, startsOn: "AAAA-MM-GG", endsOn: "AAAA-MM-GG" (non prima di startsOn), guidance, paceZones: [{ name, pace }] (massimo 12) }.
- sessions: massimo 52 sessioni.

Sessione: { id?, name, week?, day?, kind?, preparation?, cooldown?, guidance?, exercises[] }
- id facoltativo (lo genera il CRM); se presente deve essere univoco nel piano. name obbligatorio.
- week: intero da 1 a 52. day: testo (es. "Lunedì").
- kind: "strength" (forza) oppure "run" (corsa).
- preparation = riscaldamento, cooldown = defaticamento, guidance = indicazioni per lo studente.
- exercises: massimo 30 per sessione, almeno uno per poter pubblicare.

Esercizio: { id?, name, sets, reps, restSeconds, notes?, videoUrl? }
- id facoltativo (lo genera il CRM); se presente deve essere univoco nella sessione. name obbligatorio.
- sets: intero da 1 a 20.
- reps: testo per ripetizioni o durata (es. "8-10", "45 s", "5 km a Z2").
- restSeconds: intero da 0 a 900.
- notes: testo, anche vuoto. videoUrl: link http/https facoltativo.

Date nel fuso Europe/Rome, formato "AAAA-MM-GG". Ogni piano dura un ciclo di 4 settimane (28 giorni): l'admin sceglie il giorno di inizio quando lo assegna, di norma il giorno dopo la fine del ciclo precedente.

Destinatario: ogni nuova bozza appartiene a un cliente del Coaching online { studenteId } (ID da cerca_studenti) oppure a un programma guidato { programmaGuidato: "hyrox" | "old-school" | "hybrid" | "home-edition" }. La bozza compare subito nella pagina del cliente o del programma.

Salvataggio: salva_bozza_piano crea una nuova bozza oppure, con modelloId, sostituisce il contenuto di una bozza esistente. I piani pubblicati non si modificano: si crea una nuova bozza (anche partendo da leggi_modello_piano). La pubblicazione e l’assegnazione del ciclo le fa l’admin nel CRM dal link restituito.`;

/** Where a new draft belongs. */
export type McpRecipient =
  | { studenteId: string; programmaGuidato?: undefined }
  | { programmaGuidato: string; studenteId?: undefined };
export interface McpDraftInput {
  modelloId?: string;
  destinatario?: McpRecipient;
  title: string;
  description: string;
  program?: WorkoutPlan["program"];
  sessions: (Omit<WorkoutSession, "id" | "exercises"> & {
    id?: string;
    exercises: (Omit<WorkoutExercise, "id" | "notes"> & {
      id?: string;
      notes?: string;
    })[];
  })[];
}

/**
 * Applies a draft written by the connector. Only drafts can be created or
 * replaced; the full CRM validation still runs when the state is saved.
 */
export function applyDraftPlan(
  state: CrmState,
  input: McpDraftInput,
  newId: () => string,
): { state: CrmState; plan: WorkoutPlan; created: boolean } {
  const existing = input.modelloId
    ? (state.plans ?? []).find((plan) => plan.id === input.modelloId)
    : undefined;
  if (input.modelloId && !existing)
    throw new Error(
      "Modello non trovato. Ometti modelloId per creare una nuova bozza.",
    );
  if (existing && existing.status !== "draft")
    throw new Error(
      "Questo modello è già pubblicato o archiviato e non si modifica: ometti modelloId per salvarlo come nuova bozza.",
    );
  const owner = draftOwner(state, input.destinatario, existing);
  const sessionIds = new Set<string>();
  const sessions: WorkoutSession[] = input.sessions.map((session) => {
    const id = session.id?.trim() || newId();
    if (sessionIds.has(id)) throw new Error(`Sessione duplicata: ${id}.`);
    sessionIds.add(id);
    const exerciseIds = new Set<string>();
    return {
      ...session,
      id,
      exercises: session.exercises.map((exercise) => {
        const exerciseId = exercise.id?.trim() || newId();
        if (exerciseIds.has(exerciseId))
          throw new Error(`Esercizio duplicato: ${exerciseId}.`);
        exerciseIds.add(exerciseId);
        return { ...exercise, id: exerciseId, notes: exercise.notes ?? "" };
      }),
    };
  });
  const plan: WorkoutPlan = {
    id: existing?.id ?? newId(),
    title: input.title.trim(),
    description: input.description.trim(),
    status: "draft",
    sessions,
    ...(input.program ? { program: input.program } : {}),
    ...owner,
  };
  const plans = existing
    ? (state.plans ?? []).map((item) => (item.id === plan.id ? plan : item))
    : [...(state.plans ?? []), plan];
  return { state: { ...state, plans }, plan, created: !existing };
}

/** The client or guided program of a draft; a new draft must have one. */
function draftOwner(
  state: CrmState,
  recipient: McpRecipient | undefined,
  existing: WorkoutPlan | undefined,
): Pick<WorkoutPlan, "studentId" | "guidedCategory"> {
  const kept = existing
    ? {
        ...(existing.studentId ? { studentId: existing.studentId } : {}),
        ...(existing.guidedCategory
          ? { guidedCategory: existing.guidedCategory }
          : {}),
      }
    : {};
  if (!recipient) {
    if (existing) return kept;
    throw new Error(
      "Indica il destinatario: { studenteId } per un cliente oppure { programmaGuidato } per un programma guidato.",
    );
  }
  let owner: Pick<WorkoutPlan, "studentId" | "guidedCategory">;
  if (recipient.studenteId) {
    const student = state.students.find(
      (s) => s.id === recipient.studenteId && !s.archived,
    );
    if (!student)
      throw new Error("Studente non trovato. Usa cerca_studenti per l’ID.");
    if (!studentAccess(state, student).plans)
      throw new Error("Il tier dello studente non include i piani.");
    owner = { studentId: student.id };
  } else if (isGuidedCategory(recipient.programmaGuidato)) {
    owner = { guidedCategory: recipient.programmaGuidato };
  } else
    throw new Error(
      'Programma guidato non valido: usa "hyrox", "old-school", "hybrid" o "home-edition".',
    );
  if (
    existing &&
    (existing.studentId || existing.guidedCategory) &&
    (existing.studentId !== owner.studentId ||
      existing.guidedCategory !== owner.guidedCategory)
  )
    throw new Error(
      "La bozza appartiene a un altro destinatario: ometti modelloId per crearne una nuova.",
    );
  return owner;
}

type NewExercise = Omit<WorkoutExercise, "id" | "notes"> & { notes?: string };
type NewSession = Omit<WorkoutSession, "id" | "exercises"> & {
  exercises: NewExercise[];
};
type Nullable<T> = { [K in keyof T]?: T[K] | null };
type SessionFields = Nullable<Omit<WorkoutSession, "id" | "exercises">>;
type ExerciseFields = Nullable<Omit<WorkoutExercise, "id">>;

/** Targeted edits on a draft; positions use "after id" (null = first). */
export type McpPlanEdit =
  | {
      tipo: "piano";
      title?: string;
      description?: string;
      program?: WorkoutPlan["program"] | null;
    }
  | { tipo: "modifica_sessione"; sessioneId: string; campi: SessionFields }
  | {
      tipo: "aggiungi_sessione";
      sessione: NewSession;
      dopoSessioneId?: string | null;
    }
  | { tipo: "rimuovi_sessione"; sessioneId: string }
  | {
      tipo: "sposta_sessione";
      sessioneId: string;
      dopoSessioneId: string | null;
    }
  | {
      tipo: "modifica_esercizio";
      sessioneId: string;
      esercizioId: string;
      campi: ExerciseFields;
    }
  | {
      tipo: "aggiungi_esercizio";
      sessioneId: string;
      esercizio: NewExercise;
      dopoEsercizioId?: string | null;
    }
  | { tipo: "rimuovi_esercizio"; sessioneId: string; esercizioId: string }
  | {
      tipo: "sposta_esercizio";
      sessioneId: string;
      esercizioId: string;
      versoSessioneId?: string;
      dopoEsercizioId: string | null;
    };

const required = new Set(["name", "sets", "reps", "restSeconds", "notes"]);

function patch<T extends object>(target: T, fields: object, keep: Set<string>) {
  const next = { ...target } as Record<string, unknown>;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value === null) {
      if (keep.has(key)) throw new Error(`Il campo ${key} è obbligatorio.`);
      delete next[key];
    } else next[key] = typeof value === "string" ? value.trim() : value;
  }
  return next as T;
}

/** Inserts after the given id: undefined = at the end, null = at the start. */
function insertAfter<T extends { id: string }>(
  items: T[],
  item: T,
  afterId: string | null | undefined,
  label: string,
): T[] {
  if (afterId === undefined) return [...items, item];
  if (afterId === null) return [item, ...items];
  const index = items.findIndex((x) => x.id === afterId);
  if (index < 0) throw new Error(`${label} ${afterId} non trovato.`);
  return [...items.slice(0, index + 1), item, ...items.slice(index + 1)];
}

export function applyPlanEdits(
  state: CrmState,
  planId: string,
  edits: McpPlanEdit[],
  newId: () => string,
): { state: CrmState; plan: WorkoutPlan; changes: string[] } {
  const original = (state.plans ?? []).find((plan) => plan.id === planId);
  if (!original) throw new Error("Modello non trovato.");
  if (original.status !== "draft")
    throw new Error(
      "Si possono modificare solo le bozze. Per cambiare un piano pubblicato, l’admin lo riporta in bozza dal CRM oppure si crea una nuova bozza.",
    );
  let plan: WorkoutPlan = structuredClone(original);
  const changes: string[] = [];
  const sessionOf = (id: string) => {
    const session = plan.sessions.find((s) => s.id === id);
    if (!session) throw new Error(`Sessione ${id} non trovata.`);
    return session;
  };
  const exerciseOf = (session: WorkoutSession, id: string) => {
    const exercise = session.exercises.find((e) => e.id === id);
    if (!exercise)
      throw new Error(`Esercizio ${id} non trovato in “${session.name}”.`);
    return exercise;
  };
  const withSession = (
    id: string,
    update: (s: WorkoutSession) => WorkoutSession,
  ) => {
    sessionOf(id);
    plan = {
      ...plan,
      sessions: plan.sessions.map((s) => (s.id === id ? update(s) : s)),
    };
  };
  const exercise = (input: NewExercise): WorkoutExercise => ({
    ...input,
    id: newId(),
    notes: input.notes ?? "",
  });
  edits.forEach((edit, index) => {
    try {
      switch (edit.tipo) {
        case "piano": {
          const { program, ...fields } = edit;
          plan = patch(
            plan,
            { title: fields.title, description: fields.description },
            new Set(["title", "description"]),
          );
          if (program === null) delete plan.program;
          else if (program) plan = { ...plan, program };
          changes.push("Dati del piano aggiornati");
          break;
        }
        case "modifica_sessione":
          withSession(edit.sessioneId, (s) =>
            patch(s, edit.campi, new Set(["name"])),
          );
          changes.push(
            `Sessione “${sessionOf(edit.sessioneId).name}” modificata`,
          );
          break;
        case "aggiungi_sessione": {
          const session: WorkoutSession = {
            ...edit.sessione,
            id: newId(),
            exercises: edit.sessione.exercises.map(exercise),
          };
          plan = {
            ...plan,
            sessions: insertAfter(
              plan.sessions,
              session,
              edit.dopoSessioneId,
              "Sessione",
            ),
          };
          changes.push(`Sessione “${session.name}” aggiunta`);
          break;
        }
        case "rimuovi_sessione": {
          const session = sessionOf(edit.sessioneId);
          plan = {
            ...plan,
            sessions: plan.sessions.filter((s) => s.id !== session.id),
          };
          changes.push(`Sessione “${session.name}” rimossa`);
          break;
        }
        case "sposta_sessione": {
          const session = sessionOf(edit.sessioneId);
          if (edit.dopoSessioneId === session.id) break;
          const rest = plan.sessions.filter((s) => s.id !== session.id);
          plan = {
            ...plan,
            sessions: insertAfter(
              rest,
              session,
              edit.dopoSessioneId,
              "Sessione",
            ),
          };
          changes.push(`Sessione “${session.name}” spostata`);
          break;
        }
        case "modifica_esercizio":
          withSession(edit.sessioneId, (s) => {
            const current = exerciseOf(s, edit.esercizioId);
            return {
              ...s,
              exercises: s.exercises.map((e) =>
                e.id === current.id ? patch(e, edit.campi, required) : e,
              ),
            };
          });
          changes.push(
            `Esercizio “${exerciseOf(sessionOf(edit.sessioneId), edit.esercizioId).name}” modificato`,
          );
          break;
        case "aggiungi_esercizio": {
          const created = exercise(edit.esercizio);
          withSession(edit.sessioneId, (s) => ({
            ...s,
            exercises: insertAfter(
              s.exercises,
              created,
              edit.dopoEsercizioId,
              "Esercizio",
            ),
          }));
          changes.push(`Esercizio “${created.name}” aggiunto`);
          break;
        }
        case "rimuovi_esercizio": {
          const removed = exerciseOf(
            sessionOf(edit.sessioneId),
            edit.esercizioId,
          );
          withSession(edit.sessioneId, (s) => ({
            ...s,
            exercises: s.exercises.filter((e) => e.id !== removed.id),
          }));
          changes.push(`Esercizio “${removed.name}” rimosso`);
          break;
        }
        case "sposta_esercizio": {
          const moved = exerciseOf(
            sessionOf(edit.sessioneId),
            edit.esercizioId,
          );
          const target = edit.versoSessioneId ?? edit.sessioneId;
          sessionOf(target);
          if (target === edit.sessioneId && edit.dopoEsercizioId === moved.id)
            break;
          withSession(edit.sessioneId, (s) => ({
            ...s,
            exercises: s.exercises.filter((e) => e.id !== moved.id),
          }));
          withSession(target, (s) => ({
            ...s,
            exercises: insertAfter(
              s.exercises,
              moved,
              edit.dopoEsercizioId,
              "Esercizio",
            ),
          }));
          changes.push(`Esercizio “${moved.name}” spostato`);
          break;
        }
      }
    } catch (error) {
      throw new Error(
        `Operazione ${index + 1} (${edit.tipo}): ${(error as Error).message}`,
      );
    }
  });
  const plans = (state.plans ?? []).map((item) =>
    item.id === plan.id ? plan : item,
  );
  return { state: { ...state, plans }, plan, changes };
}
