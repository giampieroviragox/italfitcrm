import { eventEnd, type TeamEvent } from "./agenda.ts";
import { normalize, type CrmState } from "./model.ts";
import { coachName } from "./student-coach.ts";

export interface BusySlot {
  start: string;
  end: string;
  source: "crm" | "google";
  /** Shown only for CRM items, which every team member may see. */
  label?: string;
}
const overlaps = (start: string, end: string, from: string, to: string) =>
  start < to && end > from;

/** A member's lessons and team appointments between two instants. */
export function busyFromCrm(
  state: CrmState,
  events: TeamEvent[],
  adminId: string,
  from: string,
  to: string,
): BusySlot[] {
  const member = state.admins.find((a) => a.id === adminId);
  const name = member ? normalize(coachName(member.name)) : "";
  const lessons = (state.lessons ?? []).flatMap((l) => {
    if (l.cancelled) return [];
    const mine =
      l.availability?.adminId === adminId ||
      (!l.availability && normalize(coachName(l.coach)) === name);
    const end = new Date(
      Date.parse(l.startsAt) + l.durationMinutes * 60_000,
    ).toISOString();
    return mine && overlaps(l.startsAt, end, from, to)
      ? [
          {
            start: l.startsAt,
            end,
            source: "crm" as const,
            label: `Lezione · ${l.title}`,
          },
        ]
      : [];
  });
  const appointments = events.flatMap((e) => {
    const end = eventEnd(e);
    return !e.cancelled &&
      e.participants.includes(adminId) &&
      overlaps(e.startsAt, end, from, to)
      ? [{ start: e.startsAt, end, source: "crm" as const, label: e.title }]
      : [];
  });
  return [...lessons, ...appointments];
}
