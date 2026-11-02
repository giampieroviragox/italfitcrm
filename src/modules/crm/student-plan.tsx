"use client";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowUpRight,
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

function MovementIllustration({ run = false }: { run?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="size-full"
    >
      <circle
        cx="60"
        cy="60"
        r="51"
        stroke="currentColor"
        strokeOpacity=".12"
      />
      <path d="M15 91h90" stroke="currentColor" strokeOpacity=".15" />
      {run ? (
        <g
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="73" cy="26" r="7" fill="currentColor" stroke="none" />
          <path d="m67 42-14 20 18 11-7 23M55 59 40 76 24 72M65 44l15 13 17-4M61 46 44 43l-9 14" />
          <path d="M15 39h15M12 50h12" strokeWidth="2" opacity=".35" />
        </g>
      ) : (
        <g
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="60" cy="29" r="7" fill="currentColor" stroke="none" />
          <path d="M60 44v25M44 52h32M60 69 43 86v13M60 69l17 17v13M44 52l-7-12M76 52l7-12" />
          <path
            d="M25 39h70M29 31v16M35 29v20M85 29v20M91 31v16"
            strokeWidth="3"
          />
        </g>
      )}
    </svg>
  );
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
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#eef2eb] p-4">
      <div>
        <p className="text-xs text-[#53604d]">Recupero</p>
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
    <details
      className="group rounded-2xl border border-black/8 bg-white p-5"
      open={title === "Riscaldamento"}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
        {title}
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">
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
        <SheetHeader className="border-b p-6 pr-16">
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
          className="absolute top-5 right-4"
          aria-label="Chiudi allenamento"
          disabled={pending}
          onClick={leave}
        >
          <X />
        </Button>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8f9f6] p-6 pb-10">
          {!done && exercise ? (
            <>
              <div className="mb-7 h-1 overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full bg-[#627655] transition-all"
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
              <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
                <div className="mx-auto mb-7 size-36 rounded-full bg-[#edf1e8] p-3 text-[#536348]">
                  <MovementIllustration run={session.kind === "run"} />
                </div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {session.kind === "run"
                    ? "Lavoro di corsa"
                    : `Esercizio ${index + 1}`}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                  {exercise.name}
                </h3>
                <p className="mt-4 text-xl font-medium">
                  {exercise.sets > 1 ? `${exercise.sets} × ` : ""}
                  {exercise.reps}
                </p>
                {exercise.notes && (
                  <p className="mt-5 whitespace-pre-line text-sm leading-7 text-muted-foreground">
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
              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  disabled={index === 0}
                  aria-label="Passaggio precedente"
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  className="h-12 flex-1 rounded-xl"
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
              <div className="mb-7 flex size-16 items-center justify-center rounded-full bg-[#e8eedf] text-[#536348]">
                <Check className="size-7" />
              </div>
              <h3 className="text-3xl font-semibold tracking-tight">
                Ben fatto.
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Prenditi il tempo per defaticare e annotare come è andata. Poi
                salva la sessione.
              </p>
              <div className="my-6 space-y-4">
                <SessionCopy title="Defaticamento" text={session.cooldown} />
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
                  className={control}
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
                className="mt-3 h-12 w-full rounded-xl"
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
}: {
  assignment: PlanAssignment;
  entries?: WorkoutEntry[];
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
    <section aria-label="Il tuo piano" className="space-y-7 pb-6">
      <div className="relative overflow-hidden rounded-[28px] bg-[#e9eedf] p-6 sm:p-9">
        <div className="relative z-10 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#536348]">
            Il tuo programma · {formatMonth(assignment.month)}
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">
            {plan.title}
          </h2>
          {plan.program?.goal && (
            <p className="mt-3 text-base text-[#46513e]">{plan.program.goal}</p>
          )}
          <div className="mt-7 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/70 px-3 py-2">
              {weeks.length > 1
                ? `${weeks.length} settimane`
                : `${sessions.length} sessioni`}
            </span>
            {weeks.length > 1 && (
              <span className="rounded-full bg-white/70 px-3 py-2">
                {sessions.length} allenamenti / settimana
              </span>
            )}
            {plan.program && (
              <span className="rounded-full bg-white/70 px-3 py-2">
                {period(plan.program.startsOn)} – {period(plan.program.endsOn)}{" "}
                {plan.program.endsOn.slice(0, 4)}
              </span>
            )}
          </div>
        </div>
        <svg
          viewBox="0 0 300 230"
          aria-hidden="true"
          fill="none"
          className="pointer-events-none absolute -right-14 -bottom-12 hidden h-72 text-[#a8b895] opacity-45 sm:block"
        >
          <path
            d="M170 20c-100 0-160 180-60 180S320 20 220 20 60 200 160 200"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M190 35C90 35 30 215 130 215S340 35 240 35 80 215 180 215"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        {onSave && (
          <div className="relative mt-8 max-w-xl border-t border-[#536348]/15 pt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-[#46513e]">
              <span>
                {completed} di {plan.sessions.length} allenamenti completati
              </span>
              <span>{percent}%</span>
            </div>
            <div
              className="h-1 overflow-hidden rounded-full bg-[#536348]/10"
              role="progressbar"
              aria-label="Avanzamento del programma"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-[#536348] transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {plan.description && (
        <details className="border-b border-black/8 pb-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
            Due parole dal coach
            <ArrowUpRight className="size-4" />
          </summary>
          <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted-foreground">
            {plan.description}
          </p>
        </details>
      )}
      {weeks.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label="Settimane del programma"
        >
          {weeks.map((week) => (
            <button
              key={week}
              type="button"
              aria-pressed={selectedWeek === week}
              className={`shrink-0 rounded-full px-5 py-3 text-sm font-medium transition-colors ${selectedWeek === week ? "bg-[#253328] text-white" : "bg-white text-muted-foreground hover:bg-[#e9eedf]"}`}
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
      {session && (
        <div className="grid items-start gap-6 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-8">
          <div>
            <h3 className="mb-4 text-lg font-semibold tracking-tight">
              I tuoi allenamenti
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
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
                    className={`flex min-w-64 flex-1 items-center gap-3 rounded-2xl border p-4 text-left transition-colors lg:min-w-0 ${selected ? "border-[#a8b895] bg-[#edf1e7]" : "border-black/7 bg-white hover:border-[#a8b895]"}`}
                    onClick={() => setSelected(s.id)}
                  >
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${selected ? "bg-white" : "bg-[#f4f5f0]"}`}
                    >
                      {finished ? (
                        <Check className="size-4 text-[#536348]" />
                      ) : s.kind === "run" ? (
                        <Footprints className="size-4" />
                      ) : (
                        <Dumbbell className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {s.day || `Sessione ${i + 1}`}
                      </span>
                      <span className="mt-1 block text-sm font-medium">
                        {s.name}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="flex items-center gap-5 rounded-3xl bg-white p-5 sm:p-6">
              <div className="size-24 shrink-0 rounded-2xl bg-[#f2f4ec] p-1 text-[#627655] sm:size-28">
                <MovementIllustration run={session.kind === "run"} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {session.day || "Allenamento"}
                  {weeks.length > 1 ? ` · Settimana ${selectedWeek}` : ""}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                  {session.name}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  {session.exercises.length}{" "}
                  {session.kind === "run" ? "blocchi di lavoro" : "esercizi"}
                  {entry?.completed ? " · Completato" : ""}
                </p>
              </div>
            </div>
            {session.guidance && (
              <p className="rounded-2xl bg-[#edf1e7] px-5 py-4 text-sm leading-6 text-[#46513e]">
                {session.guidance}
              </p>
            )}
            <SessionCopy title="Riscaldamento" text={session.preparation} />
            <div className="overflow-hidden rounded-2xl border border-black/8 bg-white">
              <div className="border-b border-black/6 px-5 py-4 text-sm font-medium">
                Il lavoro di oggi
              </div>
              <ol className="divide-y divide-black/6">
                {session.exercises.map((ex, i) => (
                  <li key={ex.id} className="px-5 py-5">
                    <div className="flex gap-4">
                      <span className="pt-1 text-[11px] tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium">{ex.name}</h4>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <p className="text-base font-medium tracking-tight">
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
                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                            {ex.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <SessionCopy title="Defaticamento" text={session.cooldown} />
            {entry?.notes && (
              <div className="rounded-2xl border bg-white p-5">
                <h4 className="text-sm font-medium">Le tue note</h4>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {entry.notes}
                </p>
              </div>
            )}
            {onSave && (
              <div className="sticky bottom-0 -mx-2 bg-[#f8f9f6]/95 px-2 py-4 backdrop-blur">
                <Button
                  className="h-13 w-full rounded-2xl text-sm"
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
      {plan.program && (
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          {plan.program.paceZones.length > 0 && (
            <details className="rounded-2xl border border-black/8 bg-white p-5">
              <summary className="cursor-pointer text-sm font-medium">
                Le tue zone di passo
              </summary>
              <dl className="mt-5 divide-y divide-black/6">
                {plan.program.paceZones.map((z) => (
                  <div
                    key={z.name}
                    className="flex justify-between gap-3 py-3 text-sm"
                  >
                    <dt className="text-muted-foreground">{z.name}</dt>
                    <dd className="font-medium tabular-nums">{z.pace}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          <SessionCopy
            title="Indicazioni per il blocco"
            text={plan.program.guidance}
          />
        </div>
      )}
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
