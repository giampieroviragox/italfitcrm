import type {
  PlanAssignment,
  WorkoutExercise,
  WorkoutPlan,
  WorkoutSession,
} from "./fitness-model.ts";
import type { CrmState } from "./model.ts";
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
  mesiConPiano: string[];
}

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
      mesiConPiano: (state.assignments ?? [])
        .filter((assignment) => assignment.studentId === student.id)
        .map((assignment) => assignment.month)
        .sort(),
    };
  }
}

export type McpStudentPlan =
  | { trovato: false; motivo: string; mesiDisponibili?: string[] }
  | {
      trovato: true;
      studente: string;
      mese: string;
      modelloId: string;
      piano: PlanAssignment["snapshot"];
    };

export function mcpStudentPlan(
  state: CrmState,
  studentId: string,
  month?: string,
): McpStudentPlan {
  const student = state.students.find(
    (item) => item.id === studentId && !item.archived,
  );
  if (!student)
    return {
      trovato: false,
      motivo: "Studente non trovato. Usa cerca_studenti per ottenere l’ID.",
    };
  const assignments = (state.assignments ?? [])
    .filter((assignment) => assignment.studentId === student.id)
    .sort((a, b) => a.month.localeCompare(b.month));
  const months = assignments.map((assignment) => assignment.month);
  const assignment = month
    ? assignments.find((item) => item.month === month)
    : assignments.at(-1);
  if (!assignment)
    return {
      trovato: false,
      motivo: month
        ? `Nessun piano assegnato per ${month}.`
        : "Lo studente non ha ancora piani assegnati.",
      mesiDisponibili: months,
    };
  return {
    trovato: true,
    studente: `${student.firstName} ${student.lastName}`.trim(),
    mese: assignment.month,
    modelloId: assignment.planId,
    piano: assignment.snapshot,
  };
}

export interface McpPlanSummary {
  id: string;
  titolo: string;
  stato: WorkoutPlan["status"];
  sessioni: number;
  obiettivo?: string;
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

Date e mesi nel fuso Europe/Rome; il mese di assegnazione è nel formato "AAAA-MM".

Salvataggio: salva_bozza_piano crea una nuova bozza oppure, con modelloId, sostituisce il contenuto di una bozza esistente. I piani pubblicati non si modificano: si crea una nuova bozza (anche partendo da leggi_modello_piano). La pubblicazione e l’assegnazione allo studente le fa l’admin nel CRM dal link restituito.`;

export interface McpDraftInput {
  modelloId?: string;
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
  };
  const plans = existing
    ? (state.plans ?? []).map((item) => (item.id === plan.id ? plan : item))
    : [...(state.plans ?? []), plan];
  return { state: { ...state, plans }, plan, created: !existing };
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
