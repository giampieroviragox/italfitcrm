import { eventEnd, type TeamEvent } from "./agenda.ts";
import { normalize, type CrmState } from "./model.ts";
import { coachedStudentIds } from "./permissions.ts";
import { coachName } from "./student-coach.ts";

/**
 * Decides what each team member's Google calendar should contain and how to
 * get there from what was written last time. Pure: the server does the calls.
 */
export interface CalendarItem {
  ref: string;
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string } | { date: string };
  end: { dateTime: string } | { date: string };
}
export interface CalendarLink {
  ref: string;
  googleEventId: string;
  hash: string;
}
export const calendarTimeZone = "Europe/Rome";

const nextDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Everything that belongs in a member's calendar, past and future. */
export function desiredItems(
  state: CrmState,
  events: TeamEvent[],
  adminId: string,
  appUrl: string,
): CalendarItem[] {
  const member = state.admins.find((a) => a.id === adminId);
  if (!member) return [];
  const name = normalize(coachName(member.name));
  const studentName = (id: string) => {
    const s = state.students.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}`.trim() : "";
  };
  const items: CalendarItem[] = [];
  for (const lesson of state.lessons ?? []) {
    if (lesson.cancelled) continue;
    const mine =
      lesson.availability?.adminId === adminId ||
      (!lesson.availability && normalize(coachName(lesson.coach)) === name);
    if (!mine) continue;
    const attendees = (state.bookings ?? [])
      .filter((b) => b.lessonId === lesson.id && !b.cancelled)
      .map((b) => studentName(b.studentId))
      .filter(Boolean);
    items.push({
      ref: `lesson:${lesson.id}`,
      summary: `Lezione · ${lesson.title}`,
      description: [
        attendees.length
          ? `Iscritti (${attendees.length}/${lesson.capacity}): ${attendees.join(", ")}`
          : `Nessun iscritto · ${lesson.capacity} posti`,
        `Gestisci nel CRM: ${appUrl}/admin/lezioni/${encodeURIComponent(lesson.id)}`,
      ].join("\n"),
      ...(lesson.location ? { location: lesson.location } : {}),
      start: { dateTime: lesson.startsAt },
      end: {
        dateTime: new Date(
          Date.parse(lesson.startsAt) + lesson.durationMinutes * 60_000,
        ).toISOString(),
      },
    });
  }
  for (const event of events) {
    if (event.cancelled || !event.participants.includes(adminId)) continue;
    const others = event.participants
      .filter((p) => p !== adminId)
      .map((p) => state.admins.find((a) => a.id === p)?.name)
      .filter(Boolean);
    items.push({
      ref: `event:${event.id}`,
      summary: event.title,
      description: [
        ...(others.length ? [`Con: ${others.join(", ")}`] : []),
        ...(event.studentId
          ? [`Studente: ${studentName(event.studentId)}`]
          : []),
        ...(event.notes ? [event.notes] : []),
        `Agenda del CRM: ${appUrl}/admin/agenda`,
      ].join("\n"),
      ...(event.location ? { location: event.location } : {}),
      start: { dateTime: event.startsAt },
      end: { dateTime: eventEnd(event) },
    });
  }
  const followed =
    member.role === "owner" ? undefined : coachedStudentIds(state, adminId);
  for (const student of state.students) {
    if (student.archived || (followed && !followed.has(student.id))) continue;
    for (const race of student.races ?? [])
      items.push({
        ref: `race:${student.id}:${race.id}`,
        summary:
          `Gara · ${race.name} · ${student.firstName} ${student.lastName}`.trim(),
        description: [
          ...(race.notes ? [race.notes] : []),
          "Ricordati di fare l’in bocca al lupo.",
          `Scheda: ${appUrl}/admin/studenti/${encodeURIComponent(student.id)}?tab=training`,
        ].join("\n"),
        ...(race.location ? { location: race.location } : {}),
        start: { date: race.date },
        end: { date: nextDay(race.date) },
      });
  }
  return items;
}

/** Stable content fingerprint: unchanged items are not rewritten. */
export function itemHash(item: CalendarItem) {
  const text = JSON.stringify([
    item.summary,
    item.description,
    item.location ?? "",
    item.start,
    item.end,
  ]);
  let h1 = 0x811c9dc5,
    h2 = 0;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 + text.charCodeAt(i), 31) | 0;
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

export const itemStart = (item: CalendarItem) =>
  "dateTime" in item.start
    ? item.start.dateTime
    : `${item.start.date}T00:00:00Z`;

export interface SyncPlan {
  write: { item: CalendarItem; hash: string; googleEventId?: string }[];
  remove: CalendarLink[];
}
/**
 * New or changed items inside the window are written; links whose item no
 * longer exists (anywhere in time) are removed. Old items are left alone.
 */
export function planSync(
  desired: CalendarItem[],
  links: CalendarLink[],
  window: { from: string; to: string },
): SyncPlan {
  const byRef = new Map(links.map((l) => [l.ref, l]));
  const wanted = new Set(desired.map((d) => d.ref));
  const write = desired.flatMap((item) => {
    const start = itemStart(item);
    if (start < window.from || start > window.to) return [];
    const hash = itemHash(item);
    const link = byRef.get(item.ref);
    if (link?.hash === hash) return [];
    return [
      { item, hash, ...(link ? { googleEventId: link.googleEventId } : {}) },
    ];
  });
  return { write, remove: links.filter((l) => !wanted.has(l.ref)) };
}

/** Google event IDs allow 0-9 and a-v: a hex digest is always valid. */
export async function googleEventId(adminId: string, ref: string) {
  const data = new TextEncoder().encode(`italfit:${adminId}:${ref}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}
