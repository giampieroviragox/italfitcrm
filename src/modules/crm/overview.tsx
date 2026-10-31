"use client";
import Link from "next/link";
import { UserPlus, Dumbbell, CalendarDays, ArrowUpRight } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import { StatusBadge } from "@/modules/students/components/status-badge";
import { useCrm } from "./store";
import { validPropertyValue } from "./model";
import { todayRome } from "./fitness-logic";
import { lessonDate } from "./lessons-workspace";
import { LocalNotice } from "./ui";
import { formatMonth } from "@/lib/format";
export default function OverviewPage() {
  const state = useCrm();
  const students = state.students.filter((s) => !s.archived);
  const required = state.properties.filter((p) => !p.archived && p.required);
  const incomplete = students.filter((s) =>
    required.some((p) => !validPropertyValue(p, s.properties[p.id])),
  );
  const active = students.filter((s) => s.status === "active");
  const month = todayRome().slice(0, 7);
  const unassigned = active.filter(
    (s) =>
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
  return (
    <>
      <PageHeading
        title="Home"
        description={new Intl.DateTimeFormat("it-IT", {
          dateStyle: "full",
          timeZone: "Europe/Rome",
        }).format(new Date())}
        action={
          <Button asChild>
            <Link href="/admin/studenti/nuovo">
              <UserPlus className="size-4" />
              Aggiungi studente
            </Link>
          </Button>
        }
      />
      <LocalNotice />
      <section
        aria-label="Azioni rapide"
        className="mb-8 grid gap-3 sm:grid-cols-3"
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
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-4 rounded-xl border p-5 transition-colors hover:bg-muted/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-white">
              <item.icon className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">{item.title}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {item.text}
              </p>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </section>
      <section
        aria-label="Riepilogo"
        className="mb-9 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {[
          {
            label: "Studenti",
            value: students.length,
            detail: "Schede non archiviate",
          },
          {
            label: "Attivi",
            value: active.length,
            detail: "Studenti con stato attivo",
          },
          {
            label: "Schede da completare",
            value: incomplete.length,
            detail: "Proprietà obbligatorie mancanti",
          },
          {
            label: "Senza piano mensile",
            value: unassigned.length,
            detail: `Studenti attivi · ${formatMonth(month)}`,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border p-5">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-3 text-3xl font-medium tracking-tight">
              {item.value}
            </p>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              {item.detail}
            </p>
          </div>
        ))}
      </section>
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <section className="min-w-0 rounded-xl border">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="text-sm font-medium">Studenti recenti</h2>
            <Link
              href="/admin/studenti"
              className="text-xs text-muted-foreground hover:underline"
            >
              Vedi tutti →
            </Link>
          </div>
          <div className="divide-y">
            {recent.map((s) => (
              <Link
                key={s.id}
                href={`/admin/studenti/${encodeURIComponent(s.id)}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/30"
              >
                <StudentIdentity student={s} />
                <StatusBadge status={s.status} />
              </Link>
            ))}
          </div>
          {!recent.length && (
            <p className="p-5 text-sm text-muted-foreground">
              Nessuno studente presente.
            </p>
          )}
        </section>
        <section className="rounded-xl border">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="text-sm font-medium">Prossime lezioni</h2>
            <Link
              href="/admin/lezioni"
              className="text-xs text-muted-foreground hover:underline"
            >
              Calendario →
            </Link>
          </div>
          <div className="divide-y">
            {lessons.map((l) => (
              <Link
                key={l.id}
                href={`/admin/lezioni/${encodeURIComponent(l.id)}`}
                className="block px-5 py-4 hover:bg-muted/30"
              >
                <p className="text-sm font-medium">{l.title}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {lessonDate(l.startsAt)} · {l.location}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.bookings?.filter(
                    (b) => b.lessonId === l.id && !b.cancelled,
                  ).length ?? 0}
                  /{l.capacity} iscritti · {l.coach}
                </p>
              </Link>
            ))}
          </div>
          {!lessons.length && (
            <div className="p-5">
              <p className="text-sm text-muted-foreground">
                Nessuna lezione in programma.
              </p>
              <Link
                href="/admin/lezioni"
                className="mt-4 inline-block text-xs underline underline-offset-4"
              >
                Programma una lezione
              </Link>
            </div>
          )}
        </section>
        <section className="rounded-xl border">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-medium">Attività recenti</h2>
          </div>
          <div className="divide-y">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/admin/studenti/${encodeURIComponent(e.student.id)}`}
                className="flex items-start justify-between gap-5 px-5 py-4 hover:bg-muted/30"
              >
                <div>
                  <p className="text-sm">{e.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.student.firstName} {e.student.lastName}
                  </p>
                </div>
                <time
                  className="shrink-0 text-[11px] text-muted-foreground"
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
            <p className="p-5 text-sm text-muted-foreground">
              Le modifiche alle schede compariranno qui.
            </p>
          )}
        </section>
        <section className="rounded-xl border p-5">
          <h2 className="text-sm font-medium">Da completare</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Schede con proprietà obbligatorie mancanti.
          </p>
          <div className="mt-3 divide-y">
            {incomplete.slice(0, 4).map((s) => (
              <Link
                key={s.id}
                href={`/admin/studenti/${encodeURIComponent(s.id)}`}
                className="flex justify-between gap-3 py-3 text-xs"
              >
                <span>
                  {s.firstName} {s.lastName}
                </span>
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
          {!incomplete.length && (
            <p className="mt-4 text-xs text-muted-foreground">
              Nessuna scheda da completare.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
