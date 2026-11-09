import type { PlanAssignment, WorkoutPlan } from "./fitness-model.ts";
import type { CrmState } from "./model.ts";
import { studentTierLabel } from "./student-tiers.ts";
import { studentAccess } from "./tier-access.ts";

// Read-only projections exposed to the MCP connector. They never include
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

export function mcpStudents(
  state: CrmState,
  query = "",
  limit = 25,
): McpStudentSummary[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return state.students
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
    )
    .slice(0, limit)
    .map((student) => ({
      id: student.id,
      nome: `${student.firstName} ${student.lastName}`.trim(),
      tier: studentTierLabel(student, state.tiers),
      pianiAbilitati: studentAccess(state, student).plans,
      mesiConPiano: (state.assignments ?? [])
        .filter((assignment) => assignment.studentId === student.id)
        .map((assignment) => assignment.month)
        .sort(),
    }));
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

Sessione: { id, name, week?, day?, kind?, preparation?, cooldown?, guidance?, exercises[] }
- id univoco nel piano; name obbligatorio.
- week: intero da 1 a 52. day: testo (es. "Lunedì").
- kind: "strength" (forza) oppure "run" (corsa).
- preparation = riscaldamento, cooldown = defaticamento, guidance = indicazioni per lo studente.
- exercises: massimo 30 per sessione, almeno uno per poter pubblicare.

Esercizio: { id, name, sets, reps, restSeconds, notes, videoUrl? }
- id univoco nella sessione; name obbligatorio.
- sets: intero da 1 a 20.
- reps: testo per ripetizioni o durata (es. "8-10", "45 s", "5 km a Z2").
- restSeconds: intero da 0 a 900.
- notes: testo, anche vuoto. videoUrl: link http/https facoltativo.

Date e mesi nel fuso Europe/Rome; il mese di assegnazione è nel formato "AAAA-MM".`;
