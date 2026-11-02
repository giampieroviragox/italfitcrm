"use client";
import { StudentHome, type StudentView } from "./student-home";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { useCrm, useHydrated } from "./store";
import { Field, control, FormError, LocalNotice } from "./ui";
import { todayRome } from "./fitness-logic";
import { StudentPlan } from "./student-plan";
import { updateCrm } from "./store";
import { prepareStudentBooking } from "./student-booking";
import { StudentCalendar } from "./student-calendar";
import { studentProjection } from "./student-portal-model";
import { studentAccess } from "./tier-access";
import { PlanMonthSelect } from "./plan-month-select";
export function StudentPreview({
  view = "home",
  initialStudentId = "",
}: {
  view?: StudentView;
  initialStudentId?: string;
}) {
  const state = useCrm(),
    hydrated = useHydrated();
  const [selected, setSelected] = useState(initialStudentId),
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
    <div className="min-h-dvh bg-[#f8f9f6]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-8 sm:py-4">
        <Brand />
        <Button asChild variant="outline">
          <Link href="/admin">Torna all’admin</Link>
        </Button>
      </header>
      <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-8 sm:py-9">
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
            <div className="mb-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
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
              {view === "piano" && services?.plans && (
                <Field label="Mese del piano">
                  <PlanMonthSelect
                    value={month}
                    months={(state.assignments ?? [])
                      .filter(
                        (assignment) => assignment.studentId === student.id,
                      )
                      .map((assignment) => assignment.month)}
                    onChange={setMonth}
                  />
                </Field>
              )}
            </div>
            {view !== "home" && (
              <Link
                href={`/area-studente?studente=${encodeURIComponent(student.id)}`}
                className="mb-6 inline-block text-sm text-muted-foreground hover:underline"
              >
                ← La mia home
              </Link>
            )}
            {view === "home" && services && (
              <>
                <h2 className="mb-5 text-2xl font-semibold">
                  Ciao, {student.firstName}
                </h2>
                <StudentHome
                  services={services}
                  hasBookings={Boolean(data?.lessons.length)}
                  studentId={student.id}
                />
              </>
            )}
            {message && (
              <p
                role="status"
                className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
              >
                {message}
              </p>
            )}
            <FormError message={error} />
            {view === "prenotazioni" &&
              data &&
              (services?.lessons || data.lessons.length > 0) && (
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
            {view === "piano" && services?.plans && (
              <>
                <h2 className="mb-4 text-lg font-medium">Il tuo piano</h2>
                {assignment ? (
                  <StudentPlan
                    key={student.id + assignment.id + assignment.createdAt}
                    assignment={assignment}
                    entries={data?.workoutEntries}
                    coach={data?.coach}
                  />
                ) : (
                  <p className="rounded-xl border p-6 text-sm text-muted-foreground">
                    Nessun piano assegnato per questo mese.
                  </p>
                )}
              </>
            )}
            {view !== "home" &&
              ((view === "piano" && !services?.plans) ||
                (view === "prenotazioni" &&
                  !services?.lessons &&
                  !data?.lessons.length)) && (
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
