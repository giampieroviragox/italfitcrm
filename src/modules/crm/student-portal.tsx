"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { requestJson, RequestError } from "@/lib/request-json";
import { StudentCalendar } from "./student-calendar";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Field, FormError } from "./ui";
import { PlanMonthSelect } from "./plan-month-select";
import { AssignedPlan } from "./plans-workspace";
import { todayRome } from "./fitness-logic";
import { useClock } from "./use-clock";
import {
  parseStudentPortalData,
  type StudentPortalData,
} from "./student-portal-model";
export function StudentPortal({ initial }: { initial: StudentPortalData }) {
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
  const now = useClock();
  const upcoming = data.lessons.filter((l) => Date.parse(l.startsAt) > now);
  const assignment = data.assignments.find((a) => a.month === month);
  return (
    <div className="min-h-dvh bg-[#fafafa]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-5 py-4 sm:px-8">
        <Brand />
        <form method="POST" action="/auth/signout">
          <Button type="submit" variant="outline">
            Esci
          </Button>
        </form>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
        <PageHeading
          title={`Ciao, ${data.student.firstName}`}
          description="I servizi e le attività del tuo percorso."
        />
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
        {(data.services.lessons || upcoming.length > 0) && (
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
        {data.services.plans && (
          <>
            <div className="mb-7 max-w-xs">
              <Field label="Mese del piano">
                <PlanMonthSelect
                  value={month}
                  months={data.assignments.map(
                    (assignment) => assignment.month,
                  )}
                  onChange={setMonth}
                />
              </Field>
            </div>
            {assignment ? (
              <AssignedPlan assignment={assignment} />
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
        {!data.services.plans && !data.services.lessons && !upcoming.length && (
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
