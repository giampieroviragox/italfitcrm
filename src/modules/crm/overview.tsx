"use client";
import Link from "next/link";
import { UserPlus, Dumbbell, CalendarDays } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import { studentAccessEnabled, studentAccessLabel } from "./student-access";
import { studentAccess } from "./tier-access";
import { useCrm, useViewer } from "./store";
import { validPropertyValue } from "./model";
import { todayRome } from "./fitness-logic";
import { lessonDate } from "./lessons-workspace";
import { LocalNotice } from "./ui";
import { formatMonth } from "@/lib/format";
export default function OverviewPage() {
  const state = useCrm(),
    viewer = useViewer();
  const students = state.students.filter((s) => !s.archived);
  const required = state.properties.filter((p) => !p.archived && p.required);
  const incomplete = students.filter((s) =>
    required.some((p) => !validPropertyValue(p, s.properties[p.id])),
  );
  const active = students.filter(studentAccessEnabled);
  const month = todayRome().slice(0, 7);
  const unassigned = students.filter(
    (s) =>
      studentAccess(state, s).plans &&
      !state.assignments?.some(
        (a) => a.studentId === s.id && a.month === month,
      ),
  );
  const lessons = (state.lessons ?? [])
    .filter((l) => !l.cancelled && l.startsAt > new Date().toISOString())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 4);
  const recent = [...students]
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .slice(0, 5);
  const events = state.students
    .flatMap((s) => (s.history ?? []).map((h) => ({ ...h, student: s })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const owner = state.admins.find((a) =>
    viewer ? a.id === viewer.recordId : a.role === "owner",
  );
  const firstName = owner?.name.split(/\s+/)[0];
  return (
    <>
      <PageHeading
        title={firstName ? `Ciao, ${firstName}` : "Home"}
        description={
          <span className="first-letter:uppercase">
            {new Intl.DateTimeFormat("it-IT", {
              dateStyle: "full",
              timeZone: "Europe/Rome",
            }).format(new Date())}
          </span>
        }
      />
      <LocalNotice />
      <section
        aria-label="Azioni rapide"
        className="mb-8 grid gap-2 sm:grid-cols-3"
      >
        {[
          {
            href: "/admin/studenti/nuovo",
            icon: UserPlus,
            title: "Aggiungi studente",
            text: "Anagrafica, tier e proprietà",
          },
          {
            href: "/admin/piani",
            icon: Dumbbell,
            title: "Prepara un piano",
            text: "Sessioni e assegnazioni mensili",
          },
          {
            href: "/admin/lezioni",
            icon: CalendarDays,
            title: "Organizza le lezioni",
            text: "Calendario e iscrizioni",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href} className={tile}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[.045]">
              <item.icon className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.text}
              </span>
            </span>
          </Link>
        ))}
      </section>
      <section
        aria-label="Riepilogo"
        className="mb-10 grid grid-cols-2 overflow-hidden rounded-xl border lg:grid-cols-4"
      >
        {[
          {
            label: "Studenti",
            value: students.length,
            href: "/admin/studenti",
          },
          {
            label: "Con accesso",
            value: active.length,
            href: "/admin/studenti",
          },
          {
            label: "Schede da completare",
            value: incomplete.length,
            href: "/admin/studenti",
          },
          {
            label: `Senza piano · ${formatMonth(month).split(" ")[0]}`,
            value: unassigned.length,
            href: "/admin/piani",
          },
        ].map((item, i) => (
          <Link
            key={item.label}
            href={item.href}
            className={`px-5 py-4 transition-colors hover:bg-foreground/[.02] ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
          >
            <p className="text-[13px] text-muted-foreground first-letter:uppercase">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-medium tracking-[-0.02em] tabular-nums">
              {item.value}
            </p>
          </Link>
        ))}
      </section>
      <div className="grid items-start gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-10">
          <section>
            <SectionHeader
              title="Studenti recenti"
              href="/admin/studenti"
              link="Vedi tutti"
            />
            <div className="-mx-2">
              {recent.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/studenti/${encodeURIComponent(s.id)}`}
                  className={row}
                >
                  <StudentIdentity student={s} />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {studentAccessLabel(s)}
                  </span>
                </Link>
              ))}
            </div>
            {!recent.length && <Empty>Nessuno studente presente.</Empty>}
          </section>
          <section>
            <SectionHeader title="Attività recenti" />
            <div className="-mx-2">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/admin/studenti/${encodeURIComponent(e.student.id)}`}
                  className={row}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{e.text}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {e.student.firstName} {e.student.lastName}
                    </span>
                  </span>
                  <time
                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    dateTime={e.createdAt}
                  >
                    {new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Europe/Rome",
                    }).format(new Date(e.createdAt))}
                  </time>
                </Link>
              ))}
            </div>
            {!events.length && (
              <Empty>Le modifiche alle schede compariranno qui.</Empty>
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-10">
          <section>
            <SectionHeader
              title="Prossime lezioni"
              href="/admin/lezioni"
              link="Calendario"
            />
            <div className="-mx-2">
              {lessons.map((l) => (
                <Link
                  key={l.id}
                  href={`/admin/lezioni/${encodeURIComponent(l.id)}`}
                  className={row}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {l.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {lessonDate(l.startsAt)} · {l.coach}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {state.bookings?.filter(
                      (b) => b.lessonId === l.id && !b.cancelled,
                    ).length ?? 0}
                    /{l.capacity}
                  </span>
                </Link>
              ))}
            </div>
            {!lessons.length && (
              <Empty>
                Nessuna lezione in programma.{" "}
                <Link
                  href="/admin/lezioni"
                  className="text-foreground underline underline-offset-4"
                >
                  Programma una lezione
                </Link>
              </Empty>
            )}
          </section>
          <section>
            <SectionHeader title="Da completare" />
            <div className="-mx-2">
              {incomplete.slice(0, 5).map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/studenti/${encodeURIComponent(s.id)}`}
                  className={row}
                >
                  <span className="truncate text-sm">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Proprietà mancanti
                  </span>
                </Link>
              ))}
            </div>
            {!incomplete.length && (
              <Empty>Tutte le schede sono complete.</Empty>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
const tile =
  "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-foreground/[.02]";
const row =
  "flex min-h-12 items-center justify-between gap-4 rounded-[10px] px-2 py-2 transition-colors hover:bg-foreground/[.03]";
function SectionHeader({
  title,
  href,
  link,
}: {
  title: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          {link}
        </Link>
      )}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
