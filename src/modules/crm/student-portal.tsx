"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, Check } from "lucide-react";
import { requestJson, RequestError } from "@/lib/request-json";
import { ConfirmDialog } from "./confirm-dialog";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Field, FormError } from "./ui";
import { PlanMonthSelect } from "./plan-month-select";
import { AssignedPlan } from "./plans-workspace";
import { lessonDate } from "./lessons-workspace";
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
    [cancel, setCancel] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [onlyMine, setOnlyMine] = useState(false),
    [error, setError] = useState(""),
    [authRequired, setAuthRequired] = useState(false);
  const pendingRef = useRef(false);
  const lessonFilter = useRef<HTMLButtonElement>(null);
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
    if (pendingRef.current || refreshRef.current) return;
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
      setCancel(null);
      setMessage(
        cancelled
          ? "Prenotazione annullata. Il posto è di nuovo disponibile."
          : "Prenotazione confermata. Trovi la lezione in Le mie prenotazioni.",
      );
    } catch (e) {
      setAuthRequired(e instanceof RequestError && e.status === 401);
      setError((e as Error).message);
    } finally {
      setPending(null);
      pendingRef.current = false;
    }
  };
  const now = useClock();
  const upcoming = data.lessons.filter((l) => Date.parse(l.startsAt) > now);
  const visibleLessons = upcoming
    .filter((l) => !onlyMine || l.enrolled || l.cancelled)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const assignment = data.assignments.find((a) => a.month === month);
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-8">
        <Brand />
        <form method="POST" action="/auth/signout">
          <Button type="submit" variant="outline">
            Esci
          </Button>
        </form>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
        <PageHeading
          title={`Ciao, ${data.student.firstName}`}
          description="I servizi e le attività del tuo percorso."
        />
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
        {(data.services.lessons || upcoming.length > 0) && (
          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Lezioni in sede</h2>
              <Button
                variant="outline"
                disabled={Boolean(pending) || refreshing}
                onClick={() => void refresh()}
              >
                <RefreshCw
                  className={refreshing ? "size-4 animate-spin" : "size-4"}
                />
                {refreshing ? "Aggiornamento…" : "Aggiorna disponibilità"}
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.services.lessons
                ? "Orari di Roma. Prenota un posto tra le lezioni disponibili."
                : "Le lezioni non sono più incluse nel tuo tier. Puoi consultare e annullare le tue prenotazioni già confermate."}
              {data.services.lessons &&
                data.services.monthlyBookingLimit !== null &&
                ` Il tuo percorso include fino a ${data.services.monthlyBookingLimit} ${data.services.monthlyBookingLimit === 1 ? "lezione" : "lezioni"} per mese.`}
            </p>
            <div
              className="mt-5 flex flex-wrap gap-2"
              aria-label="Visualizzazione lezioni"
            >
              <Button
                variant={onlyMine ? "ghost" : "secondary"}
                aria-pressed={!onlyMine}
                onClick={() => setOnlyMine(false)}
              >
                Tutte le lezioni
              </Button>
              <Button
                ref={lessonFilter}
                variant={onlyMine ? "secondary" : "ghost"}
                aria-pressed={onlyMine}
                onClick={() => setOnlyMine(true)}
              >
                Le mie prenotazioni (
                {upcoming.filter((l) => l.enrolled && !l.cancelled).length})
              </Button>
            </div>
            {message && (
              <p
                role="status"
                className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
              >
                <Check className="mt-0.5 size-4 shrink-0" />
                {message}
              </p>
            )}
            <div className="mt-4">
              <FormError message={error} />
              {authRequired && (
                <Button asChild className="mt-3">
                  <Link href="/login">Accedi di nuovo</Link>
                </Button>
              )}
            </div>
            <div className="mt-5 divide-y rounded-xl border">
              {visibleLessons.map((l) => (
                <article
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div>
                    <h3 className="text-sm font-medium">
                      {l.title}
                      {l.cancelled
                        ? " · Annullata"
                        : l.enrolled
                          ? " · Prenotata"
                          : ""}
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {lessonDate(l.startsAt)} · {l.durationMinutes} min
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {l.coach} · {l.location} · {l.occupied}/{l.capacity} posti
                    </p>
                    {!l.enrolled && l.restriction && (
                      <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">
                        {l.restriction}
                      </p>
                    )}
                  </div>
                  <Button
                    variant={l.enrolled ? "outline" : "default"}
                    disabled={
                      Boolean(pending) ||
                      refreshing ||
                      l.cancelled ||
                      (!l.enrolled &&
                        (l.occupied >= l.capacity ||
                          data.student.status !== "active" ||
                          Boolean(l.restriction)))
                    }
                    aria-label={`${l.enrolled ? "Annulla prenotazione" : "Prenota"}: ${l.title}`}
                    onClick={() => {
                      if (l.enrolled) {
                        setError("");
                        setCancel(l.id);
                      } else void changeBooking(l.id, false);
                    }}
                  >
                    {pending === l.id
                      ? "Salvataggio…"
                      : l.cancelled
                        ? "Lezione annullata"
                        : l.enrolled
                          ? "Annulla prenotazione"
                          : l.occupied >= l.capacity
                            ? "Completa"
                            : data.student.status !== "active"
                              ? "Percorso da attivare"
                              : l.restriction
                                ? "Non disponibile per il tier"
                                : "Prenota"}
                  </Button>
                </article>
              ))}
              {!visibleLessons.length && (
                <p className="p-6 text-sm text-muted-foreground">
                  {onlyMine
                    ? "Non hai prenotazioni in programma. Scegli una lezione tra quelle disponibili."
                    : "Nessuna lezione in programma. Il team pubblicherà i prossimi orari qui."}
                </p>
              )}
            </div>
            {data.student.status !== "active" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Le prenotazioni saranno disponibili quando il team attiverà il
                tuo percorso.
              </p>
            )}
          </section>
        )}
        <Link
          href="/imposta-password"
          className="mt-8 inline-block text-xs text-muted-foreground underline underline-offset-4"
        >
          Cambia password
        </Link>
        <ConfirmDialog
          open={Boolean(cancel)}
          title="Annullare la prenotazione?"
          description="Il tuo posto sarà disponibile per gli altri studenti. Potrai prenotare di nuovo se ci saranno posti liberi."
          confirmLabel="Annulla prenotazione"
          busy={Boolean(pending)}
          fallbackFocus={() => lessonFilter.current}
          error={error}
          onCancel={() => {
            setCancel(null);
            setError("");
          }}
          onConfirm={() => {
            if (cancel) void changeBooking(cancel, true);
          }}
        />
      </main>
    </div>
  );
}
