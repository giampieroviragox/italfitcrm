import type { CrmState } from "./model.ts";
import { isCrmState } from "./schema.ts";
import { assertCrmTransition, sanitizeDirectory } from "./logic.ts";
import { reconcileFitness } from "./fitness-logic.ts";
import { studentChanges } from "./activity.ts";
export function prepareTransition(
  current: CrmState,
  proposed: CrmState,
  actor?: { id: string; name: string },
): CrmState {
  const now = new Date().toISOString();
  const edited = reconcileFitness({
    ...proposed,
    students: proposed.students.map((student) => {
      const old = current.students.find((s) => s.id === student.id);
      const notes = student.notes ?? [];
      if (new Set(notes.map((n) => n.id)).size !== notes.length)
        throw new Error("Commenti duplicati. Ricarica e riprova.");
      if (
        (old?.notes ?? []).some(
          (n) =>
            !notes.some(
              (x) => x.id === n.id && JSON.stringify(x) === JSON.stringify(n),
            ),
        )
      )
        throw new Error(
          "I commenti esistenti non possono essere modificati o eliminati.",
        );
      return {
        ...student,
        revision: old?.revision ?? 0,
        history: old?.history ?? [],
        notes: [
          ...(old?.notes ?? []),
          ...notes
            .filter((n) => !(old?.notes ?? []).some((x) => x.id === n.id))
            .map((n) => {
              const text = n.text.trim();
              if (!text || text.length > 5000)
                throw new Error(
                  "Inserisci un commento tra 1 e 5000 caratteri.",
                );
              return {
                id: crypto.randomUUID(),
                text,
                createdAt: now,
                ...(actor ? { actorId: actor.id, actorName: actor.name } : {}),
              };
            }),
        ],
      };
    }),
  });
  assertCrmTransition(current, edited);
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
      const changes = studentChanges(current, edited, student);
      if (!changes.length) return student;
      return {
        ...student,
        revision: (old?.revision ?? 0) + 1,
        history: [
          ...(old?.history ?? []),
          ...changes.map((event) => ({
            id: crypto.randomUUID(),
            ...(actor ? { actorId: actor.id, actorName: actor.name } : {}),
            ...event,
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
