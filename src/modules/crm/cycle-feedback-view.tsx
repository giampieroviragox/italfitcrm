"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Flag,
  Frown,
  Laugh,
  MapPin,
  Meh,
  Minus,
  Pencil,
  Plus,
  Smile,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";
import { assignmentPeriod, formatDay, periodLabel } from "./plan-cycles";
import { cn } from "@/lib/utils";
import type { PlanAssignment } from "./fitness-model";
import {
  daysUntil,
  overallRatings,
  planEndDate,
  plannedSessionsPerWeek,
  sessionLengths,
  upcomingRaces,
  type CycleFeedback,
  type FeedbackCommand,
  type Race,
  type RaceCommand,
  type RaceInput,
} from "./cycle-feedback";
import { Field, FormError, control } from "./ui";

const ratingIcons = { 1: Frown, 2: Meh, 3: Smile, 4: SmilePlus, 5: Laugh };
const raceDate = (r: Pick<Race, "date">) => formatDate(r.date);
const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Invitation shown on the home and plan pages while a questionnaire is due. */
export function FeedbackPrompt({
  assignment,
  onOpen,
}: {
  assignment: PlanAssignment;
  onOpen: () => void;
}) {
  return (
    <section className="mb-5 flex flex-wrap items-center gap-4 rounded-3xl border border-primary/40 bg-card p-5 sm:p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-[var(--workspace-accent)]">
        <ClipboardCheck className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          Fine piano · {formatDay(planEndDate(assignment))}
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          Com’è andato “{assignment.snapshot.title}”?
        </h2>
        <p className="text-sm text-muted-foreground">
          Due minuti per aiutare il coach a preparare il prossimo piano.
        </p>
      </div>
      <Button
        size="lg"
        className="w-full rounded-full sm:w-auto"
        onClick={onOpen}
      >
        Compila il questionario
        <ArrowRight className="size-4" />
      </Button>
    </section>
  );
}

type Step = "rating" | "sessions" | "races" | "notes" | "review" | "done";
const steps: Exclude<Step, "done">[] = [
  "rating",
  "sessions",
  "races",
  "notes",
  "review",
];
const stepTitles: Record<Exclude<Step, "done">, string> = {
  rating: "Com’è andato il piano?",
  sessions: "Le sessioni",
  races: "Le tue gare",
  notes: "Ultime note",
  review: "Riepilogo",
};

function ChoiceCard({
  selected,
  onClick,
  children,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        selected
          ? "border-primary bg-primary/15"
          : "bg-card hover:border-input hover:bg-muted",
      )}
    >
      {children}
      {selected && (
        <Check
          className="ml-auto size-5 text-[var(--workspace-accent)]"
          aria-hidden
        />
      )}
    </button>
  );
}

function RaceForm({
  initial,
  today,
  submitLabel,
  onSubmit,
  onCancel,
  allowPast = false,
}: {
  initial?: RaceInput;
  today: string;
  submitLabel: string;
  onSubmit: (race: RaceInput) => void | Promise<void>;
  onCancel: () => void;
  allowPast?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!name.trim() || !date) {
      setError("Inserisci almeno nome e data della gara.");
      return;
    }
    if (!allowPast && date < today) {
      setError("La data della gara deve essere oggi o nel futuro.");
      return;
    }
    void onSubmit({
      name: name.trim(),
      date,
      location: location.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };
  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border bg-card p-4"
    >
      <FormError message={error} />
      <Field label="Nome della gara">
        <input
          className={`${control} text-base sm:text-sm`}
          maxLength={120}
          placeholder="Es. HYROX Milano · Doppio misto"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Data">
          <DatePicker
            value={date}
            min={allowPast ? undefined : today}
            onChange={setDate}
          />
        </Field>
        <Field label="Luogo">
          <input
            className={`${control} text-base sm:text-sm`}
            maxLength={120}
            placeholder="Es. Fiera Milano, Rho"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Note (facoltative)">
        <input
          className={`${control} text-base sm:text-sm`}
          maxLength={500}
          placeholder="Distanza, categoria, obiettivo…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </form>
  );
}

function RaceLine({
  race,
  today,
}: {
  race: RaceInput & { addedBy?: string };
  today: string;
}) {
  const days = daysUntil(today, race.date);
  return (
    <div className="min-w-0">
      <p className="font-semibold break-words">{race.name}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          {raceDate(race)}
          {days >= 0 &&
            ` · ${days === 0 ? "oggi" : days === 1 ? "domani" : `tra ${days} giorni`}`}
        </span>
        {race.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {race.location}
          </span>
        )}
      </p>
      {race.notes && (
        <p className="text-sm text-muted-foreground">{race.notes}</p>
      )}
      {race.addedBy && (
        <p className="text-xs text-muted-foreground">
          Inserita da {race.addedBy}
        </p>
      )}
    </div>
  );
}

/** Multi-step end-of-plan questionnaire. */
export function FeedbackWizard({
  assignment,
  races,
  today,
  existing,
  onSubmit,
  close,
}: {
  assignment: PlanAssignment;
  races: Race[];
  today: string;
  existing?: CycleFeedback;
  /** Returns an error message, or "" when saved. */
  onSubmit: (command: FeedbackCommand) => Promise<string>;
  close: () => void;
}) {
  const planned = plannedSessionsPerWeek(assignment);
  const upcoming = upcomingRaces(races, today);
  const [step, setStep] = useState<Step>("rating");
  const [rating, setRating] = useState<number | undefined>(existing?.rating);
  const [length, setLength] = useState<
    CycleFeedback["sessionLength"] | undefined
  >(existing?.sessionLength);
  const [perWeek, setPerWeek] = useState(existing?.sessionsPerWeek ?? planned);
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<RaceInput[]>([]);
  const [addingRace, setAddingRace] = useState(false);
  const [changes, setChanges] = useState(existing?.changes ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const index = step === "done" ? steps.length : steps.indexOf(step);
  const dirty =
    step !== "done" &&
    (rating !== existing?.rating ||
      length !== existing?.sessionLength ||
      removed.length > 0 ||
      added.length > 0 ||
      changes !== (existing?.changes ?? "") ||
      notes !== (existing?.notes ?? ""));
  const canContinue =
    step === "rating"
      ? rating !== undefined
      : step === "sessions"
        ? length !== undefined
        : step === "races"
          ? !addingRace
          : true;
  const leave = () => {
    if (
      pending ||
      (dirty &&
        !window.confirm(
          "Le risposte non sono ancora inviate. Vuoi chiudere il questionario?",
        ))
    )
      return;
    close();
  };
  const submit = async () => {
    if (lock.current || !rating || !length) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const failure = await onSubmit({
        assignmentId: assignment.id,
        assignmentCreatedAt: assignment.createdAt,
        rating,
        sessionLength: length,
        sessionsPerWeek: perWeek,
        changes,
        notes,
        removeRaces: removed,
        addRaces: added,
      });
      if (failure) setError(failure);
      else setStep("done");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const go = (delta: number) => {
    const next = steps[index + delta];
    if (next) setStep(next);
  };
  return (
    <Sheet open onOpenChange={(open) => !open && leave()}>
      <SheetContent
        className="student-area dark gap-0 bg-background data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          leave();
        }}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-b p-4 pr-14 sm:p-6 sm:pr-16">
          <SheetTitle className="text-xl font-semibold tracking-tight">
            Questionario di fine piano
          </SheetTitle>
          <SheetDescription className="first-letter:uppercase">
            {assignment.snapshot.title} · {periodLabel(assignment)}
          </SheetDescription>
        </SheetHeader>
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-3 right-3 size-11"
          aria-label="Chiudi il questionario"
          disabled={pending}
          onClick={leave}
        >
          <X />
        </Button>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6">
          {step !== "done" && (
            <div className="mb-6">
              <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
                <span>
                  Passo {index + 1} di {steps.length}
                </span>
                <span>{stepTitles[step]}</span>
              </div>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
                aria-hidden
              >
                {steps.map((s, i) => (
                  <span
                    key={s}
                    className={cn(
                      "h-1.5 rounded-full transition-colors",
                      i <= index ? "bg-primary" : "bg-muted",
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "rating" && (
            <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in-0">
              <h3 className="text-2xl font-bold tracking-tight">
                Com’è andato il piano?
              </h3>
              <p className="text-sm text-muted-foreground">
                Pensa alle quattro settimane appena concluse: allenamenti,
                energia, costanza.
              </p>
              <div
                role="radiogroup"
                aria-label="Com’è andato il piano"
                className="space-y-2"
              >
                {([5, 4, 3, 2, 1] as const).map((n) => {
                  const Icon = ratingIcons[n];
                  return (
                    <ChoiceCard
                      key={n}
                      label={overallRatings[n]}
                      selected={rating === n}
                      onClick={() => setRating(n)}
                    >
                      <Icon
                        className="size-6 text-[var(--workspace-accent)]"
                        aria-hidden
                      />
                      {overallRatings[n]}
                    </ChoiceCard>
                  );
                })}
              </div>
            </div>
          )}

          {step === "sessions" && (
            <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in-0">
              <div className="space-y-3">
                <h3 className="text-2xl font-bold tracking-tight">
                  La durata delle sessioni era…
                </h3>
                <div
                  role="radiogroup"
                  aria-label="Durata delle sessioni"
                  className="space-y-2"
                >
                  {(["right", "long", "short"] as const).map((key) => (
                    <ChoiceCard
                      key={key}
                      label={sessionLengths[key]}
                      selected={length === key}
                      onClick={() => setLength(key)}
                    >
                      {sessionLengths[key]}
                    </ChoiceCard>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold tracking-tight">
                  Quante sessioni a settimana nel prossimo piano?
                </h3>
                <p className="text-sm text-muted-foreground">
                  In questo piano erano {planned}. Confermi o vuoi cambiare? Ad
                  esempio se ti aspetta un mese impegnativo.
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    aria-label="Una sessione in meno"
                    disabled={perWeek <= 1}
                    onClick={() => setPerWeek((n) => n - 1)}
                  >
                    <Minus />
                  </Button>
                  <output
                    aria-live="polite"
                    aria-label="Sessioni a settimana"
                    className="min-w-16 text-center text-4xl font-bold tabular-nums"
                  >
                    {perWeek}
                  </output>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    aria-label="Una sessione in più"
                    disabled={perWeek >= 14}
                    onClick={() => setPerWeek((n) => n + 1)}
                  >
                    <Plus />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {perWeek === planned
                      ? "Confermato"
                      : perWeek < planned
                        ? `${planned - perWeek} in meno`
                        : `${perWeek - planned} in più`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === "races" && (
            <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in-0">
              <h3 className="text-2xl font-bold tracking-tight">Le tue gare</h3>
              <p className="text-sm text-muted-foreground">
                Conferma le gare in programma e aggiungi quelle a cui ti sei
                iscritto. Il coach ne terrà conto nel piano.
              </p>
              {upcoming.length > 0 ? (
                <ul className="space-y-2">
                  {upcoming.map((race) => {
                    const out = removed.includes(race.id);
                    return (
                      <li
                        key={race.id}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4",
                          out && "opacity-60",
                        )}
                      >
                        <RaceLine race={race} today={today} />
                        <div
                          role="radiogroup"
                          aria-label={`Partecipazione a ${race.name}`}
                          className="flex gap-1 rounded-full border p-1"
                        >
                          {[false, true].map((remove) => (
                            <button
                              key={String(remove)}
                              type="button"
                              role="radio"
                              aria-checked={out === remove}
                              onClick={() =>
                                setRemoved((list) =>
                                  remove
                                    ? [...new Set([...list, race.id])]
                                    : list.filter((id) => id !== race.id),
                                )
                              }
                              className={cn(
                                "h-9 rounded-full px-3 text-xs font-semibold transition-colors",
                                out === remove
                                  ? "bg-muted text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {remove ? "Non più" : "Confermata"}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nessuna gara in programma.
                </p>
              )}
              {added.length > 0 && (
                <ul className="space-y-2">
                  {added.map((race, i) => (
                    <li
                      key={`${race.name}-${i}`}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-primary/40 bg-card p-4"
                    >
                      <div>
                        <p className="mb-1 text-xs font-semibold text-[var(--workspace-accent)]">
                          Nuova
                        </p>
                        <RaceLine race={race} today={today} />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Togli ${race.name}`}
                        onClick={() =>
                          setAdded((list) => list.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {addingRace ? (
                <RaceForm
                  today={today}
                  submitLabel="Aggiungi"
                  onSubmit={(race) => {
                    setAdded((list) => [...list, race]);
                    setAddingRace(false);
                  }}
                  onCancel={() => setAddingRace(false)}
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full"
                  disabled={added.length >= 20}
                  onClick={() => setAddingRace(true)}
                >
                  <Flag className="size-4" />
                  Mi sono iscritto a una nuova gara
                </Button>
              )}
            </div>
          )}

          {step === "notes" && (
            <div className="space-y-5 motion-safe:animate-in motion-safe:fade-in-0">
              <h3 className="text-2xl font-bold tracking-tight">Ultime note</h3>
              <Field
                label="C’è qualcosa che vorresti cambiare nel prossimo piano?"
                hint="Esercizi, giorni, tipo di lavoro. Facoltativo."
              >
                <textarea
                  className={`${control} text-base sm:text-sm`}
                  rows={4}
                  maxLength={3000}
                  value={changes}
                  onChange={(e) => setChanges(e.target.value)}
                />
              </Field>
              <Field
                label="Altro da dire al coach?"
                hint="Come ti sei sentito, infortuni o fastidi, impegni in arrivo. Facoltativo."
              >
                <textarea
                  className={`${control} text-base sm:text-sm`}
                  rows={5}
                  maxLength={5000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </div>
          )}

          {step === "review" && rating && length && (
            <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in-0">
              <h3 className="text-2xl font-bold tracking-tight">
                Tutto giusto?
              </h3>
              <dl className="divide-y rounded-2xl border bg-card">
                {[
                  {
                    label: "Com’è andato",
                    value:
                      overallRatings[rating as keyof typeof overallRatings],
                    step: "rating" as const,
                  },
                  {
                    label: "Durata delle sessioni",
                    value: sessionLengths[length],
                    step: "sessions" as const,
                  },
                  {
                    label: "Sessioni a settimana",
                    value: String(perWeek),
                    step: "sessions" as const,
                  },
                  {
                    label: "Gare",
                    value: [
                      count(
                        upcoming.length - removed.length,
                        "confermata",
                        "confermate",
                      ),
                      ...(added.length
                        ? [count(added.length, "nuova", "nuove")]
                        : []),
                      ...(removed.length
                        ? [count(removed.length, "tolta", "tolte")]
                        : []),
                    ].join(" · "),
                    step: "races" as const,
                  },
                  {
                    label: "Da cambiare",
                    value: changes.trim() || "—",
                    step: "notes" as const,
                  },
                  {
                    label: "Altre note",
                    value: notes.trim() || "—",
                    step: "notes" as const,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="text-sm font-medium whitespace-pre-line break-words">
                        {row.value}
                      </dd>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifica: ${row.label}`}
                      onClick={() => setStep(row.step)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                ))}
              </dl>
              <FormError message={error} />
            </div>
          )}

          {step === "done" && (
            <div className="py-6 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
              <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-primary/15 text-[var(--workspace-accent)]">
                <Check className="size-8" />
              </span>
              <h3 className="text-2xl font-bold tracking-tight">Grazie!</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Le tue risposte sono arrivate al coach, che le userà per
                preparare il prossimo piano.
              </p>
              <Button className="mt-6 rounded-full" size="lg" onClick={close}>
                Chiudi
              </Button>
            </div>
          )}

          {step !== "done" && (
            <div className="mt-8 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Passo precedente"
                disabled={index === 0 || pending}
                onClick={() => go(-1)}
              >
                <ArrowLeft />
              </Button>
              {step === "review" ? (
                <Button
                  size="lg"
                  className="flex-1 rounded-full"
                  disabled={pending}
                  onClick={() => void submit()}
                >
                  {pending ? "Invio…" : "Invia al coach"}
                  <Check className="size-4" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="flex-1 rounded-full"
                  disabled={!canContinue}
                  onClick={() => go(1)}
                >
                  Avanti
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Upcoming and past races; students and staff can manage them. */
export function RacesPanel({
  races,
  today,
  onCommand,
  staff = false,
  title = "Gare ed eventi",
}: {
  races: Race[];
  today: string;
  /** Returns an error message, or "" when saved. */
  onCommand?: (command: RaceCommand) => Promise<string>;
  staff?: boolean;
  title?: string;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);
  const upcoming = upcomingRaces(races, today);
  const past = races
    .filter((r) => r.date < today)
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const run = async (command: RaceCommand) => {
    if (!onCommand || pending) return;
    setPending(true);
    setError("");
    try {
      const failure = await onCommand(command);
      if (failure) setError(failure);
      else setEditing(null);
    } finally {
      setPending(false);
    }
  };
  const row = (race: Race) =>
    editing === race.id ? (
      <li key={race.id}>
        <RaceForm
          initial={race}
          today={today}
          allowPast={staff}
          submitLabel="Salva"
          onSubmit={(input) =>
            run({ action: "update", id: race.id, race: input })
          }
          onCancel={() => setEditing(null)}
        />
      </li>
    ) : (
      <li
        key={race.id}
        className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-4"
      >
        <RaceLine race={race} today={today} />
        {onCommand && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={`Modifica ${race.name}`}
              onClick={() => setEditing(race.id)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={`Elimina ${race.name}`}
              onClick={() => {
                if (window.confirm(`Eliminare “${race.name}”?`))
                  void run({ action: "remove", id: race.id });
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </li>
    );
  return (
    <section aria-labelledby="gare-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="gare-title" className="text-xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {upcoming.length
              ? `${upcoming.length} in programma`
              : "Nessuna gara in programma"}
          </p>
        </div>
        {onCommand && editing !== "new" && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Aggiungi gara
          </Button>
        )}
      </div>
      <FormError message={error} />
      {editing === "new" && (
        <RaceForm
          today={today}
          allowPast={staff}
          submitLabel={pending ? "Salvataggio…" : "Aggiungi gara"}
          onSubmit={(race) => run({ action: "add", race })}
          onCancel={() => setEditing(null)}
        />
      )}
      {upcoming.length > 0 && (
        <ul className="space-y-2">{upcoming.map(row)}</ul>
      )}
      {past.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showPast}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => setShowPast((v) => !v)}
          >
            {showPast
              ? "Nascondi le gare passate"
              : `Gare passate (${past.length})`}
          </button>
          {showPast && <ul className="mt-2 space-y-2">{past.map(row)}</ul>}
        </div>
      )}
    </section>
  );
}

/** The questionnaire answers, newest plan first. */
export function FeedbackHistory({
  assignments,
  feedback,
}: {
  assignments: PlanAssignment[];
  feedback: CycleFeedback[];
}) {
  const items = feedback
    .map((f) => ({
      f,
      plan: assignments.find((a) => a.id === f.assignmentId),
    }))
    .toSorted(
      (a, b) =>
        (b.plan ? assignmentPeriod(b.plan).startsOn : "").localeCompare(
          a.plan ? assignmentPeriod(a.plan).startsOn : "",
        ) || b.f.submittedAt.localeCompare(a.f.submittedAt),
    );
  return (
    <section aria-labelledby="feedback-title" className="space-y-3">
      <div>
        <h2 id="feedback-title" className="text-xl font-bold tracking-tight">
          Feedback di fine piano
        </h2>
        <p className="text-sm text-muted-foreground">
          Le risposte al questionario di fine piano.
        </p>
      </div>
      {items.length ? (
        <ol className="space-y-3">
          {items.map(({ f, plan }) => (
            <li
              key={`${f.assignmentId}:${f.assignmentCreatedAt}`}
              className="rounded-2xl border bg-card p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="font-semibold first-letter:uppercase">
                  {plan
                    ? `${plan.snapshot.title} · ${periodLabel(plan)}`
                    : "Piano rimosso"}
                </h3>
                <time
                  dateTime={f.submittedAt}
                  className="text-xs text-muted-foreground"
                >
                  Inviato il {formatDate(f.submittedAt.slice(0, 10))}
                </time>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Com’è andato
                  </dt>
                  <dd className="font-medium">
                    {overallRatings[f.rating as keyof typeof overallRatings]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Durata sessioni
                  </dt>
                  <dd className="font-medium">
                    {sessionLengths[f.sessionLength]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Sessioni/settimana prossimo piano
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {f.sessionsPerWeek}
                    {plan && f.sessionsPerWeek !== plannedSessionsPerWeek(plan)
                      ? ` (erano ${plannedSessionsPerWeek(plan)})`
                      : ""}
                  </dd>
                </div>
              </dl>
              {f.changes && (
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Da cambiare: </span>
                  <span className="whitespace-pre-line">{f.changes}</span>
                </p>
              )}
              {f.notes && (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-muted px-3 py-2 text-sm leading-6">
                  {f.notes}
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nessun questionario compilato.
        </p>
      )}
    </section>
  );
}
