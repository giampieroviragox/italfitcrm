import { z } from "zod";
import type { CrmState } from "./model.ts";

/** Team agenda: calls and appointments between team members. */
const identifier = z.string().min(1).max(200);
const timestamp = z.iso.datetime({ offset: true });
export const eventInput = z.object({
  title: z.string().trim().min(1, "Inserisci un titolo.").max(120),
  startsAt: timestamp,
  durationMinutes: z.number().int().min(15).max(600),
  /** Team members taking part (admin record IDs). */
  participants: z.array(identifier).min(1).max(30),
  studentId: identifier.optional(),
  /** Room, address or video call link. */
  location: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(3000).optional(),
});
export type TeamEventInput = z.infer<typeof eventInput>;
export const teamEvent = eventInput.extend({
  id: identifier,
  createdBy: identifier,
  createdAt: timestamp,
  updatedAt: timestamp,
  cancelled: z.boolean().optional(),
});
export type TeamEvent = z.infer<typeof teamEvent>;
export const agendaCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), event: eventInput }),
  z.object({
    action: z.literal("update"),
    id: identifier,
    event: eventInput,
  }),
  z.object({ action: z.literal("cancel"), id: identifier }),
]);
export type AgendaCommand = z.infer<typeof agendaCommand>;

export const eventEnd = (e: Pick<TeamEvent, "startsAt" | "durationMinutes">) =>
  new Date(Date.parse(e.startsAt) + e.durationMinutes * 60_000).toISOString();

/** Validates participants and student against the CRM. */
export function checkEvent(state: CrmState, input: TeamEventInput) {
  const ids = new Set(state.admins.map((a) => a.id));
  if (new Set(input.participants).size !== input.participants.length)
    throw new Error("Ogni partecipante va indicato una sola volta.");
  if (input.participants.some((p) => !ids.has(p)))
    throw new Error("Uno dei partecipanti non fa parte del team.");
  if (
    input.studentId &&
    !state.students.some((s) => s.id === input.studentId && !s.archived)
  )
    throw new Error("Lo studente selezionato non è disponibile.");
}

/**
 * Applies a command. Anyone with the agenda permission creates events; only the
 * creator or the super admin changes or cancels them.
 */
export function applyAgendaCommand(
  state: CrmState,
  events: TeamEvent[],
  command: AgendaCommand,
  actor: { id: string; owner: boolean },
  now = new Date(),
): TeamEvent {
  if (command.action === "create") {
    checkEvent(state, command.event);
    return {
      ...clean(command.event),
      id: crypto.randomUUID(),
      createdBy: actor.id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }
  const existing = events.find((e) => e.id === command.id);
  if (!existing) throw new Error("L’appuntamento non esiste più.");
  if (existing.createdBy !== actor.id && !actor.owner)
    throw new Error("Solo chi ha creato l’appuntamento può modificarlo.");
  if (command.action === "cancel")
    return { ...existing, cancelled: true, updatedAt: now.toISOString() };
  checkEvent(state, command.event);
  return {
    ...clean(command.event),
    id: existing.id,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: now.toISOString(),
  };
}
const clean = (e: TeamEventInput): TeamEventInput => ({
  title: e.title.trim(),
  startsAt: e.startsAt,
  durationMinutes: e.durationMinutes,
  participants: e.participants,
  ...(e.studentId ? { studentId: e.studentId } : {}),
  ...(e.location?.trim() ? { location: e.location.trim() } : {}),
  ...(e.notes?.trim() ? { notes: e.notes.trim() } : {}),
});
