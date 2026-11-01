"use client";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { useCrm, useHydrated } from "./store";
import { Field, control, FormError, LocalNotice } from "./ui";
import { todayRome } from "./fitness-logic";
import { AssignedPlan } from "./plans-workspace";
import { updateCrm } from "./store";
import { prepareStudentBooking } from "./student-booking";
import { StudentCalendar } from "./student-calendar";
import { studentProjection } from "./student-portal-model";
import { studentAccess } from "./tier-access";
import { PlanMonthSelect } from "./plan-month-select";
export function StudentPreview() {
  const state = useCrm(),
    hydrated = useHydrated();
  const [selected, setSelected] = useState(""),
    [month, setMonth] = useState(todayRome().slice(0, 7)),
    [pending, setPending] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const students = state.students.filter((s) => !s.archived);
  const student = students.find((s) => s.id === selected) ?? students[0];
  const services = student ? studentAccess(state, student) : null;
  const assignment = state.assignments?.find(
    (a) => a.studentId === student?.id && a.month === month,
  );
  const data = student ? studentProjection(state, student.id) : null;
  return (
    <div className="min-h-dvh bg-[#fafafa]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-5 py-4 sm:px-8">
        <Brand />
        <Button asChild variant="outline">
          <Link href="/admin">Torna all’admin</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
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
                  disabled={Boolean(pending)}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setError("");
                    setMessage("");
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
            {message && (
              <p
                role="status"
                className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
              >
                {message}
              </p>
            )}
            <FormError message={error} />
            {data && (services?.lessons || data.lessons.length > 0) && (
              <div className="mb-10">
                <StudentCalendar
                  data={data}
                  pending={pending}
                  error={error}
                  onChange={async (lessonId, cancelled) => {
                    if (pending) return false;
                    setPending(lessonId);
                    setError("");
                    try {
                      await updateCrm((current) =>
                        prepareStudentBooking(
                          current,
                          student.id,
                          lessonId,
                          cancelled,
                        ),
                      );
                      setMessage(
                        cancelled
                          ? "Prenotazione annullata."
                          : "Prenotazione confermata.",
                      );
                      return true;
                    } catch (e) {
                      setError((e as Error).message);
                      return false;
                    } finally {
                      setPending(null);
                    }
                  }}
                />
              </div>
            )}
            {services?.plans && (
              <>
                <h2 className="mb-4 text-lg font-medium">Il tuo piano</h2>
                {assignment ? (
                  <AssignedPlan assignment={assignment} />
                ) : (
                  <p className="rounded-xl border p-6 text-sm text-muted-foreground">
                    Nessun piano assegnato per questo mese.
                  </p>
                )}
              </>
            )}
            {!services?.plans && !services?.lessons && (
              <p className="rounded-xl border p-6 text-sm text-muted-foreground">
                Nessun servizio abilitato per questo tier.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
