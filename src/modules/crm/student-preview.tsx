"use client";
import { StudentHome, type StudentView } from "./student-home";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { StudentShell, studentNavItems } from "./student-shell";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { useCrm, useHydrated } from "./store";
import { FormError, LocalNotice } from "./ui";
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
  const titles = {
    home: student ? `Ciao, ${student.firstName}` : "Anteprima studente",
    piano: "Il mio piano",
    prenotazioni: "Prenotazioni",
  };
  return (
    <StudentShell
      view={view}
      items={
        services
          ? studentNavItems(services, Boolean(data?.lessons.length))
          : [{ view: "home", label: "Home" }]
      }
      query={student ? `?studente=${encodeURIComponent(student.id)}` : ""}
      actions={
        <>
          {hydrated && student && (
            <div className="w-36 sm:w-48">
              <SelectControl
                aria-label="Studente in anteprima"
                className="h-8 rounded-[10px] text-[13px]"
                value={student.id}
                disabled={Boolean(pending)}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setError("");
                  setMessage("");
                  window.history.replaceState(
                    null,
                    "",
                    `?studente=${encodeURIComponent(e.target.value)}`,
                  );
                }}
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </SelectControl>
            </div>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </Button>
        </>
      }
    >
      <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-foreground/[.045] px-3 py-1 text-xs text-muted-foreground">
        <Eye className="size-3.5" />
        Anteprima: le modifiche vengono salvate sul workspace
      </p>
      <LocalNotice />
      {!hydrated ? (
        <p role="status" className="text-sm text-muted-foreground">
          Caricamento…
        </p>
      ) : !student ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aggiungi uno studente dal CRM per aprire l’anteprima.
        </p>
      ) : (
        <>
          <PageHeading
            title={titles[view]}
            action={
              view === "piano" && services?.plans ? (
                <div className="w-full sm:w-72">
                  <PlanMonthSelect
                    value={month}
                    months={(state.assignments ?? [])
                      .filter((a) => a.studentId === student.id)
                      .map((a) => a.month)}
                    onChange={setMonth}
                    aria-label="Mese del piano"
                  />
                </div>
              ) : undefined
            }
          />
          {view === "home" && services && (
            <StudentHome
              services={services}
              hasPlan={Boolean(assignment)}
              hasBookings={Boolean(data?.lessons.length)}
              studentId={student.id}
            />
          )}
          {message && (
            <p
              role="status"
              className="mb-5 rounded-[10px] bg-emerald-500/10 px-3 py-2.5 text-[13px] text-emerald-900 dark:text-emerald-300"
            >
              {message}
            </p>
          )}
          <FormError message={error} />
          {view === "prenotazioni" &&
            data &&
            (services?.lessons || data.lessons.length > 0) && (
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
            )}
          {view === "piano" &&
            services?.plans &&
            (assignment ? (
              <StudentPlan
                key={student.id + assignment.id + assignment.createdAt}
                assignment={assignment}
                entries={data?.workoutEntries}
                coach={data?.coach}
              />
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nessun piano assegnato per questo mese.
              </p>
            ))}
          {view !== "home" &&
            ((view === "piano" && !services?.plans) ||
              (view === "prenotazioni" &&
                !services?.lessons &&
                !data?.lessons.length)) && (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nessun servizio abilitato per questo tier.
              </p>
            )}
        </>
      )}
    </StudentShell>
  );
}
