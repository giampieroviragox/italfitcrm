"use client";
import Link from "next/link";
import {
  StudentCoachingCard,
  StudentHome,
  type StudentView,
} from "./student-home";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check, KeyRound, LogOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";
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
import { LessonWalletView } from "./lesson-wallet-view";
import { MaxesPanel, WorkoutHistory } from "./workout-log-view";
import { loggedSessions, type MaxCommand } from "./workout-log";
import {
  feedbackFor,
  feedbackIsOpen,
  pendingFeedback,
  type FeedbackCommand,
  type RaceCommand,
} from "./cycle-feedback";
import {
  FeedbackPrompt,
  FeedbackWizard,
  RacesPanel,
} from "./cycle-feedback-view";
import type { PlanAssignment } from "./fitness-model";
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
    [authRequired, setAuthRequired] = useState(false),
    [feedbackPlan, setFeedbackPlan] = useState<PlanAssignment | null>(null);
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
  /** Sends a student command; returns an error message or "". */
  const sendCommand = async (url: string, command: unknown) => {
    if (pendingRef.current || refreshRef.current)
      return "Attendi il salvataggio in corso e riprova.";
    pendingRef.current = true;
    try {
      const next = await requestJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      setData(parseStudentPortalData(next));
      setAuthRequired(false);
      return "";
    } catch (e) {
      setAuthRequired(e instanceof RequestError && e.status === 401);
      return (e as Error).message;
    } finally {
      pendingRef.current = false;
    }
  };
  const sendReceipt = async (form: FormData) => {
    if (pendingRef.current || refreshRef.current)
      return "Attendi il salvataggio in corso e riprova.";
    pendingRef.current = true;
    try {
      const next = await requestJson("/api/ricevute", {
        method: "POST",
        body: form,
      });
      setData(parseStudentPortalData(next));
      setAuthRequired(false);
      return "";
    } catch (e) {
      setAuthRequired(e instanceof RequestError && e.status === 401);
      return (e as Error).message;
    } finally {
      pendingRef.current = false;
    }
  };
  const saveMax = (command: MaxCommand) =>
    sendCommand("/api/massimali", command);
  const saveRace = (command: RaceCommand) => sendCommand("/api/gare", command);
  const saveFeedback = (command: FeedbackCommand) =>
    sendCommand("/api/questionario", command);
  const today = todayRome();
  const feedbackDue = data.services.plans
    ? pendingFeedback(
        { cycleFeedback: data.cycleFeedback },
        data.assignments,
        data.workoutEntries ?? [],
        today,
      )
    : undefined;
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
    progressi: "I miei progressi",
    prenotazioni: "Prenotazioni",
  };
  const history = loggedSessions(data.assignments, data.workoutEntries ?? []);
  const exerciseNames = [
    ...new Set(
      data.assignments.flatMap((a) =>
        a.snapshot.sessions
          .filter((s) => s.kind !== "run")
          .flatMap((s) => s.exercises.map((e) => e.name.trim())),
      ),
    ),
  ].toSorted((a, b) => a.localeCompare(b, "it"));
  return (
    <StudentShell
      view={view}
      items={studentNavItems(
        data.services,
        Boolean(data.lessonWallet) ||
          data.lessons.some((lesson) => lesson.enrolled),
      )}
      actions={<StudentAccountMenu student={data.student} />}
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          {view === "home" && (
            <p className="mb-1.5 text-sm text-muted-foreground first-letter:uppercase">
              {new Intl.DateTimeFormat("it-IT", {
                dateStyle: "full",
                timeZone: "Europe/Rome",
              }).format(new Date())}
            </p>
          )}
          <h1 className="text-[1.875rem] leading-tight font-bold tracking-[-0.055em] sm:text-[2.75rem]">
            {titles[view]}
          </h1>
        </div>
        {view === "piano" && data.services.plans && (
          <div className="w-40 max-w-full sm:w-56">
            <PlanMonthSelect
              value={month}
              months={data.assignments.map((a) => a.month)}
              onChange={setMonth}
              aria-label="Mese del piano"
              student
            />
          </div>
        )}
      </header>
      {view === "home" && feedbackDue && (
        <div>
          <FeedbackPrompt
            assignment={feedbackDue}
            onOpen={() => setFeedbackPlan(feedbackDue)}
          />
        </div>
      )}
      {view === "home" && (
        <StudentHome
          services={data.services}
          planTitle={assignment?.snapshot.title}
          hasBookings={
            Boolean(data.lessonWallet) ||
            data.lessons.some((lesson) => lesson.enrolled)
          }
        />
      )}
      {view === "home" && data.coaching && (
        <StudentCoachingCard coaching={data.coaching} today={todayRome()} />
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
      {view === "prenotazioni" &&
        (data.lessonWallet || data.services.lessons) && (
          <div className="mt-8">
            <LessonWalletView
              wallet={data.lessonWallet}
              onSubmitReceipt={sendReceipt}
            />
          </div>
        )}
      {view === "piano" && data.services.plans && (
        <>
          {assignment &&
            !feedbackFor({ cycleFeedback: data.cycleFeedback }, assignment) &&
            feedbackIsOpen(assignment, data.workoutEntries ?? [], today) && (
              <FeedbackPrompt
                assignment={assignment}
                onOpen={() => setFeedbackPlan(assignment)}
              />
            )}
          {assignment ? (
            <StudentPlan
              key={assignment.id + assignment.createdAt}
              assignment={assignment}
              entries={data.workoutEntries}
              coach={data.planCoaches?.[assignment.id] ?? data.coach}
              history={history}
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
      {view === "progressi" && data.services.plans && (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,38%)]">
          <WorkoutHistory
            assignments={data.assignments}
            entries={data.workoutEntries ?? []}
          />
          <div className="space-y-8">
            <RacesPanel
              title="Le mie gare"
              races={data.races ?? []}
              today={today}
              onCommand={saveRace}
            />
            <MaxesPanel
              maxes={data.maxes ?? []}
              exerciseNames={exerciseNames}
              today={today}
              onCommand={saveMax}
            />
          </div>
        </div>
      )}
      {feedbackPlan && (
        <FeedbackWizard
          key={feedbackPlan.id}
          assignment={feedbackPlan}
          races={data.races ?? []}
          today={today}
          existing={feedbackFor(
            { cycleFeedback: data.cycleFeedback },
            feedbackPlan,
          )}
          onSubmit={saveFeedback}
          close={() => setFeedbackPlan(null)}
        />
      )}
      {view !== "home" &&
        (((view === "piano" || view === "progressi") && !data.services.plans) ||
          (view === "prenotazioni" &&
            !data.services.lessons &&
            !data.lessons.length &&
            !data.lessonWallet)) && (
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
          className="flex size-11 items-center justify-center rounded-full border border-input bg-card text-xs font-bold text-[var(--workspace-accent)] transition-colors hover:bg-muted"
        >
          {getInitials(student.firstName, student.lastName)}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="student-area dark z-50 w-60 rounded-xl border bg-card p-1 text-sm shadow-[0_4px_24px_rgba(0,0,0,0.08)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
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
