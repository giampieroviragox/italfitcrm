import { normalize, validDate, type CrmState } from "./model.ts";
import type { WorkoutPlan, Lesson } from "./fitness-model.ts";
export const todayRome = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(),
  );
export function romeLocal(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(" ", "T");
}
export function romeToIso(local: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ||
    !validDate(local.slice(0, 10))
  )
    throw new Error("Data e ora non valide.");
  const wall = Date.parse(local + "Z");
  const candidates = [60, 120]
    .map((offset) => new Date(wall - offset * 60000).toISOString())
    .filter((iso) => romeLocal(iso) === local);
  if (candidates.length !== 1)
    throw new Error(
      "L’orario coincide con un cambio dell’ora. Scegli un altro orario.",
    );
  return candidates[0]!;
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekStart(date: string) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
export function overlaps(a: Lesson, b: Lesson) {
  return (
    Date.parse(a.startsAt) <
      Date.parse(b.startsAt) + b.durationMinutes * 60000 &&
    Date.parse(b.startsAt) < Date.parse(a.startsAt) + a.durationMinutes * 60000
  );
}
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const string = (v: unknown) => typeof v === "string";
const list = (v: unknown) => Array.isArray(v);
function sessionsValid(value: unknown): boolean {
  return (
    list(value) &&
    value.every(
      (s) =>
        obj(s) &&
        string(s.id) &&
        string(s.name) &&
        list(s.exercises) &&
        s.exercises.every(
          (e: unknown) =>
            obj(e) &&
            ["id", "name", "reps", "notes"].every((k) => string(e[k])) &&
            typeof e.sets === "number" &&
            typeof e.restSeconds === "number" &&
            (e.videoUrl === undefined || string(e.videoUrl)),
        ),
    )
  );
}
export function isFitnessData(v: Record<string, unknown>): boolean {
  return (
    (v.plans === undefined ||
      (list(v.plans) &&
        v.plans.every(
          (p) =>
            obj(p) &&
            ["id", "title", "description"].every((k) => string(p[k])) &&
            ["draft", "published", "archived"].includes(String(p.status)) &&
            sessionsValid(p.sessions),
        ))) &&
    (v.assignments === undefined ||
      (list(v.assignments) &&
        v.assignments.every(
          (a) =>
            obj(a) &&
            ["id", "studentId", "planId", "month", "createdAt"].every((k) =>
              string(a[k]),
            ) &&
            obj(a.snapshot) &&
            string(a.snapshot.title) &&
            string(a.snapshot.description) &&
            sessionsValid(a.snapshot.sessions),
        ))) &&
    (v.lessons === undefined ||
      (list(v.lessons) &&
        v.lessons.every(
          (l) =>
            obj(l) &&
            ["id", "title", "startsAt", "coach", "location"].every((k) =>
              string(l[k]),
            ) &&
            typeof l.durationMinutes === "number" &&
            typeof l.capacity === "number" &&
            typeof l.cancelled === "boolean",
        ))) &&
    (v.bookings === undefined ||
      (list(v.bookings) &&
        v.bookings.every(
          (b) =>
            obj(b) &&
            ["id", "studentId", "lessonId", "createdAt"].every((k) =>
              string(b[k]),
            ) &&
            typeof b.cancelled === "boolean",
        )))
  );
}
function validateSessions(plan: Pick<WorkoutPlan, "sessions" | "status">) {
  if (plan.sessions.length > 7)
    throw new Error("Un piano può avere al massimo 7 sessioni.");
  if (
    plan.status === "published" &&
    (!plan.sessions.length ||
      plan.sessions.some((s) => !s.name.trim() || !s.exercises.length))
  )
    throw new Error(
      "Per pubblicare aggiungi almeno una sessione con esercizi.",
    );
  const ids = new Set<string>();
  for (const s of plan.sessions) {
    if (!s.id || ids.has(s.id)) throw new Error("Sessioni duplicate.");
    ids.add(s.id);
    if (s.exercises.length > 30)
      throw new Error("Massimo 30 esercizi per sessione.");
    const ex = new Set<string>();
    for (const e of s.exercises) {
      if (!e.id || ex.has(e.id)) throw new Error("Esercizi duplicati.");
      ex.add(e.id);
      if (plan.status === "published" && !e.name.trim())
        throw new Error("Inserisci il nome di ogni esercizio.");
      if (
        !Number.isInteger(e.sets) ||
        e.sets < 1 ||
        e.sets > 20 ||
        !Number.isInteger(e.restSeconds) ||
        e.restSeconds < 0 ||
        e.restSeconds > 900
      )
        throw new Error("Serie da 1 a 20; recupero da 0 a 900 secondi.");
      if (plan.status === "published" && !e.reps.trim())
        throw new Error("Indica ripetizioni o durata per ogni esercizio.");
      if (e.videoUrl) {
        try {
          if (!["https:", "http:"].includes(new URL(e.videoUrl).protocol))
            throw new Error();
        } catch {
          throw new Error("Inserisci un link video http o https valido.");
        }
      }
    }
  }
}
export function reconcileFitness(s: CrmState): CrmState {
  return {
    ...s,
    bookings: (s.bookings ?? []).map((b) =>
      !b.cancelled &&
      s.students.some(
        (student) => student.id === b.studentId && student.archived,
      )
        ? { ...b, cancelled: true }
        : b,
    ),
  };
}
export function assertFitnessTransition(
  previous: CrmState,
  next: CrmState,
  now = Date.now(),
) {
  const plans = next.plans ?? [],
    assignments = next.assignments ?? [],
    lessons = next.lessons ?? [],
    bookings = next.bookings ?? [];
  for (const items of [plans, assignments, lessons, bookings])
    if (
      items.some((x) => !x.id) ||
      new Set(items.map((x) => x.id)).size !== items.length
    )
      throw new Error("Identificativi duplicati o mancanti.");
  for (const plan of plans) {
    if (!plan.title.trim()) throw new Error("Inserisci il nome del piano.");
    validateSessions(plan);
  }
  if (
    new Set(assignments.map((a) => `${a.studentId}:${a.month}`)).size !==
    assignments.length
  )
    throw new Error("Ogni studente può avere un solo piano per mese.");
  for (const a of assignments) {
    const plan = plans.find((p) => p.id === a.planId),
      student = next.students.find((s) => s.id === a.studentId),
      old = previous.assignments?.find((x) => x.id === a.id);
    if (
      !plan ||
      !student ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(a.month) ||
      !Number.isFinite(Date.parse(a.createdAt)) ||
      !a.snapshot.title.trim()
    )
      throw new Error("Assegnazione piano non valida.");
    if (
      JSON.stringify(old) !== JSON.stringify(a) &&
      (student.archived || plan.status !== "published")
    )
      throw new Error(
        "Assegna solo piani pubblicati a studenti non archiviati.",
      );
    validateSessions({ sessions: a.snapshot.sessions, status: "published" });
  }
  for (const l of lessons) {
    if (
      !l.title.trim() ||
      !l.coach.trim() ||
      !l.location.trim() ||
      !Number.isFinite(Date.parse(l.startsAt)) ||
      !Number.isInteger(l.durationMinutes) ||
      l.durationMinutes < 15 ||
      l.durationMinutes > 240 ||
      !Number.isInteger(l.capacity) ||
      l.capacity < 1 ||
      l.capacity > 200
    )
      throw new Error(
        "Compila titolo, coach, sala, durata (15–240 minuti) e posti (1–200).",
      );
    const old = previous.lessons?.find((x) => x.id === l.id);
    if (
      (!old ||
        old.startsAt !== l.startsAt ||
        (old.cancelled && !l.cancelled)) &&
      Date.parse(l.startsAt) <= now
    )
      throw new Error("Scegli una data e un orario futuri.");
    if (
      !l.cancelled &&
      lessons.some(
        (x) =>
          x.id !== l.id &&
          !x.cancelled &&
          overlaps(x, l) &&
          (normalize(x.coach) === normalize(l.coach) ||
            normalize(x.location) === normalize(l.location)),
      )
    )
      throw new Error("Coach o sala sono già occupati in questo orario.");
    if (
      bookings.filter((b) => b.lessonId === l.id && !b.cancelled).length >
      l.capacity
    )
      throw new Error("La capienza non può essere inferiore agli iscritti.");
  }
  if (
    new Set(bookings.map((b) => `${b.lessonId}:${b.studentId}`)).size !==
    bookings.length
  )
    throw new Error("Lo studente è già presente tra gli iscritti.");
  for (const b of bookings) {
    const l = lessons.find((x) => x.id === b.lessonId),
      s = next.students.find((x) => x.id === b.studentId),
      old = previous.bookings?.find((x) => x.id === b.id);
    if (!l || !s || !Number.isFinite(Date.parse(b.createdAt)))
      throw new Error("Iscrizione non valida.");
    if (
      !b.cancelled &&
      (!old ||
        old.cancelled ||
        old.lessonId !== b.lessonId ||
        old.studentId !== b.studentId)
    ) {
      if (
        l.cancelled ||
        Date.parse(l.startsAt) <= now ||
        s.archived ||
        s.status !== "active"
      )
        throw new Error(
          "Puoi iscrivere solo studenti attivi a lezioni future disponibili.",
        );
    }
    if (!b.cancelled && s.archived)
      throw new Error(
        "Uno studente archiviato non può mantenere iscrizioni attive.",
      );
  }
  const active = bookings.filter(
    (b) =>
      !b.cancelled && lessons.some((l) => l.id === b.lessonId && !l.cancelled),
  );
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!,
        b = active[j]!;
      if (
        a.studentId === b.studentId &&
        overlaps(
          lessons.find((l) => l.id === a.lessonId)!,
          lessons.find((l) => l.id === b.lessonId)!,
        )
      )
        throw new Error(
          "Lo studente ha già un’altra lezione in questo orario.",
        );
    }
}
