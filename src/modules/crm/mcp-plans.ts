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
