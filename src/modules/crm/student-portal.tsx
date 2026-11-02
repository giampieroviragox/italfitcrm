"use client";
import Link from "next/link";
import { StudentHome, type StudentView } from "./student-home";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { requestJson, RequestError } from "@/lib/request-json";
import { StudentCalendar } from "./student-calendar";
import { Brand } from "@/components/brand";
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
  return (
    <div className="min-h-dvh min-w-0 bg-[#f8f9f6]">
      <header className="flex items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-8 sm:py-4">
        <Brand />
        <form method="POST" action="/auth/signout">
          <Button type="submit" variant="outline" className="h-11 px-4">
            Esci
          </Button>
        </form>
      </header>
      <main className="mx-auto min-w-0 max-w-6xl px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-10">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[.15em] text-[#65725a]">
              Il tuo spazio
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Ciao, {data.student.firstName}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Un allenamento alla volta.
            </p>
          </div>
          {view === "piano" && data.services.plans && (
            <div className="w-full sm:w-64">
              <PlanMonthSelect
                value={month}
                months={data.assignments.map((a) => a.month)}
                onChange={setMonth}
                aria-label="Mese del piano"
              />
            </div>
          )}
        </div>
        {view !== "home" && (
          <Link
            className="mb-6 inline-block text-sm text-muted-foreground hover:underline"
            href="/area-studente"
          >
            ← La mia home
          </Link>
        )}
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
            className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
          >
            <Check className="mt-0.5 size-4 shrink-0" />
            {message}
          </p>
        )}
        <FormError message={error} />
        {authRequired && (
          <Button asChild className="mb-5">
            <Link href="/login">Accedi di nuovo</Link>
          </Button>
        )}
        {view === "prenotazioni" &&
          (data.services.lessons || data.lessons.length > 0) && (
            <div className="mb-10">
              <StudentCalendar
                data={data}
                pending={pending}
                refreshing={refreshing}
                error={error}
                refresh={() => void refresh()}
                onChange={changeBooking}
              />
            </div>
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
              <div className="rounded-xl border p-6">
                <h2 className="text-sm font-medium">
                  Nessun piano per questo mese
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Il team ti assegnerà il piano del tuo percorso.
                </p>
              </div>
            )}
          </>
        )}
        {view !== "home" &&
          ((view === "piano" && !data.services.plans) ||
            (view === "prenotazioni" &&
              !data.services.lessons &&
              !data.lessons.length)) && (
            <p className="rounded-xl border p-6 text-sm text-muted-foreground">
              Il team non ha ancora abilitato servizi per il tuo percorso.
              Contattalo per completare l’attivazione.
            </p>
          )}
        <Link
          href="/imposta-password"
          className="mt-8 inline-block text-xs text-muted-foreground underline underline-offset-4"
        >
          Cambia password
        </Link>
      </main>
    </div>
  );
}
