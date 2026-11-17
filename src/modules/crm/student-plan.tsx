"use client";
import { useState, useEffect, useRef } from "react";
import { CoachNote, ProgramReference, RecoveryNote } from "./plan-notes";
import type { StudentCoach } from "./student-coach";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Footprints,
  Play,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Field, FormError, control } from "./ui";
import type {
  PlanAssignment,
  WorkoutSession,
  WorkoutEntry,
} from "./fitness-model";
import type { WorkoutInput } from "./workout-progress";
import { formatMonth } from "@/lib/format";
import { DatePicker } from "@/components/ui/date-time-picker";
import { todayRome } from "./fitness-logic";
import { lastLoggedSets, type LoggedSession } from "./workout-log";
import {
  LoggedSets,
  RpePicker,
  SetLogger,
  draftToLogs,
  initialDraft,
  type LogDraft,
} from "./workout-log-view";

function MovementIcon({
  run = false,
  className = "size-4",
}: {
  run?: boolean;
  className?: string;
}) {
  const Icon = run ? Footprints : Dumbbell;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
function secondsLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function RestTimer({ seconds }: { seconds: number }) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (!deadline) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [deadline]);
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-background p-4">
      <div>
        <p className="text-xs text-muted-foreground">Recupero</p>
        <p
          className="mt-1 text-2xl font-semibold text-[var(--workspace-accent)] tabular-nums"
          role="timer"
          aria-label="Tempo di recupero"
        >
          {secondsLabel(remaining)}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          setRemaining(seconds);
          setDeadline(Date.now() + seconds * 1000);
        }}
      >
        <Timer className="size-4" />
        {deadline ? "Ricomincia" : "Avvia timer"}
      </Button>
      {deadline && remaining === 0 && (
        <span role="status" className="sr-only">
          Recupero terminato
        </span>
      )}
    </div>
  );
}
function SessionCopy({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return (
    <details className="group rounded-2xl border bg-card px-4 py-3.5" open>
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">
        {title}
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
        {text}
      </p>
    </details>
  );
}
function WorkoutGuide({
  assignment,
  session,
  entry,
  history,
  save,
  close,
  returnFocus,
}: {
  assignment: PlanAssignment;
  session: WorkoutSession;
  entry?: WorkoutEntry;
  history: LoggedSession[];
  save: (input: WorkoutInput) => Promise<boolean>;
  close: () => void;
  returnFocus: () => void;
}) {
  const strength = session.kind !== "run";
  const today = todayRome();
  const [initial] = useState(() =>
    JSON.stringify({
      notes: entry?.notes ?? "",
      draft: initialDraft(session.exercises, entry?.exercises),
      rpe: entry?.rpe,
      date: entry?.performedOn ?? today,
    }),
  );
  const [index, setIndex] = useState(0),
    [done, setDone] = useState(false),
    [notes, setNotes] = useState(entry?.notes ?? ""),
    [draft, setDraft] = useState<LogDraft>(() =>
      initialDraft(session.exercises, entry?.exercises),
    ),
    [rpe, setRpe] = useState<number | undefined>(entry?.rpe),
    [date, setDate] = useState(entry?.performedOn ?? today),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  const exercise = session.exercises[index];
  const dirty = JSON.stringify({ notes, draft, rpe, date }) !== initial;
  const leave = () => {
    if (
      !pending &&
      (!dirty ||
        window.confirm(
          "Serie e note non sono ancora salvate. Vuoi uscire dall’allenamento?",
        ))
    )
      close();
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) leave();
      }}
    >
      <SheetContent
        className="student-area dark gap-0 bg-background data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          leave();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <SheetHeader className="border-b p-4 pr-14 sm:p-6 sm:pr-16">
          <SheetTitle className="text-xl font-semibold tracking-tight">
            {session.name}
          </SheetTitle>
          <SheetDescription>
            {done
              ? "Riepilogo della sessione"
              : `Passaggio ${index + 1} di ${session.exercises.length}`}
          </SheetDescription>
        </SheetHeader>
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-3 right-3 size-11"
          aria-label="Chiudi allenamento"
          disabled={pending}
          onClick={leave}
        >
          <X />
        </Button>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6">
          {!done && exercise ? (
            <>
              <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{
                    width: `${(index / session.exercises.length) * 100}%`,
                  }}
                />
              </div>
              {index === 0 && (
                <div className="mb-5">
                  <SessionCopy
                    title="Riscaldamento"
                    text={session.preparation}
                  />
                </div>
              )}
              <div className="rounded-3xl border bg-card p-5 sm:p-6">
                <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-muted text-[var(--workspace-accent)]">
                  <MovementIcon
                    run={session.kind === "run"}
                    className="size-6"
                  />
                </span>
                <p className="text-[13px] text-muted-foreground">
                  {session.kind === "run"
                    ? "Lavoro di corsa"
                    : `Esercizio ${index + 1}`}
                </p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">
                  {exercise.name}
                </h3>
                <p className="mt-3 text-2xl font-semibold text-[var(--workspace-accent)] tabular-nums">
                  {exercise.sets > 1 ? `${exercise.sets} × ` : ""}
                  {exercise.reps}
                </p>
                {exercise.notes && (
                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {exercise.notes}
                  </p>
                )}
                {exercise.restSeconds > 0 && (
                  <div className="mt-6">
                    <RestTimer
                      key={exercise.id}
                      seconds={exercise.restSeconds}
                    />
                  </div>
                )}
                {strength && draft[exercise.id] && (
                  <div className="mt-6 border-t pt-5">
                    <SetLogger
                      key={exercise.id}
                      exercise={exercise}
                      sets={draft[exercise.id]!}
                      onChange={(sets) =>
                        setDraft((d) => ({ ...d, [exercise.id]: sets }))
                      }
                      last={lastLoggedSets(history, exercise.name, {
                        assignmentId: assignment.id,
                        sessionId: session.id,
                      })}
                    />
                  </div>
                )}
              </div>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  size="icon-lg"
                  disabled={index === 0}
                  aria-label="Passaggio precedente"
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  size="lg"
                  className="flex-1 rounded-full"
                  onClick={() => {
                    if (index + 1 === session.exercises.length) setDone(true);
                    else setIndex((i) => i + 1);
                  }}
                >
                  <Check className="size-4" />
                  {index + 1 === session.exercises.length
                    ? "Concludi allenamento"
                    : "Fatto, avanti"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-muted text-[var(--workspace-accent)]">
                <Check className="size-6" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Ben fatto</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Prenditi il tempo per defaticare e annotare come è andata. Poi
                salva la sessione.
              </p>
              <div className="my-6 space-y-4">
                <RecoveryNote title="Defaticamento" text={session.cooldown} />
                <SessionCopy
                  title="Indicazioni del coach"
                  text={session.guidance}
                />
              </div>
              <div className="mb-5 space-y-5">
                <Field label="Data dell’allenamento">
                  <DatePicker
                    required
                    max={today}
                    value={date}
                    onChange={setDate}
                  />
                </Field>
                <RpePicker value={rpe} onChange={setRpe} />
              </div>
              <Field
                label="Come ti sei sentito?"
                hint="Sensazioni, cosa è successo nella sessione, tempi o difficoltà."
              >
                <textarea
                  className={`${control} text-base sm:text-sm`}
                  rows={6}
                  maxLength={5000}
                  placeholder="Come è andata?"
                  value={notes}
                  disabled={pending}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <div className="mt-5">
                <FormError message={error} />
              </div>
              <Button
                size="lg"
                className="mt-3 w-full rounded-full"
                disabled={pending}
                onClick={async () => {
                  if (submitting.current) return;
                  submitting.current = true;
                  setPending(true);
                  setError("");
                  try {
                    let exercises: ReturnType<typeof draftToLogs> | undefined;
                    try {
                      exercises = strength ? draftToLogs(draft) : undefined;
                    } catch (e) {
                      setError((e as Error).message);
                      return;
                    }
                    if (
                      await save({
                        assignmentId: assignment.id,
                        assignmentCreatedAt: assignment.createdAt,
                        sessionId: session.id,
                        completed: true,
                        notes,
                        performedOn: date || today,
                        ...(rpe ? { rpe } : {}),
                        ...(exercises?.length ? { exercises } : {}),
                      })
                    )
                      close();
                    else
                      setError(
                        "Salvataggio non riuscito. Serie e note sono ancora qui: riprova.",
                      );
                  } finally {
                    submitting.current = false;
                    setPending(false);
                  }
                }}
              >
                {pending ? "Salvataggio…" : "Salva allenamento"}
                <Check className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="mt-2 w-full"
                disabled={pending}
                onClick={() => setDone(false)}
              >
                Rivedi i passaggi
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
export function StudentPlan({
  assignment,
  entries = [],
  onSave,
  coach,
  history = [],
}: {
  assignment: PlanAssignment;
  entries?: WorkoutEntry[];
  coach?: StudentCoach;
  history?: LoggedSession[];
  onSave?: (input: WorkoutInput) => Promise<boolean>;
}) {
  const { snapshot: plan } = assignment;
  const startButton = useRef<HTMLButtonElement>(null);
  const weeks = Array.from(new Set(plan.sessions.map((s) => s.week ?? 1))).sort(
    (a, b) => a - b,
  );
  const ownEntries = entries.filter(
    (e) =>
      e.assignmentId === assignment.id &&
      e.assignmentCreatedAt === assignment.createdAt,
  );
  const completedIds = new Set(
    ownEntries.filter((e) => e.completed).map((e) => e.sessionId),
  );
  const completed = plan.sessions.filter((s) => completedIds.has(s.id)).length;
  const nextWeek = weeks.find((week) =>
    plan.sessions.some(
      (s) => (s.week ?? 1) === week && !completedIds.has(s.id),
    ),
  );
  const next = plan.sessions.find(
    (s) => (s.week ?? 1) === nextWeek && !completedIds.has(s.id),
  );
  const [selectedWeek, setWeek] = useState(nextWeek ?? weeks[0] ?? 1),
    [selectedId, setSelected] = useState(next?.id ?? ""),
    [guide, setGuide] = useState(false);
  const sessions = plan.sessions.filter((s) => (s.week ?? 1) === selectedWeek);
  const session = sessions.find((s) => s.id === selectedId) ?? sessions[0];
  const entry = ownEntries.find((e) => e.sessionId === session?.id);
  const percent = plan.sessions.length
    ? Math.round((completed / plan.sessions.length) * 100)
    : 0;
  const period = (date: string) =>
    new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      day: "numeric",
      month: "short",
    }).format(new Date(date + "T12:00:00Z"));

  return (
    <section
      aria-label="Il tuo piano"
      className="min-w-0 space-y-6 sm:space-y-8"
    >
      <div className="grid gap-4 overflow-hidden rounded-3xl border bg-card px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,26%)] sm:items-end sm:gap-10 sm:p-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground first-letter:uppercase">
            {plan.program
              ? `${period(plan.program.startsOn)} – ${period(plan.program.endsOn)}`
              : formatMonth(assignment.month)}
          </p>
          <h2 className="text-pretty text-[1.75rem] leading-[1.1] font-bold tracking-[-0.045em] break-words sm:text-[2.65rem]">
            {plan.title}
          </h2>
          {plan.program?.goal && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {plan.program.goal}
            </p>
          )}
        </div>
        {onSave && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-xs text-muted-foreground">
                {completed} di {plan.sessions.length} completati
              </span>
              <span className="text-[1.65rem] leading-none font-bold tracking-tight tabular-nums sm:text-4xl">
                {percent}%
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-label="Avanzamento del programma"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,29%)] lg:gap-8">
        <div className="min-w-0 space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
                Allenamenti
              </h3>
              <span className="text-xs text-muted-foreground">
                {sessions.length}{" "}
                {sessions.length === 1 ? "sessione" : "sessioni"}
              </span>
            </div>
            {weeks.length > 1 && (
              <div
                role="group"
                aria-label="Settimane del programma"
                className="student-session-picker flex gap-2 overflow-x-auto p-1"
              >
                {weeks.map((week) => (
                  <button
                    key={week}
                    type="button"
                    aria-pressed={selectedWeek === week}
                    className="min-h-11 shrink-0 rounded-full border border-input px-4 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted aria-pressed:border-[var(--border-hover)] aria-pressed:bg-muted aria-pressed:text-foreground"
                    onClick={() => {
                      setWeek(week);
                      setSelected("");
                    }}
                  >
                    Settimana {week}
                  </button>
                ))}
              </div>
            )}
            <div
              role="group"
              aria-label="Sessioni della settimana"
              className="student-session-picker mt-2 flex gap-2 overflow-x-auto p-1"
            >
              {sessions.map((s, index) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === session?.id}
                  onClick={() => setSelected(s.id)}
                  className="flex min-h-[60px] w-[calc((100%-1rem)/3)] min-w-25 max-w-48 shrink-0 items-center gap-2 rounded-2xl border bg-card px-2 py-2 sm:gap-2.5 sm:px-3 text-left transition-colors hover:border-input aria-pressed:border-[var(--border-hover)] aria-pressed:bg-muted"
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full sm:size-8",
                      s.id === session?.id
                        ? "bg-background text-[var(--workspace-accent)]"
                        : "bg-muted text-[var(--workspace-accent)]",
                    )}
                  >
                    {completedIds.has(s.id) ? (
                      <Check className="size-4" aria-label="Completato" />
                    ) : (
                      <MovementIcon run={s.kind === "run"} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs leading-4 text-muted-foreground">
                      {s.day || `Sessione ${index + 1}`}
                    </span>
                    <span className="block text-sm leading-4 font-semibold break-words">
                      {s.name}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {session && (
            <article
              key={session.id}
              className="min-w-0 overflow-hidden rounded-3xl border bg-card motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
            >
              <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b p-4 sm:p-6">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {session.kind === "run" ? "Corsa" : "Allenamento"}
                    {session.day && ` · ${session.day}`}
                    {entry?.completed && (
                      <span className="text-[var(--workspace-accent)]">
                        {" "}
                        · Completato
                      </span>
                    )}
                  </p>
                  <h3 className="text-pretty text-2xl leading-tight font-bold tracking-[-0.04em] break-words sm:text-[1.8rem]">
                    {session.name}
                  </h3>
                </div>
                {onSave && session.exercises.length > 0 && (
                  <Button
                    size="lg"
                    className="w-full justify-start rounded-full font-semibold sm:w-auto"
                    ref={startButton}
                    onClick={() => setGuide(true)}
                  >
                    {entry?.completed ? <RotateCcw /> : <Play />}
                    {entry?.completed
                      ? "Ripeti allenamento"
                      : "Inizia allenamento"}
                    <ArrowRight className="ml-auto size-4 sm:ml-2" />
                  </Button>
                )}
              </header>
              <div className="space-y-4 p-4 sm:p-6">
                <SessionCopy
                  title="Indicazioni del coach"
                  text={session.guidance}
                />
                <SessionCopy title="Riscaldamento" text={session.preparation} />
                <div>
                  <h4 className="mb-2 text-base font-semibold">
                    {session.kind === "run" ? "Blocchi di corsa" : "Esercizi"}
                  </h4>
                  <ol className="divide-y overflow-hidden rounded-2xl border bg-background">
                    {session.exercises.map((exercise, index) => (
                      <li
                        key={exercise.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-3.5 sm:px-4 sm:py-4"
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums"
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h5 className="text-[15px] leading-snug font-semibold break-words">
                            {exercise.name}
                          </h5>
                          <p className="mt-0.5 text-sm font-semibold break-words text-foreground tabular-nums">
                            {exercise.sets > 1 ? `${exercise.sets} × ` : ""}
                            {exercise.reps}
                          </p>
                          {exercise.notes && (
                            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed break-words text-muted-foreground">
                              {exercise.notes}
                            </p>
                          )}
                          {exercise.restSeconds > 0 && (
                            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                              <Timer className="size-3" aria-hidden />
                              Recupero {secondsLabel(exercise.restSeconds)}
                            </span>
                          )}
                          <LoggedSets
                            log={entry?.exercises?.find(
                              (l) => l.exerciseId === exercise.id,
                            )}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                <RecoveryNote title="Defaticamento" text={session.cooldown} />
                {entry?.notes && (
                  <SessionCopy title="Le tue note" text={entry.notes} />
                )}
              </div>
            </article>
          )}
        </div>
        {(plan.description || plan.program) && (
          <aside
            className="min-w-0 space-y-4"
            aria-label="Informazioni sul programma"
          >
            {plan.description && (
              <CoachNote text={plan.description} coach={coach} />
            )}
            {plan.program && <ProgramReference program={plan.program} />}
          </aside>
        )}
      </div>
      {guide && session && onSave && (
        <WorkoutGuide
          key={session.id}
          assignment={assignment}
          session={session}
          entry={entry}
          history={history}
          save={onSave}
          close={() => setGuide(false)}
          returnFocus={() => startButton.current?.focus()}
        />
      )}
    </section>
  );
}
