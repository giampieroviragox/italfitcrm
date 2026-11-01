import {
  displayValue,
  formatPropertyValue,
  type CrmState,
  type CrmStudent,
  type PropertyValue,
} from "./model.ts";
import type { Lesson, PlanAssignment } from "./fitness-model.ts";
import { statusLabels } from "../students/config.ts";

type Change = { text: string; details?: string[] };
const different = (a: unknown, b: unknown) =>
  JSON.stringify(a) !== JSON.stringify(b);
const change = (
  label: string,
  before: PropertyValue | undefined,
  after: PropertyValue | undefined,
) => `${label}: ${displayValue(before)} → ${displayValue(after)}`;
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
const lessonLabel = (lesson: Lesson) =>
  `“${lesson.title}” · ${dateTime(lesson.startsAt)}`;
const assignmentDetails = (a: PlanAssignment) => [
  `Piano: “${a.snapshot.title}” · mese ${a.month}`,
  ...(a.snapshot.description ? [a.snapshot.description] : []),
  ...a.snapshot.sessions.flatMap((s) => [
    s.name,
    ...s.exercises.map(
      (e) =>
        `${e.name}: ${e.sets} serie × ${e.reps}, recupero ${e.restSeconds}s${e.notes ? ` · ${e.notes}` : ""}${e.videoUrl ? ` · ${e.videoUrl}` : ""}`,
    ),
  ]),
];

/** Events are derived from the saved state, including changes made outside the profile. */
export function studentChanges(
  current: CrmState,
  next: CrmState,
  student: CrmStudent,
): Change[] {
  const old = current.students.find((s) => s.id === student.id);
  const changes: Change[] = [];
  if (!old) changes.push({ text: "Scheda creata" });
  else {
    if (Boolean(old.archived) !== Boolean(student.archived))
      changes.push({
        text: student.archived
          ? "Studente archiviato"
          : "Studente ripristinato",
      });
    if (Boolean(old.accessDisabled) !== Boolean(student.accessDisabled))
      changes.push({
        text: student.accessDisabled
          ? "Accesso alla piattaforma disattivato"
          : "Accesso alla piattaforma riattivato",
      });
    const fields = {
      firstName: "Nome",
      lastName: "Cognome",
      email: "Email",
      phone: "Telefono",
      coach: "Coach",
      joinedAt: "Aggiunto il",
    } as const;
    const details = Object.entries(fields).flatMap(([key, label]) => {
      const k = key as keyof typeof fields;
      return different(old[k], student[k])
        ? [change(label, old[k], student[k])]
        : [];
    });
    if (details.length)
      changes.push({ text: "Anagrafica aggiornata", details });
    if (old.status !== student.status)
      changes.push({
        text: "Stato aggiornato",
        details: [
          change(
            "Stato",
            statusLabels[old.status],
            statusLabels[student.status],
          ),
        ],
      });
    if (old.tierId !== student.tierId)
      changes.push({
        text: "Tier aggiornato",
        details: [
          change(
            "Tier",
            current.tiers.find((t) => t.id === old.tierId)?.name,
            next.tiers.find((t) => t.id === student.tierId)?.name,
          ),
        ],
      });
    const oldTier = current.tiers.find((t) => t.id === old.tierId);
    const tier = next.tiers.find((t) => t.id === student.tierId);
    if (
      old.tierId === student.tierId &&
      oldTier &&
      tier &&
      different(oldTier, tier)
    )
      changes.push({
        text: "Configurazione del tier aggiornata",
        details: [
          ...(oldTier.name !== tier.name
            ? [change("Nome", oldTier.name, tier.name)]
            : []),
          ...(oldTier.description !== tier.description
            ? [change("Descrizione", oldTier.description, tier.description)]
            : []),
          ...(different(oldTier.entitlements, tier.entitlements)
            ? [
                change(
                  "Accesso ai piani",
                  oldTier.entitlements?.plans,
                  tier.entitlements?.plans,
                ),
                change(
                  "Accesso alle lezioni",
                  oldTier.entitlements?.lessons,
                  tier.entitlements?.lessons,
                ),
                change(
                  "Limite lezioni al mese",
                  oldTier.entitlements?.monthlyBookingLimit ?? "Nessun limite",
                  tier.entitlements?.monthlyBookingLimit ?? "Nessun limite",
                ),
              ]
            : []),
          ...(oldTier.archived !== tier.archived
            ? [tier.archived ? "Tier archiviato" : "Tier ripristinato"]
            : []),
        ],
      });
    const propertyIds = new Set([
      ...Object.keys(old.properties),
      ...Object.keys(student.properties),
    ]);
    const properties = [...propertyIds].flatMap((id) => {
      const before = current.properties.find((p) => p.id === id);
      const after = next.properties.find((p) => p.id === id);
      if (!different(old.properties[id], student.properties[id])) return [];
      return [
        change(
          after?.name ?? before?.name ?? id,
          before
            ? formatPropertyValue(before, old.properties[id])
            : displayValue(old.properties[id]),
          after
            ? formatPropertyValue(after, student.properties[id])
            : displayValue(student.properties[id]),
        ),
      ];
    });
    if (properties.length)
      changes.push({ text: "Proprietà CRM aggiornate", details: properties });
    for (const p of next.properties) {
      const before = current.properties.find((x) => x.id === p.id);
      if (!before || !different(before, p) || !(p.id in student.properties))
        continue;
      changes.push({
        text: `Proprietà “${before.name}” aggiornata`,
        details: [
          ...(before.name !== p.name
            ? [change("Nome", before.name, p.name)]
            : []),
          ...(before.group !== p.group
            ? [change("Gruppo", before.group, p.group)]
            : []),
          ...(before.description !== p.description
            ? [change("Descrizione", before.description, p.description)]
            : []),
          ...(before.required !== p.required
            ? [change("Obbligatoria", before.required, p.required)]
            : []),
          ...(different(before.options, p.options)
            ? [change("Opzioni", before.options, p.options)]
            : []),
          ...(before.archived !== p.archived
            ? [p.archived ? "Proprietà archiviata" : "Proprietà ripristinata"]
            : []),
        ],
      });
    }
  }
  for (const note of student.notes ?? []) {
    if (!(old?.notes ?? []).some((n) => n.id === note.id))
      changes.push({ text: "Commento aggiunto", details: [note.text] });
  }
  for (const a of current.assignments ?? []) {
    if (
      a.studentId === student.id &&
      !(next.assignments ?? []).some(
        (x) => x.id === a.id && x.studentId === student.id,
      )
    )
      changes.push({
        text: "Assegnazione piano rimossa dalla scheda",
        details: assignmentDetails(a),
      });
  }
  for (const b of current.bookings ?? []) {
    if (
      b.studentId !== student.id ||
      (next.bookings ?? []).some(
        (x) =>
          x.id === b.id &&
          x.studentId === student.id &&
          x.lessonId === b.lessonId,
      )
    )
      continue;
    const lesson = current.lessons?.find((l) => l.id === b.lessonId);
    changes.push({
      text: "Prenotazione rimossa dalla scheda",
      details: lesson ? [lessonLabel(lesson)] : [],
    });
  }
  for (const a of next.assignments ?? []) {
    if (a.studentId !== student.id) continue;
    const before = current.assignments?.find((x) => x.id === a.id);
    if (!different(before, a)) continue;
    changes.push({
      text: before ? "Piano mensile aggiornato" : "Piano mensile assegnato",
      details: [
        ...(before ? ["Prima", ...assignmentDetails(before), "Dopo"] : []),
        ...assignmentDetails(a),
      ],
    });
  }
  for (const booking of next.bookings ?? []) {
    if (booking.studentId !== student.id) continue;
    const before = current.bookings?.find((b) => b.id === booking.id);
    const lesson = next.lessons?.find((l) => l.id === booking.lessonId);
    if (!lesson) continue;
    if (different(before, booking))
      changes.push({
        text: booking.cancelled
          ? "Prenotazione annullata"
          : before?.cancelled
            ? "Prenotazione ripristinata"
            : "Lezione prenotata",
        details: [
          lessonLabel(lesson),
          `Coach: ${lesson.coach} · Sede: ${lesson.location}`,
        ],
      });
    const previousLesson = current.lessons?.find(
      (l) => l.id === booking.lessonId,
    );
    if (previousLesson && different(previousLesson, lesson))
      changes.push({
        text:
          !previousLesson.cancelled && lesson.cancelled
            ? "Lezione annullata"
            : previousLesson.cancelled && !lesson.cancelled
              ? "Lezione ripristinata"
              : "Lezione aggiornata",
        details: [
          lessonLabel(previousLesson),
          ...(
            [
              ["Titolo", previousLesson.title, lesson.title],
              [
                "Data e ora",
                dateTime(previousLesson.startsAt),
                dateTime(lesson.startsAt),
              ],
              [
                "Durata (minuti)",
                previousLesson.durationMinutes,
                lesson.durationMinutes,
              ],
              ["Posti", previousLesson.capacity, lesson.capacity],
              ["Coach", previousLesson.coach, lesson.coach],
              ["Sede", previousLesson.location, lesson.location],
            ] as const
          ).flatMap(([label, a, b]) =>
            different(a, b) ? [change(label, a, b)] : [],
          ),
        ],
      });
  }
  return changes;
}
