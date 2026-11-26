import type { PlanAssignment, WorkoutPlan } from "./fitness-model.ts";

/**
 * Plans run in four-week cycles (start day + 27 days). Personalized plans form
 * one track per student; each guided program category forms its own track.
 */
export const cycleDays = 28;
export const guidedCategories = [
  { id: "hyrox", label: "Hyrox" },
  { id: "old-school", label: "Old School" },
  { id: "hybrid", label: "Hybrid" },
  { id: "home-edition", label: "Home Edition" },
] as const;
export type GuidedCategory = (typeof guidedCategories)[number]["id"];
export const isGuidedCategory = (value: unknown): value is GuidedCategory =>
  guidedCategories.some((c) => c.id === value);
export const guidedLabel = (id: string | undefined) =>
  guidedCategories.find((c) => c.id === id)?.label ?? "Programma guidato";
/** A student following a guided program from a given day. */
export interface GuidedEnrollment {
  category: GuidedCategory;
  startsOn: string;
}
export type PlanTrack = GuidedCategory | "personal";

export function shiftDay(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const dayDiff = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
export const cycleEnd = (startsOn: string) => shiftDay(startsOn, cycleDays - 1);

type Dated = Pick<
  PlanAssignment,
  "month" | "startsOn" | "endsOn" | "guidedCategory"
> & { snapshot: Pick<PlanAssignment["snapshot"], "program"> };
export interface Period {
  startsOn: string;
  endsOn: string;
}

/** The days a plan covers: its cycle, else (older records) its program dates, else its month. */
export function assignmentPeriod(a: Dated): Period {
  if (a.startsOn && a.endsOn) return { startsOn: a.startsOn, endsOn: a.endsOn };
  const program = a.snapshot.program;
  if (program?.startsOn && program.endsOn)
    return { startsOn: program.startsOn, endsOn: program.endsOn };
  const [y, m] = a.month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  return { startsOn: `${a.month}-01`, endsOn: `${a.month}-${last}` };
}
export const assignmentTrack = (a: Pick<PlanAssignment, "guidedCategory">) =>
  a.guidedCategory ?? "personal";
export const periodsOverlap = (a: Period, b: Period) =>
  a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;

/** Oldest first; same start keeps creation order. */
export function byStart<T extends Dated & Pick<PlanAssignment, "createdAt">>(
  list: T[],
) {
  return list.toSorted(
    (a, b) =>
      assignmentPeriod(a).startsOn.localeCompare(
        assignmentPeriod(b).startsOn,
      ) || a.createdAt.localeCompare(b.createdAt),
  );
}

/** Plans running today; personalized first. */
export function runningAssignments<T extends Dated>(list: T[], today: string) {
  return list
    .filter((a) => {
      const p = assignmentPeriod(a);
      return p.startsOn <= today && today <= p.endsOn;
    })
    .toSorted(
      (a, b) =>
        Number(Boolean(a.guidedCategory)) - Number(Boolean(b.guidedCategory)),
    );
}

/** The plan that matters today: a running one, else the latest started, else the next. */
export function currentAssignment<T extends Dated>(
  list: T[],
  today: string,
): T | undefined {
  const running = runningAssignments(list, today)[0];
  if (running) return running;
  const sorted = list.toSorted((a, b) =>
    assignmentPeriod(a).startsOn.localeCompare(assignmentPeriod(b).startsOn),
  );
  return (
    sorted.filter((a) => assignmentPeriod(a).startsOn <= today).at(-1) ??
    sorted[0]
  );
}

/**
 * Start of a student's next cycle on a track: the day after the last one, or
 * the enrollment day. When that day is already behind, it moves forward in
 * whole cycles to the one running today, so the rhythm is kept.
 */
export function nextCycleStart(
  trackAssignments: Dated[],
  today: string,
  enrolledOn?: string,
) {
  const last = trackAssignments
    .map((a) => assignmentPeriod(a).endsOn)
    .toSorted()
    .at(-1);
  const base = last ? shiftDay(last, 1) : (enrolledOn ?? today);
  if (base >= today) return base;
  return shiftDay(
    base,
    Math.floor(dayDiff(base, today) / cycleDays) * cycleDays,
  );
}

const dayMonth = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayMonthYear = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const utcNoon = (day: string) => new Date(`${day}T12:00:00Z`);
export const formatDay = (day: string) => dayMonthYear.format(utcNoon(day));
/** «2 nov – 29 nov 2026», or with both years when they differ. */
export function formatPeriod(p: Period) {
  const sameYear = p.startsOn.slice(0, 4) === p.endsOn.slice(0, 4);
  return `${(sameYear ? dayMonth : dayMonthYear).format(utcNoon(p.startsOn))} – ${dayMonthYear.format(utcNoon(p.endsOn))}`;
}
export const periodLabel = (a: Dated) => formatPeriod(assignmentPeriod(a));

/** The latest published version of a guided program. */
export function currentGuidedVersion(
  plans: WorkoutPlan[] | undefined,
  category: GuidedCategory,
) {
  return (plans ?? [])
    .filter((p) => p.guidedCategory === category && p.status === "published")
    .toSorted((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    )[0];
}

/** Days before a cycle ends when the next one shows up as «da preparare». */
export const dueWithinDays = 7;
export type CycleDue =
  | { state: "running"; endsOn: string }
  | { state: "due"; dueOn: string; endsOn?: string }
  | { state: "planned"; startsOn: string };
/**
 * Where a track stands today: a plan running beyond the warning window, a plan
 * already prepared for the next cycle, or a next cycle to prepare (with the day
 * it should start).
 */
export function trackDue(
  trackAssignments: Dated[],
  today: string,
  enrolledOn?: string,
): CycleDue {
  const periods = trackAssignments.map(assignmentPeriod);
  const running = periods.find((p) => p.startsOn <= today && today <= p.endsOn);
  const future = periods
    .filter((p) => p.startsOn > today)
    .toSorted((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
  if (running && future && future.startsOn === shiftDay(running.endsOn, 1))
    return { state: "planned", startsOn: future.startsOn };
  if (!running && future)
    return { state: "planned", startsOn: future.startsOn };
  if (running && dayDiff(today, running.endsOn) >= dueWithinDays)
    return { state: "running", endsOn: running.endsOn };
  return {
    state: "due",
    dueOn: nextCycleStart(trackAssignments, today, enrolledOn),
    ...(running ? { endsOn: running.endsOn } : {}),
  };
}
