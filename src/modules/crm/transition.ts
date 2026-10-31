import type { CrmState } from "./model.ts";
import { isCrmState } from "./schema.ts";
import { assertCrmTransition, sanitizeDirectory } from "./logic.ts";
import { reconcileFitness } from "./fitness-logic.ts";
export function prepareTransition(
  current: CrmState,
  proposed: CrmState,
  actor?: { id: string; name: string },
): CrmState {
  const edited = reconcileFitness(proposed);
  assertCrmTransition(current, edited);
  const now = new Date().toISOString();
  const next: CrmState = {
    ...edited,
    views: (edited.views ?? []).map((v) => ({
      ...v,
      config: sanitizeDirectory(v.config, edited),
    })),
    directory: edited.directory
      ? sanitizeDirectory(edited.directory, edited)
      : undefined,
    students: edited.students.map((student) => {
      const old = current.students.find((s) => s.id === student.id);
      const related = (data: CrmState, key: "assignments" | "bookings") =>
        JSON.stringify(
          (data[key] ?? []).filter((x) => x.studentId === student.id),
        );
      const planChanged =
        related(current, "assignments") !== related(edited, "assignments");
      const bookingChanged =
        related(current, "bookings") !== related(edited, "bookings");
      if (
        JSON.stringify(old) === JSON.stringify(student) &&
        !planChanged &&
        !bookingChanged
      )
        return student;
      const changes: string[] = [];
      if (planChanged) changes.push("Piano mensile aggiornato");
      if (bookingChanged) changes.push("Iscrizioni alle lezioni aggiornate");
      if (!old) changes.push("Scheda creata");
      else {
        if (Boolean(old.archived) !== Boolean(student.archived))
          changes.push(
            student.archived ? "Studente archiviato" : "Studente ripristinato",
          );
        if (old.tierId !== student.tierId) changes.push("Tier aggiornato");
        if (old.status !== student.status) changes.push("Stato aggiornato");
        if (
          JSON.stringify(old.properties) !== JSON.stringify(student.properties)
        )
          changes.push("Proprietà CRM aggiornate");
        if (JSON.stringify(old.notes) !== JSON.stringify(student.notes))
          changes.push("Nota aggiunta");
        if (
          ["firstName", "lastName", "email", "phone", "coach", "tags"].some(
            (k) =>
              JSON.stringify(old[k as keyof typeof old]) !==
              JSON.stringify(student[k as keyof typeof student]),
          )
        )
          changes.push("Anagrafica aggiornata");
      }
      return {
        ...student,
        revision: (old?.revision ?? 0) + 1,
        history: [
          ...(old?.history ?? []),
          ...changes.map((text) => ({
            id: crypto.randomUUID(),
            ...(actor ? { actorId: actor.id, actorName: actor.name } : {}),
            text,
            createdAt: now,
          })),
        ],
      };
    }),
  };
  if (!isCrmState(next))
    throw new Error("I dati non sono validi. Ricontrolla i campi.");

  return next;
}
