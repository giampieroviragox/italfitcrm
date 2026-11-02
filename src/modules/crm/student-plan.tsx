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
import {
  pageTabActive,
  pageTabIdle,
  pageTabItem,
  pageTabList,
} from "@/components/ui/page-tabs";
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
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted p-4">
      <div>
        <p className="text-xs text-muted-foreground">Recupero</p>
        <p
          className="mt-1 text-2xl font-medium tabular-nums"
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
    <details className="group rounded-xl border bg-background px-4 py-3.5" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
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
  save,
  close,
  returnFocus,
}: {
  assignment: PlanAssignment;
  session: WorkoutSession;
  entry?: WorkoutEntry;
  save: (input: WorkoutInput) => Promise<boolean>;
  close: () => void;
  returnFocus: () => void;
}) {
  const [index, setIndex] = useState(0),
    [done, setDone] = useState(false),
    [notes, setNotes] = useState(entry?.notes ?? ""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  const exercise = session.exercises[index];
  const dirty = notes !== (entry?.notes ?? "");
  const leave = () => {
    if (
      !pending &&
      (!dirty ||
        window.confirm(
          "Le note non sono ancora salvate. Vuoi uscire dall’allenamento?",
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
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
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
          <SheetTitle>{session.name}</SheetTitle>
          <SheetDescription>
            {done
              ? "Un passo in più verso il tuo obiettivo."
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
              <div className="mb-6 h-1 overflow-hidden rounded-full bg-foreground/[.06]">
                <div
                  className="h-full bg-foreground transition-all"
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
              <div className="rounded-2xl border p-5 sm:p-6">
                <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-foreground/[.045]">
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
                <h3 className="mt-1 text-2xl font-medium tracking-[-0.02em]">
                  {exercise.name}
                </h3>
                <p className="mt-3 text-lg font-medium tabular-nums">
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
                  className="flex-1"
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
              <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <Check className="size-6" />
              </div>
              <h3 className="text-2xl font-medium tracking-[-0.02em]">
                Ben fatto
              </h3>
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
              <Field
                label="Le tue note"
                hint="Carichi, ripetizioni, RPE, tempi e sensazioni."
              >
                <textarea
                  className={`${control} text-base sm:text-sm`}
                  rows={6}
                  maxLength={5000}
                  placeholder="Come ti sei sentita?"
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
                className="mt-3 w-full"
                disabled={pending}
                onClick={async () => {
                  if (submitting.current) return;
                  submitting.current = true;
                  setPending(true);
                  setError("");
                  try {
                    if (
                      await save({
                        assignmentId: assignment.id,
                        assignmentCreatedAt: assignment.createdAt,
                        sessionId: session.id,
                        completed: true,
                        notes,
                      })
                    )
                      close();
                    else
                      setError(
                        "Salvataggio non riuscito. Le note sono ancora qui: riprova.",
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
}: {
  assignment: PlanAssignment;
  entries?: WorkoutEntry[];
  coach?: StudentCoach;
  onSave?: (input: WorkoutInput) => Promise<boolean>;
}) {
  const { snapshot: plan } = assignment;
  const startButton = useRef<HTMLButtonElement>(null);
  const weeks = Array.from(new Set(plan.sessions.map((s) => s.week ?? 1))).sort(
    (a, b) => a - b,
  );
  const [selectedWeek, setWeek] = useState(weeks[0] ?? 1),
    [selectedId, setSelected] = useState(""),
    [guide, setGuide] = useState(false);
  const sessions = plan.sessions.filter((s) => (s.week ?? 1) === selectedWeek);
  const session = sessions.find((s) => s.id === selectedId) ?? sessions[0];
  const ownEntries = entries.filter(
    (e) =>
      e.assignmentId === assignment.id &&
      e.assignmentCreatedAt === assignment.createdAt,
  );
  const completed = plan.sessions.filter((s) =>
    ownEntries.some((e) => e.sessionId === s.id && e.completed),
  ).length;
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
    <section aria-label="Il tuo piano" className="min-w-0 space-y-6 pb-6">
      <div className="rounded-2xl border p-5 sm:p-6">
        <p className="text-[13px] text-muted-foreground first-letter:uppercase">
          {formatMonth(assignment.month)}
          {plan.program &&
            ` · ${period(plan.program.startsOn)} – ${period(plan.program.endsOn)}`}
        </p>
        <h2 className="mt-1 text-2xl leading-8 font-medium tracking-[-0.02em] sm:text-[28px] sm:leading-9">
          {plan.title}
        </h2>
        {plan.program?.goal && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {plan.program.goal}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-medium">
          <span className="rounded-full bg-foreground/[.045] px-2.5 py-1">
            {weeks.length > 1
              ? `${weeks.length} settimane`
              : `${sessions.length} sessioni`}
          </span>
          {weeks.length > 1 && (
            <span className="rounded-full bg-foreground/[.045] px-2.5 py-1">
              {sessions.length} allenamenti / settimana
            </span>
          )}
        </div>
        {onSave && (
          <div className="mt-5 border-t pt-4">
            <div className="mb-2 flex items-center justify-between text-[13px] text-muted-foreground">
              <span>
                {completed} di {plan.sessions.length} allenamenti completati
              </span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-foreground/[.06]"
              role="progressbar"
              aria-label="Avanzamento del programma"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {plan.description && <CoachNote text={plan.description} coach={coach} />}
      {weeks.length > 1 && (
        <div className={pageTabList} aria-label="Settimane del programma">
          {weeks.map((week) => (
            <button
              key={week}
              type="button"
              aria-pressed={selectedWeek === week}
              aria-label={`Settimana ${week}`}
              className={cn(
                pageTabItem,
                selectedWeek === week ? pageTabActive : pageTabIdle,
              )}
              onClick={() => {
                setWeek(week);
                setSelected("");
              }}
            >
              <span className="sm:hidden">Sett.</span>
              <span className="hidden sm:inline">Settimana</span> {week}
            </button>
          ))}
        </div>
      )}
      {session && (
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Allenamenti
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-col lg:gap-1">
              {sessions.map((s, i) => {
                const selected = s.id === session.id,
                  finished = ownEntries.some(
                    (e) => e.sessionId === s.id && e.completed,
                  );
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      "flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors lg:rounded-[10px] lg:border-transparent lg:px-2 lg:py-2",
                      selected
                        ? "border-input bg-foreground/[.045] lg:border-transparent"
                        : "hover:bg-foreground/[.03]",
                    )}
                    onClick={() => setSelected(s.id)}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        finished
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : selected
                            ? "bg-background"
                            : "bg-foreground/[.045]",
                      )}
                    >
                      {finished ? (
                        <Check className="size-4" />
                      ) : (
                        <MovementIcon run={s.kind === "run"} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.day || `Sessione ${i + 1}`}
                      </span>
                      <span className="block text-sm leading-5 font-medium">
                        {s.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-[13px] text-muted-foreground">
                {session.day || "Allenamento"}
                {weeks.length > 1 ? ` · Settimana ${selectedWeek}` : ""}
              </p>
              <h3 className="text-xl leading-7 font-medium tracking-[-0.02em]">
                {session.name}
              </h3>
              <p className="text-[13px] text-muted-foreground">
                {session.exercises.length}{" "}
                {session.kind === "run" ? "blocchi di lavoro" : "esercizi"}
                {entry?.completed ? " · Completato" : ""}
              </p>
            </div>
            {session.guidance && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-6">
                {session.guidance}
              </p>
            )}
            <SessionCopy title="Riscaldamento" text={session.preparation} />
            <div className="overflow-hidden rounded-xl border">
              <div className="border-b px-4 py-3 text-sm font-medium">
                Il lavoro di oggi
              </div>
              <ol className="divide-y">
                {session.exercises.map((ex, i) => (
                  <li key={ex.id} className="px-4 py-4">
                    <div className="flex gap-3">
                      <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium">{ex.name}</h4>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <p className="text-base font-medium tabular-nums">
                            {ex.sets > 1 ? `${ex.sets} × ` : ""}
                            {ex.reps}
                          </p>
                          {ex.restSeconds > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Timer className="size-3" />
                              Recupero {secondsLabel(ex.restSeconds)}
                            </span>
                          )}
                        </div>
                        {ex.notes && (
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                            {ex.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <RecoveryNote title="Defaticamento" text={session.cooldown} />
            {entry?.notes && (
              <div className="rounded-xl border px-4 py-3.5">
                <h4 className="text-sm font-medium">Le tue note</h4>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {entry.notes}
                </p>
              </div>
            )}
            {onSave && (
              <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 bg-background/90 px-1 pt-3 pb-3 backdrop-blur sm:bottom-0 sm:pb-[max(.75rem,env(safe-area-inset-bottom))]">
                <Button
                  size="lg"
                  className="w-full"
                  ref={startButton}
                  onClick={() => setGuide(true)}
                >
                  {entry?.completed ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {entry?.completed
                    ? "Ripeti allenamento"
                    : "Inizia allenamento"}
                  <ArrowRight className="ml-auto size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      {plan.program && <ProgramReference program={plan.program} />}
      {guide && session && onSave && (
        <WorkoutGuide
          key={session.id}
          assignment={assignment}
          session={session}
          entry={entry}
          save={onSave}
          close={() => setGuide(false)}
          returnFocus={() => startButton.current?.focus()}
        />
      )}
    </section>
  );
}
