"use client";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useClock } from "./use-clock";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { useCrm, useHydrated } from "./store";
import { Field, control, FormError, LocalNotice } from "./ui";
import { todayRome } from "./fitness-logic";
import { AssignedPlan } from "./plans-workspace";
import { changeBooking, lessonDate } from "./lessons-workspace";
import { PlanMonthSelect } from "./plan-month-select";
export function StudentPreview() {
  const now = useClock();
  const state = useCrm(),
    hydrated = useHydrated();
  const [selected, setSelected] = useState(""),
    [month, setMonth] = useState(todayRome().slice(0, 7)),
    [error, setError] = useState("");
  const students = state.students.filter((s) => !s.archived);
  const student = students.find((s) => s.id === selected) ?? students[0];
  const assignment = state.assignments?.find(
    (a) => a.studentId === student?.id && a.month === month,
  );
  const lessons = (state.lessons ?? [])
    .filter((l) => !l.cancelled && Date.parse(l.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-8">
        <Brand />
        <Button asChild variant="outline">
          <Link href="/admin">Torna all’admin</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
        <PageHeading
          title="Anteprima studente"
          description="Seleziona uno studente. Le modifiche vengono salvate sul workspace."
        />
        <LocalNotice />
        {!hydrated ? (
          <p role="status">Caricamento…</p>
        ) : !student ? (
          <p className="text-sm text-muted-foreground">
            Aggiungi uno studente dal CRM per aprire l’anteprima.
          </p>
        ) : (
          <>
            <div className="mb-8 grid gap-4 rounded-xl border bg-muted/20 p-5 sm:grid-cols-2">
              <Field label="Studente">
                <SelectControl
                  className={control}
                  value={student.id}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setError("");
                  }}
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              <Field label="Mese del piano">
                <PlanMonthSelect
                  value={month}
                  months={(state.assignments ?? [])
                    .filter((assignment) => assignment.studentId === student.id)
                    .map((assignment) => assignment.month)}
                  onChange={setMonth}
                />
              </Field>
            </div>
            <h2 className="mb-4 text-lg font-medium">Il tuo piano</h2>
            {assignment ? (
              <AssignedPlan assignment={assignment} />
            ) : (
              <p className="rounded-xl border p-6 text-sm text-muted-foreground">
                Nessun piano assegnato per questo mese.
              </p>
            )}
            <section className="mt-10">
              <h2 className="text-lg font-medium">Lezioni in sede</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Orari di Roma. Prenota tra i posti disponibili.
              </p>
              <FormError message={error} />
              <div className="mt-5 divide-y rounded-xl border">
                {lessons.map((l) => {
                  const booking = state.bookings?.find(
                      (b) =>
                        b.studentId === student.id &&
                        b.lessonId === l.id &&
                        !b.cancelled,
                    ),
                    count =
                      state.bookings?.filter(
                        (b) => b.lessonId === l.id && !b.cancelled,
                      ).length ?? 0;
                  return (
                    <article
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-5"
                    >
                      <div>
                        <h3 className="text-sm font-medium">{l.title}</h3>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {lessonDate(l.startsAt)} · {l.durationMinutes} min
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {l.coach} · {l.location} · {count}/{l.capacity} posti
                        </p>
                      </div>
                      <Button
                        variant={booking ? "outline" : "default"}
                        disabled={
                          !booking &&
                          (count >= l.capacity || student.status !== "active")
                        }
                        onClick={async () => {
                          try {
                            await changeBooking(
                              l.id,
                              student.id,
                              Boolean(booking),
                            );
                            setError("");
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        {booking
                          ? "Annulla prenotazione"
                          : count >= l.capacity
                            ? "Completa"
                            : "Prenota"}
                      </Button>
                    </article>
                  );
                })}
                {!lessons.length && (
                  <p className="p-6 text-sm text-muted-foreground">
                    Nessuna lezione disponibile.
                  </p>
                )}
              </div>
              {student.status !== "active" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Le prenotazioni sono disponibili per gli studenti con stato
                  attivo.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
