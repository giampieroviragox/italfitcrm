"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { Copy, History, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time-picker";
import { formatDate, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  PlanAssignment,
  WorkoutEntry,
  WorkoutExercise,
} from "./fitness-model";
import { normalize } from "./model";
import { Field, FormError, control } from "./ui";
import {
  currentMaxes,
  formatKg,
  loggedSessions,
  maxRepetitions,
  maxSetsPerExercise,
  rpeLabels,
  setLabel,
  type ExerciseLog,
  type MaxCommand,
  type MaxRecord,
  type SetLog,
} from "./workout-log";

/** Text fields while typing; converted to numbers on save. */
export type SetDraft = { reps: string; kg: string };
export type LogDraft = Record<string, SetDraft[]>;

export function initialDraft(
  exercises: WorkoutExercise[],
  saved?: ExerciseLog[],
): LogDraft {
  return Object.fromEntries(
    exercises.map((exercise) => {
      const log = saved?.find((l) => l.exerciseId === exercise.id);
      const sets = log?.sets.length
        ? log.sets.map((s) => ({
            reps: s.reps === undefined ? "" : String(s.reps),
            kg: s.kg === undefined ? "" : String(s.kg),
          }))
        : Array.from(
            {
              length: Math.min(Math.max(exercise.sets, 1), maxSetsPerExercise),
            },
            () => ({ reps: "", kg: "" }),
          );
      return [exercise.id, sets];
    }),
  );
}

const number = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
};
/** Only filled sets are kept; rejects values outside the allowed range. */
export function draftToLogs(draft: LogDraft): ExerciseLog[] {
  return Object.entries(draft).flatMap(([exerciseId, sets]) => {
    const filled = sets.flatMap((set): SetLog[] => {
      const reps = number(set.reps),
        kg = number(set.kg);
      if (reps === undefined && kg === undefined) return [];
      if (
        reps !== undefined &&
        (!Number.isInteger(reps) || reps < 0 || reps > 1000)
      )
        throw new Error("Le ripetizioni devono essere un numero intero.");
      if (kg !== undefined && (kg < 0 || kg > 1000))
        throw new Error("Il carico deve essere tra 0 e 1000 kg.");
      return [
        {
          ...(reps !== undefined ? { reps } : {}),
          ...(kg !== undefined ? { kg } : {}),
        },
      ];
    });
    return filled.length ? [{ exerciseId, sets: filled }] : [];
  });
}

export function SetLogger({
  exercise,
  sets,
  onChange,
  last,
}: {
  exercise: WorkoutExercise;
  sets: SetDraft[];
  onChange: (sets: SetDraft[]) => void;
  last?: { date: string; sets: SetLog[] };
}) {
  const id = useId();
  const update = (index: number, patch: Partial<SetDraft>) =>
    onChange(sets.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const first = sets[0];
  const canCopy =
    first &&
    (first.reps || first.kg) &&
    sets.slice(1).some((s) => !s.reps && !s.kg);
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-1 flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold">Cosa hai fatto</span>
        {last && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <History className="size-3" aria-hidden />
            Ultima volta ({formatDate(last.date)}):{" "}
            {last.sets.map(setLabel).join(" · ")}
          </span>
        )}
      </legend>
      <div
        className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-2"
        role="group"
        aria-label={`Serie di ${exercise.name}`}
      >
        <span className="text-xs text-muted-foreground" aria-hidden />
        <span className="text-xs text-muted-foreground" id={`${id}-reps`}>
          Ripetizioni
        </span>
        <span className="text-xs text-muted-foreground" id={`${id}-kg`}>
          Carico (kg)
        </span>
        {sets.map((set, index) => (
          <SetRow
            key={index}
            index={index}
            set={set}
            prescribed={exercise.reps}
            previous={sets[index - 1]}
            onChange={(patch) => update(index, patch)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sets.length >= maxSetsPerExercise}
          onClick={() =>
            onChange([...sets, { ...(sets.at(-1) ?? { reps: "", kg: "" }) }])
          }
        >
          <Plus className="size-4" /> Serie
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sets.length <= 1}
          onClick={() => onChange(sets.slice(0, -1))}
        >
          <Minus className="size-4" /> Serie
        </Button>
        {canCopy && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange(
                sets.map((s, i) =>
                  i > 0 && !s.reps && !s.kg ? { ...first } : s,
                ),
              )
            }
          >
            <Copy className="size-4" /> Uguali alla prima
          </Button>
        )}
      </div>
    </fieldset>
  );
}

function SetRow({
  index,
  set,
  prescribed,
  previous,
  onChange,
}: {
  index: number;
  set: SetDraft;
  prescribed: string;
  previous?: SetDraft;
  onChange: (patch: Partial<SetDraft>) => void;
}) {
  const repsHint = /^\d+$/.test(prescribed.trim()) ? prescribed.trim() : "";
  return (
    <>
      <span className="w-14 text-sm font-medium tabular-nums">
        Serie {index + 1}
      </span>
      <input
        aria-label={`Serie ${index + 1}, ripetizioni`}
        className={`${control} text-base tabular-nums sm:text-sm`}
        inputMode="numeric"
        maxLength={4}
        placeholder={previous?.reps || repsHint || "—"}
        value={set.reps}
        onChange={(e) => onChange({ reps: e.target.value.replace(/\D/g, "") })}
      />
      <input
        aria-label={`Serie ${index + 1}, carico in chilogrammi`}
        className={`${control} text-base tabular-nums sm:text-sm`}
        inputMode="decimal"
        maxLength={7}
        placeholder={previous?.kg || "—"}
        value={set.kg}
        onChange={(e) =>
          onChange({ kg: e.target.value.replace(/[^\d.,]/g, "") })
        }
      />
    </>
  );
}

export function RpePicker({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium" id="rpe-label">
          Fatica percepita (RPE)
        </span>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {value ? `${value} · ${rpeLabels[value]}` : "Facoltativa"}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="rpe-label"
        className="grid grid-cols-10 gap-1"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}, ${rpeLabels[n]}`}
            onClick={() => onChange(value === n ? undefined : n)}
            className={cn(
              "h-10 rounded-lg border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoggedSets({ log }: { log?: ExerciseLog }) {
  if (!log?.sets.length) return null;
  return (
    <p className="mt-2 text-sm text-[var(--workspace-accent)] tabular-nums">
      Fatto: {log.sets.map(setLabel).join(" · ")}
    </p>
  );
}

/** Completed sessions with sets, effort and notes; optional exercise filter. */
export function WorkoutHistory({
  assignments,
  entries,
  emptyText = "Nessun allenamento registrato. Completa una sessione dal tuo piano per vederla qui.",
}: {
  assignments: PlanAssignment[];
  entries: WorkoutEntry[];
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const history = useMemo(
    () => loggedSessions(assignments, entries),
    [assignments, entries],
  );
  const q = normalize(query);
  const visible = q
    ? history.filter(
        (item) =>
          normalize(item.session.name).includes(q) ||
          item.session.exercises.some((e) => normalize(e.name).includes(q)),
      )
    : history;
  return (
    <section aria-labelledby="storico-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="storico-title" className="text-xl font-bold tracking-tight">
            Storico allenamenti
          </h2>
          <p className="text-sm text-muted-foreground">
            {history.length}{" "}
            {history.length === 1
              ? "sessione completata"
              : "sessioni completate"}
          </p>
        </div>
        {history.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search
              className="absolute top-3 left-3 size-4 text-muted-foreground"
              aria-hidden
            />
            <input
              aria-label="Cerca un esercizio o una sessione"
              placeholder="Cerca un esercizio…"
              className={`${control} pl-9 text-base sm:text-sm`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
      </div>
      {!visible.length ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {history.length
            ? "Nessuna sessione con questo esercizio."
            : emptyText}
        </p>
      ) : (
        <ol className="space-y-3">
          {visible.map(({ entry, assignment, session, date }) => {
            const logs = (entry.exercises ?? []).flatMap((log) => {
              const exercise = session.exercises.find(
                (e) => e.id === log.exerciseId,
              );
              return exercise &&
                (!q ||
                  normalize(exercise.name).includes(q) ||
                  normalize(session.name).includes(q))
                ? [{ exercise, log }]
                : [];
            });
            return (
              <li
                key={`${entry.assignmentId}:${entry.sessionId}`}
                className="rounded-2xl border bg-card p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="font-semibold">{session.name}</h3>
                  <time
                    dateTime={date}
                    className="text-sm text-muted-foreground"
                  >
                    {formatDate(date)}
                  </time>
                </div>
                <p className="text-xs text-muted-foreground first-letter:uppercase">
                  {assignment.snapshot.title} · {formatMonth(assignment.month)}
                  {entry.rpe
                    ? ` · RPE ${entry.rpe} (${rpeLabels[entry.rpe]})`
                    : ""}
                </p>
                {logs.length > 0 && (
                  <dl className="mt-3 space-y-1.5 text-sm">
                    {logs.map(({ exercise, log }) => (
                      <div
                        key={exercise.id}
                        className="grid gap-x-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
                      >
                        <dt className="font-medium break-words">
                          {exercise.name}
                        </dt>
                        <dd className="text-muted-foreground tabular-nums">
                          {log.sets.map(setLabel).join(" · ")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {entry.notes && (
                  <p className="mt-3 whitespace-pre-line rounded-xl bg-muted px-3 py-2 text-sm leading-6">
                    {entry.notes}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Latest 1RM, 3RM and 5RM per exercise; students can add and remove records. */
export function MaxesPanel({
  maxes,
  exerciseNames,
  today,
  onCommand,
  staff = false,
}: {
  maxes: MaxRecord[];
  exerciseNames: string[];
  today: string;
  /** Returns an error message, or "" when saved. */
  onCommand?: (command: MaxCommand) => Promise<string>;
  /** Staff may remove every record; students only their own. */
  staff?: boolean;
}) {
  const listId = useId();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [exercise, setExercise] = useState("");
  const [reps, setReps] = useState<1 | 3 | 5>(1);
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(today);
  const [open, setOpen] = useState<string | null>(null);
  const groups = currentMaxes(maxes);
  const run = async (command: MaxCommand, after?: () => void) => {
    if (!onCommand || pending) return;
    setPending(true);
    setError("");
    try {
      const failure = await onCommand(command);
      if (failure) setError(failure);
      else after?.();
    } finally {
      setPending(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = number(kg);
    if (!exercise.trim() || value === undefined || value <= 0 || value > 1000) {
      setError("Inserisci esercizio e carico (fino a 1000 kg).");
      return;
    }
    void run(
      {
        action: "add",
        record: { exercise: exercise.trim(), reps, kg: value, date },
      },
      () => {
        setAdding(false);
        setExercise("");
        setKg("");
        setReps(1);
        setDate(today);
      },
    );
  };
  return (
    <section aria-labelledby="massimali-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="massimali-title" className="text-xl font-bold tracking-tight">
            Massimali
          </h2>
          <p className="text-sm text-muted-foreground">
            Il carico massimo per 1, 3 o 5 ripetizioni (1RM, 3RM, 5RM).
          </p>
        </div>
        {onCommand && !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Nuovo massimale
          </Button>
        )}
      </div>
      {adding && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-2xl border bg-card p-4"
          aria-busy={pending}
        >
          <FormError message={error} />
          <fieldset disabled={pending} className="space-y-3">
            <Field label="Esercizio">
              <input
                required
                list={listId}
                maxLength={100}
                className={`${control} text-base sm:text-sm`}
                placeholder="Es. Squat"
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
              />
            </Field>
            <datalist id={listId}>
              {exerciseNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <div
              role="radiogroup"
              aria-label="Tipo di massimale"
              className="grid grid-cols-3 gap-2"
            >
              {maxRepetitions.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={reps === n}
                  onClick={() => setReps(n)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    reps === n
                      ? "border-foreground bg-muted"
                      : "hover:bg-muted",
                  )}
                >
                  {n}RM
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Carico (kg)">
                <input
                  required
                  inputMode="decimal"
                  maxLength={7}
                  className={`${control} text-base tabular-nums sm:text-sm`}
                  value={kg}
                  onChange={(e) =>
                    setKg(e.target.value.replace(/[^\d.,]/g, ""))
                  }
                />
              </Field>
              <Field label="Data">
                <DatePicker
                  required
                  max={today}
                  value={date}
                  onChange={setDate}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                {pending ? "Salvataggio…" : "Salva massimale"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setError("");
                }}
              >
                Annulla
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {!adding && <FormError message={error} />}
      {groups.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {groups.map((group) => (
            <li key={group.exercise} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="font-semibold break-words">{group.exercise}</p>
                <dl className="flex gap-4 text-sm">
                  {maxRepetitions.map((n) => (
                    <div key={n} className="text-right">
                      <dt className="text-xs text-muted-foreground">{n}RM</dt>
                      <dd className="font-semibold tabular-nums">
                        {group.latest[n] ? formatKg(group.latest[n]!.kg) : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <button
                type="button"
                aria-expanded={open === group.exercise}
                className="mt-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() =>
                  setOpen(open === group.exercise ? null : group.exercise)
                }
              >
                {open === group.exercise
                  ? "Nascondi lo storico"
                  : `Storico (${group.history.length})`}
              </button>
              {open === group.exercise && (
                <ul className="mt-2 space-y-1 text-sm">
                  {group.history.map((record) => (
                    <li
                      key={record.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="tabular-nums">
                        {formatDate(record.date)} · {record.reps}RM ·{" "}
                        {formatKg(record.kg)}
                        {record.recordedBy && (
                          <span className="text-muted-foreground">
                            {" "}
                            · inserito da {record.recordedBy}
                          </span>
                        )}
                      </span>
                      {onCommand && (staff || !record.recordedBy) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          aria-label={`Elimina ${record.reps}RM del ${formatDate(record.date)}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Eliminare questo massimale dallo storico?",
                              )
                            )
                              void run({ action: "remove", id: record.id });
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !adding && (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nessun massimale registrato.
          </p>
        )
      )}
    </section>
  );
}
