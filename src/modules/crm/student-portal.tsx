"use client";
import Link from "next/link";
import { StudentHome, type StudentView } from "./student-home";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check, KeyRound, LogOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { PageHeading } from "@/components/page-heading";
import { getInitials } from "@/lib/format";
import { StudentShell, studentNavItems } from "./student-shell";
import { requestJson, RequestError } from "@/lib/request-json";
import { StudentCalendar } from "./student-calendar";
import { Button } from "@/components/ui/button";
import { FormError } from "./ui";
import { PlanMonthSelect } from "./plan-month-select";
import { StudentPlan } from "./student-plan";
import type { WorkoutInput } from "./workout-progress";
import { todayRome } from "./fitness-logic";
import {
  parseStudentPortalData,
  type StudentPortalData,
} from "./student-portal-model";
export function StudentPortal({
  initial,
  view = "home",
}: {
  initial: StudentPortalData;
  view?: StudentView;
}) {
  const [data, setData] = useState(initial),
    [month, setMonth] = useState(todayRome().slice(0, 7)),
    [pending, setPending] = useState<string | null>(null),
    [refreshing, setRefreshing] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [authRequired, setAuthRequired] = useState(false);
  const pendingRef = useRef(false);
  const refreshRef = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (refreshRef.current) return refreshRef.current;
    if (pendingRef.current) return Promise.resolve();
    setRefreshing(true);
    const operation = requestJson("/api/prenotazioni")
      .then((next) => {
        setData(parseStudentPortalData(next));
        setError("");
        setAuthRequired(false);
      })
      .catch((e: Error) => {
        setAuthRequired(e instanceof RequestError && e.status === 401);
        setError(e.message);
      })
      .finally(() => {
        setRefreshing(false);
        refreshRef.current = null;
      });
    refreshRef.current = operation;
    return operation;
  }, []);
  useEffect(() => {
    const focus = () => {
      if (navigator.onLine) void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") focus();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const changeBooking = async (lessonId: string, cancelled: boolean) => {
    if (pendingRef.current || refreshRef.current) return false;
    pendingRef.current = true;
    setPending(lessonId);
    setMessage("");
    setError("");
    try {
      const next = await requestJson("/api/prenotazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, cancelled }),
      });
      setData(parseStudentPortalData(next));
      setAuthRequired(false);
      setMessage(
        cancelled
          ? "Prenotazione annullata. Il posto è di nuovo disponibile."
          : "Prenotazione confermata. Trovi la lezione in Le mie prenotazioni.",
      );
      return true;
    } catch (e) {
      setAuthRequired(e instanceof RequestError && e.status === 401);
      setError((e as Error).message);
      return false;
    } finally {
      setPending(null);
      pendingRef.current = false;
    }
  };
  const saveWorkout = async (input: WorkoutInput) => {
    if (pendingRef.current || refreshRef.current) return false;
    pendingRef.current = true;
    setError("");
    try {
      const next = await requestJson("/api/allenamenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      setData(parseStudentPortalData(next));
      setAuthRequired(false);
      return true;
    } catch (e) {
      setAuthRequired(e instanceof RequestError && e.status === 401);
      setError((e as Error).message);
      return false;
    } finally {
      pendingRef.current = false;
    }
  };
  const assignment = data.assignments.find((a) => a.month === month);
  const titles = {
    home: `Ciao, ${data.student.firstName}`,
    piano: "Il mio piano",
    prenotazioni: "Prenotazioni",
  };
  return (
    <StudentShell
      view={view}
      items={studentNavItems(data.services, data.lessons.length > 0)}
      actions={<StudentAccountMenu student={data.student} />}
    >
      <PageHeading
        title={titles[view]}
        description={
          view === "home" ? (
            <span className="first-letter:uppercase">
              {new Intl.DateTimeFormat("it-IT", {
                dateStyle: "full",
                timeZone: "Europe/Rome",
              }).format(new Date())}
            </span>
          ) : undefined
        }
        action={
          view === "piano" && data.services.plans ? (
            <div className="w-full sm:w-72">
              <PlanMonthSelect
                value={month}
                months={data.assignments.map((a) => a.month)}
                onChange={setMonth}
                aria-label="Mese del piano"
              />
            </div>
          ) : undefined
        }
      />
      {view === "home" && (
        <StudentHome
          services={data.services}
          hasPlan={Boolean(assignment)}
          hasBookings={data.lessons.length > 0}
        />
      )}
      {message && (
        <p
          role="status"
          className="mb-5 flex items-start gap-2 rounded-[10px] bg-emerald-500/10 px-3 py-2.5 text-[13px] text-emerald-900 dark:text-emerald-300"
        >
          <Check className="mt-0.5 size-4 shrink-0" />
          {message}
        </p>
      )}
      <FormError message={error} />
      {authRequired && (
        <Button asChild className="mt-3 mb-5">
          <Link href="/login">Accedi di nuovo</Link>
        </Button>
      )}
      {view === "prenotazioni" &&
        (data.services.lessons || data.lessons.length > 0) && (
          <StudentCalendar
            data={data}
            pending={pending}
            refreshing={refreshing}
            error={error}
            refresh={() => void refresh()}
            onChange={changeBooking}
          />
        )}
      {view === "piano" && data.services.plans && (
        <>
          {assignment ? (
            <StudentPlan
              key={assignment.id + assignment.createdAt}
              assignment={assignment}
              entries={data.workoutEntries}
              coach={data.coach}
              onSave={saveWorkout}
            />
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nessun piano per questo mese. Il team ti assegnerà il piano del
              tuo percorso.
            </p>
          )}
        </>
      )}
      {view !== "home" &&
        ((view === "piano" && !data.services.plans) ||
          (view === "prenotazioni" &&
            !data.services.lessons &&
            !data.lessons.length)) && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Il team non ha ancora abilitato questo servizio per il tuo percorso.
          </p>
        )}
    </StudentShell>
  );
}
function StudentAccountMenu({
  student,
}: {
  student: StudentPortalData["student"];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Menu account"
          className="flex size-8 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-background outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2"
        >
          {getInitials(student.firstName, student.lastName)}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-60 rounded-xl border bg-card p-1 text-sm shadow-[0_4px_24px_rgba(0,0,0,0.08)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="m-1 mb-1.5 rounded-[10px] border px-3 py-2.5">
            <p className="truncate font-medium">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-xs text-muted-foreground">Area studente</p>
          </div>
          <DropdownMenu.Item asChild>
            <Link
              href="/imposta-password"
              className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 outline-none focus:bg-muted"
            >
              <KeyRound className="size-4 text-muted-foreground" />
              Cambia password
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <form method="POST" action="/auth/signout">
            <DropdownMenu.Item asChild>
              <button
                type="submit"
                className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 outline-none focus:bg-muted"
              >
                <LogOut className="size-4 text-muted-foreground" />
                Esci
              </button>
            </DropdownMenu.Item>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
