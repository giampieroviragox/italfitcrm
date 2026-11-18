"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Flag,
  MapPin,
  Receipt,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import { studentAccessEnabled, studentAccessLabel } from "./student-access";
import { studentAccess } from "./tier-access";
import { useCan, useCrm, useRecentActivity, useViewer } from "./store";
import { validPropertyValue } from "./model";
import { romeLocal, todayRome } from "./fitness-logic";
import { LocalNotice } from "./ui";
import { formatDate, formatMonth } from "@/lib/format";
import { daysUntil, racesSoon } from "./cycle-feedback";
import { pendingOnlineReceipts, pendingReceipts } from "./payments-workspace";

const fullDate = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "full",
  timeZone: "Europe/Rome",
});
const shortDate = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Rome",
});
const activityDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Rome",
});
const rowClass =
  "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle focus-visible:outline-offset-[-3px] sm:px-5";

export default function OverviewPage() {
  const state = useCrm();
  const viewer = useViewer();
  const can = useCan();
  const now = new Date();
  const today = todayRome();
  const month = today.slice(0, 7);
  const students = state.students.filter((s) => !s.archived);
  const required = state.properties.filter((p) => !p.archived && p.required);
  const incomplete = students.filter((s) =>
    required.some((p) => !validPropertyValue(p, s.properties[p.id])),
  );
  const assigned = new Set(
    state.assignments?.filter((a) => a.month === month).map((a) => a.studentId),
  );
  const races = racesSoon(state, today, 14);
  const unassigned = students.filter(
    (s) => studentAccess(state, s).plans && !assigned.has(s.id),
  );
  const lessons = (state.lessons ?? [])
    .filter(
      (lesson) =>
        !lesson.cancelled && Date.parse(lesson.startsAt) > now.getTime(),
    )
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);
  const recent = students
    .toSorted((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .slice(0, 5);
  const remoteEvents = useRecentActivity();
  const events = (
    remoteEvents
      ? remoteEvents.flatMap((row) => {
          const student = state.students.find((s) => s.id === row.student);
          return student ? [{ ...row.event, student }] : [];
        })
      : students.flatMap((s) =>
          (s.history ?? []).map((h) => ({ ...h, student: s })),
        )
  )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const firstName = state.admins
    .find((a) => (viewer ? a.id === viewer.recordId : a.role === "owner"))
    ?.name.trim()
    .split(/\s+/)[0];

  return (
    <>
      <PageHeading
        title={firstName ? `Ciao, ${firstName}` : "Home"}
        description={
          <span className="first-letter:uppercase">{fullDate.format(now)}</span>
        }
        action={
          can("students.edit") ? (
            <Button asChild size="lg" className="rounded-full">
              <Link href="/admin/studenti/nuovo">
                <UserPlus /> Aggiungi studente
              </Link>
            </Button>
          ) : undefined
        }
      />
      <LocalNotice />
      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4 lg:gap-5">
          <section
            className="min-w-0 overflow-hidden rounded-2xl border bg-card"
            aria-labelledby="agenda-heading"
          >
            <PanelHeading
              id="agenda-heading"
              title="In agenda"
              href="/admin/lezioni"
              link="Calendario"
              icon={<CalendarDays className="size-4" />}
            />
            {lessons.length ? (
              <ul className="divide-y">
                {lessons.map((lesson, index) => {
                  const time = romeLocal(lesson.startsAt);
                  const occupied =
                    state.bookings?.filter(
                      (b) => b.lessonId === lesson.id && !b.cancelled,
                    ).length ?? 0;
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/admin/lezioni/${encodeURIComponent(lesson.id)}`}
                        className={`${rowClass} min-h-18 ${index === 0 ? "bg-subtle hover:bg-muted" : ""}`}
                      >
                        <time
                          dateTime={lesson.startsAt}
                          className="w-[3.65rem] shrink-0 border-r pr-2 tabular-nums sm:w-[5rem]"
                        >
                          <span className="block text-lg leading-tight font-semibold tracking-tight">
                            {time.slice(11)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {time.startsWith(today)
                              ? "Oggi"
                              : shortDate.format(new Date(lesson.startsAt))}
                          </span>
                        </time>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {lesson.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            {lesson.location && (
                              <MapPin className="size-3 shrink-0" aria-hidden />
                            )}
                            <span className="truncate">
                              {[lesson.location, lesson.coach]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border bg-card px-2 py-1 text-xs whitespace-nowrap tabular-nums">
                          {occupied}/{lesson.capacity}
                          <span className="sr-only sm:not-sr-only">
                            {" iscritti"}
                          </span>
                        </span>
                        <ChevronRight
                          className="hidden size-4 shrink-0 text-muted-foreground sm:block"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-8 text-sm text-muted-foreground">
                Nessuna lezione in programma.
              </p>
            )}
          </section>

          <section
            className="min-w-0 overflow-hidden rounded-2xl border bg-card"
            aria-labelledby="recent-heading"
          >
            <PanelHeading
              id="recent-heading"
              title="Studenti recenti"
              href="/admin/studenti"
              link="Tutti gli studenti"
            />
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-b bg-subtle px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
              <span>
                <strong className="font-semibold text-foreground">
                  {students.length}
                </strong>{" "}
                in elenco
              </span>
              <span>
                <strong className="font-semibold text-foreground">
                  {students.filter(studentAccessEnabled).length}
                </strong>{" "}
                con accesso abilitato
              </span>
            </div>
            {recent.length ? (
              <ul className="divide-y">
                {recent.map((student) => (
                  <li key={student.id}>
                    <Link
                      href={`/admin/studenti/${encodeURIComponent(student.id)}`}
                      className={`${rowClass} justify-between`}
                    >
                      <StudentIdentity student={student} />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {studentAccessLabel(student)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Nessuno studente in elenco.
              </p>
            )}
          </section>
        </div>
        <div className="grid min-w-0 gap-4 lg:gap-5">
          {races.length > 0 && (
            <section
              className="min-w-0 overflow-hidden rounded-2xl border bg-card"
              aria-labelledby="races-heading"
            >
              <PanelHeading
                id="races-heading"
                title="Gare in arrivo"
                icon={<Flag className="size-4" />}
              />
              <p className="border-b bg-subtle px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                Prossimi 14 giorni: un messaggio di in bocca al lupo fa sempre
                piacere.
              </p>
              <ul className="divide-y">
                {races.map(({ student, race }) => {
                  const days = daysUntil(today, race.date);
                  return (
                    <li key={`${student.id}:${race.id}`}>
                      <Link
                        href={`/admin/studenti/${encodeURIComponent(student.id)}?tab=training`}
                        className={`${rowClass} justify-between`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {student.firstName} {student.lastName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {race.name}
                            {race.location ? ` · ${race.location}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs">
                          <span
                            className={`block font-semibold ${days <= 2 ? "text-[var(--workspace-accent)]" : ""}`}
                          >
                            {days === 0
                              ? "Oggi"
                              : days === 1
                                ? "Domani"
                                : `Tra ${days} giorni`}
                          </span>
                          <span className="block text-muted-foreground">
                            {formatDate(race.date)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section
            className="min-w-0 overflow-hidden rounded-2xl border bg-card"
            aria-labelledby="followup-heading"
          >
            <PanelHeading
              id="followup-heading"
              title="Da seguire"
              icon={<ClipboardList className="size-4" />}
            />
            <ul className="divide-y">
              {[
                {
                  title: "Schede da completare",
                  items: incomplete,
                  hint: incomplete.length
                    ? "Proprietà obbligatorie mancanti"
                    : "Tutte le schede sono complete",
                  icon: ClipboardList,
                  href: "/admin/studenti",
                },
                {
                  title: "Studenti senza piano",
                  items: unassigned,
                  hint: formatMonth(month),
                  icon: Dumbbell,
                  href: "/admin/piani",
                },
                {
                  title: "Pagamenti da verificare",
                  items: [
                    ...(can("payments") ? pendingReceipts(state.students) : []),
                    ...(can("coaching") || can("accounting.online")
                      ? pendingOnlineReceipts(state.students)
                      : []),
                  ],
                  hint: "Ricevute caricate dagli studenti",
                  icon: Receipt,
                  href: can("payments")
                    ? "/admin/pagamenti"
                    : "/admin/contabilita",
                },
              ].map(({ title, items, hint, icon: Icon, href }) => (
                <li key={title}>
                  <Link className={rowClass} href={href}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {title}
                      </span>
                      <span className="block text-xs text-muted-foreground first-letter:uppercase">
                        {hint}
                      </span>
                    </span>
                    <span
                      className={`text-lg font-semibold tabular-nums ${items.length ? "text-[var(--workspace-accent)]" : "text-muted-foreground"}`}
                    >
                      {items.length}
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="min-w-0 overflow-hidden rounded-2xl border bg-card"
            aria-labelledby="activity-heading"
          >
            <PanelHeading id="activity-heading" title="Attività recenti" />
            {events.length ? (
              <ul className="divide-y">
                {events.map((event) => (
                  <li key={`${event.student.id}:${event.id}`}>
                    <Link
                      href={`/admin/studenti/${encodeURIComponent(event.student.id)}`}
                      className={`${rowClass} justify-between`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {event.text}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {event.student.firstName} {event.student.lastName}
                        </span>
                      </span>
                      <time
                        dateTime={event.createdAt}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {activityDate.format(new Date(event.createdAt))}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Le modifiche alle schede compariranno qui.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
function PanelHeading({
  id,
  title,
  icon,
  href,
  link,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  href?: string;
  link?: string;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 border-b px-4 py-3 sm:px-5">
      <h2
        id={id}
        className="flex items-center gap-2 text-lg font-semibold tracking-tight"
      >
        {icon && (
          <span className="text-muted-foreground" aria-hidden>
            {icon}
          </span>
        )}
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {link}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
