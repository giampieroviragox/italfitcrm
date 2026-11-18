"use client";
import { DatePicker, MonthPicker } from "@/components/ui/date-time-picker";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { studentAccess } from "./tier-access";
import { SelectControl } from "@/components/ui/select-control";
import { useState } from "react";
import { ChevronDown, Dumbbell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Editor, EditorCancel, Field, control, FormError } from "./ui";
import { useCrm, updateCrm } from "./store";
import {
  ExerciseNameSuggestions,
  ExercisePreview,
} from "./exercise-media-view";
import type {
  WorkoutPlan,
  WorkoutExercise,
  WorkoutSession,
  PlanAssignment,
} from "./fitness-model";
import { todayRome, validateSessions } from "./fitness-logic";
import { assignmentCoachId, defaultPlanCoachId } from "./online-coaching";
const exercise = (): WorkoutExercise => ({
  id: crypto.randomUUID(),
  name: "",
  sets: 3,
  reps: "8–10",
  restSeconds: 90,
  notes: "",
  videoUrl: "",
});
const session = (): WorkoutSession => ({
  id: crypto.randomUUID(),
  name: "Sessione A",
  exercises: [exercise()],
});
export function PlanEditor({
  plan,
  close,
  saved,
}: {
  plan?: WorkoutPlan;
  close: () => void;
  saved?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<WorkoutPlan>(() =>
    plan
      ? structuredClone(plan)
      : {
          id: crypto.randomUUID(),
          title: "",
          description: "",
          status: "draft",
          sessions: [session()],
        },
  );
  const [original] = useState(JSON.stringify(plan)),
    [baseline] = useState(JSON.stringify(draft)),
    [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const active =
    draft.sessions.find((s) => s.id === sessionId) ?? draft.sessions[0];
  const activeIndex = draft.sessions.findIndex((s) => s.id === active?.id);
  const addSession = () => {
    const next = {
      ...session(),
      name: `Sessione ${draft.sessions.length + 1}`,
    };
    setDraft((d) => ({ ...d, sessions: [...d.sessions, next] }));
    setSessionId(next.id);
    setError("");
  };
  const setSession = (id: string, patch: Partial<WorkoutSession>) =>
    setDraft((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  const setExercise = (
    sessionId: string,
    id: string,
    patch: Partial<WorkoutExercise>,
  ) =>
    setDraft((d) => ({
      ...d,
      sessions: d.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              exercises: s.exercises.map((e) =>
                e.id === id ? { ...e, ...patch } : e,
              ),
            }
          : s,
      ),
    }));
  return (
    <Editor
      title={plan ? "Modifica piano" : "Nuovo piano"}
      description={
        plan
          ? "Le assegnazioni già esistenti conservano la loro copia."
          : "Imposta il piano e organizza le sessioni di allenamento."
      }
      wide
      dirty={JSON.stringify(draft) !== baseline}
      close={close}
    >
      <form
        className="crm-editor-form gap-4! [--border-focus:var(--border-hover)]"
        onSubmit={async (e) => {
          e.preventDefault();
          for (const [index, item] of draft.sessions.entries()) {
            try {
              validateSessions({ status: draft.status, sessions: [item] });
            } catch (issue) {
              setSessionId(item.id);
              setError(`Sessione ${index + 1}: ${(issue as Error).message}`);
              return;
            }
          }
          try {
            await updateCrm((s) => {
              if (
                plan &&
                JSON.stringify(s.plans?.find((p) => p.id === plan.id)) !==
                  original
              )
                throw new Error(
                  "Il piano è stato modificato altrove. Riapri il form.",
                );
              const next = {
                ...draft,
                title: draft.title.trim(),
                description: draft.description.trim(),
              };
              return {
                ...s,
                plans: plan
                  ? (s.plans ?? []).map((p) => (p.id === next.id ? next : p))
                  : [next, ...(s.plans ?? [])],
              };
            });
            saved?.(draft.id);
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field label="Nome piano *">
            <input
              className={control}
              required
              maxLength={100}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Es. Forza · 3 giorni"
            />
          </Field>
          <Field label="Stato">
            <SelectControl
              className={control}
              value={draft.status}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as WorkoutPlan["status"],
                })
              }
            >
              <option value="draft">Bozza</option>
              <option value="published">Pubblicato</option>
              {plan?.status === "archived" && (
                <option value="archived">Archiviato</option>
              )}
            </SelectControl>
          </Field>
        </div>
        <details
          open={Boolean(plan?.description) || undefined}
          className="rounded-xl border bg-card px-4 py-3"
        >
          <summary className="cursor-pointer text-sm font-semibold">
            Descrizione del piano
          </summary>
          <div className="mt-3">
            <Field label="Descrizione e obiettivo">
              <textarea
                className={control}
                rows={3}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </Field>
          </div>
        </details>
        {draft.program && (
          <details className="rounded-xl border bg-card px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Dettagli del programma
            </summary>
            <div className="mt-4 space-y-4">
              <Field label="Obiettivo">
                <input
                  className={control}
                  value={draft.program.goal}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      program: { ...draft.program!, goal: e.target.value },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inizio originale">
                  <DatePicker
                    required
                    value={draft.program.startsOn}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        program: { ...draft.program!, startsOn: v },
                      })
                    }
                  />
                </Field>
                <Field label="Fine originale">
                  <DatePicker
                    required
                    value={draft.program.endsOn}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        program: { ...draft.program!, endsOn: v },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Indicazioni per il blocco">
                <textarea
                  className={control}
                  rows={5}
                  value={draft.program.guidance}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      program: { ...draft.program!, guidance: e.target.value },
                    })
                  }
                />
              </Field>
              {draft.program.paceZones.map((zone, index) => (
                <div key={index} className="grid grid-cols-2 gap-3">
                  <Field label="Zona">
                    <input
                      className={control}
                      value={zone.name}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          program: {
                            ...draft.program!,
                            paceZones: draft.program!.paceZones.map((z, i) =>
                              i === index ? { ...z, name: e.target.value } : z,
                            ),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Passo">
                    <input
                      className={control}
                      value={zone.pace}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          program: {
                            ...draft.program!,
                            paceZones: draft.program!.paceZones.map((z, i) =>
                              i === index ? { ...z, pace: e.target.value } : z,
                            ),
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              ))}
            </div>
          </details>
        )}
        <div className="mt-2 grid min-w-0 gap-4 md:grid-cols-[minmax(0,26%)_minmax(0,1fr)]">
          <section
            aria-label="Sessioni del piano"
            className="min-w-0 rounded-xl border bg-card p-3 md:self-start"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Sessioni{" "}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                  {draft.sessions.length}
                </span>
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Aggiungi sessione"
                disabled={draft.sessions.length >= 52}
                onClick={addSession}
              >
                <Plus /> Aggiungi
              </Button>
            </div>
            <div className="flex gap-1 overflow-auto p-1 md:max-h-72 md:flex-col">
              {draft.sessions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === active?.id}
                  onClick={() => {
                    setSessionId(item.id);
                    setError("");
                  }}
                  className="flex min-h-11 min-w-28 shrink-0 items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-muted aria-pressed:bg-muted md:w-full md:min-w-0"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-card text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {item.name || "Senza nome"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Sett. {item.week ?? 1}
                      {item.day ? ` · ${item.day}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          {active ? (
            <section
              key={active.id}
              aria-label={`Modifica sessione ${activeIndex + 1}`}
              className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <Dumbbell className="size-4" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg leading-tight font-semibold tracking-tight">
                      Sessione {activeIndex + 1}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {active.exercises.length}{" "}
                      {active.exercises.length === 1 ? "esercizio" : "esercizi"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={`Rimuovi sessione ${activeIndex + 1}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      sessions: draft.sessions.filter(
                        (x) => x.id !== active.id,
                      ),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.5fr)_5rem_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="col-span-2 sm:col-span-1">
                  <Field label="Nome sessione">
                    <input
                      className={control}
                      value={active.name}
                      onChange={(e) =>
                        setSession(active.id, { name: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Settimana">
                  <input
                    className={control}
                    type="number"
                    min={1}
                    max={52}
                    value={active.week ?? 1}
                    onChange={(e) =>
                      setSession(active.id, { week: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Giorno">
                  <input
                    className={control}
                    value={active.day ?? ""}
                    placeholder="Es. Lunedì"
                    onChange={(e) =>
                      setSession(active.id, { day: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tipo di allenamento">
                  <SelectControl
                    className={control}
                    value={active.kind ?? "strength"}
                    onChange={(e) =>
                      setSession(active.id, {
                        kind: e.target.value as "strength" | "run",
                      })
                    }
                  >
                    <option value="strength">Forza</option>
                    <option value="run">Corsa</option>
                  </SelectControl>
                </Field>
              </div>
              <details className="rounded-xl border bg-background px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Indicazioni della sessione
                </summary>
                <div className="mt-4 space-y-3">
                  <Field label="Riscaldamento">
                    <textarea
                      className={control}
                      rows={4}
                      value={active.preparation ?? ""}
                      onChange={(e) =>
                        setSession(active.id, { preparation: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Indicazioni e progressione">
                    <textarea
                      className={control}
                      rows={3}
                      value={active.guidance ?? ""}
                      onChange={(e) =>
                        setSession(active.id, { guidance: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Defaticamento">
                    <textarea
                      className={control}
                      rows={3}
                      value={active.cooldown ?? ""}
                      onChange={(e) =>
                        setSession(active.id, { cooldown: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </details>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <h4 className="text-base font-semibold">Esercizi</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={active.exercises.length >= 30}
                    onClick={() =>
                      setSession(active.id, {
                        exercises: [...active.exercises, exercise()],
                      })
                    }
                  >
                    <Plus /> Aggiungi esercizio
                  </Button>
                </div>
                <ExerciseNameSuggestions id="nomi-esercizi" />
                <div className="divide-y">
                  {active.exercises.map((ex, j) => (
                    <div key={ex.id} className="space-y-2 py-3">
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-[minmax(0,1.6fr)_4rem_minmax(0,1fr)_5.5rem_2rem] sm:items-end">
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <Field label={`Esercizio ${j + 1}`}>
                            <input
                              className={control}
                              list="nomi-esercizi"
                              value={ex.name}
                              placeholder="Nome esercizio"
                              onChange={(e) =>
                                setExercise(active.id, ex.id, {
                                  name: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <ExercisePreview name={ex.name} />
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="col-start-3 row-start-1 self-end justify-self-end sm:col-start-5 sm:row-start-1"
                          aria-label={`Rimuovi esercizio ${j + 1} dalla sessione ${activeIndex + 1}`}
                          onClick={() =>
                            setSession(active.id, {
                              exercises: active.exercises.filter(
                                (x) => x.id !== ex.id,
                              ),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                        <Field label="Serie">
                          <input
                            className={control}
                            type="number"
                            min={1}
                            max={20}
                            required
                            value={Number.isNaN(ex.sets) ? "" : ex.sets}
                            onChange={(e) =>
                              setExercise(active.id, ex.id, {
                                sets: e.target.valueAsNumber,
                              })
                            }
                          />
                        </Field>
                        <Field label="Rip. / durata">
                          <input
                            className={control}
                            value={ex.reps}
                            onChange={(e) =>
                              setExercise(active.id, ex.id, {
                                reps: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Rec. (s)">
                          <input
                            className={control}
                            type="number"
                            min={0}
                            max={900}
                            required
                            value={
                              Number.isNaN(ex.restSeconds) ? "" : ex.restSeconds
                            }
                            onChange={(e) =>
                              setExercise(active.id, ex.id, {
                                restSeconds: e.target.valueAsNumber,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <details className="group">
                        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground">
                          <ChevronDown
                            className="size-3 transition-transform group-open:rotate-180"
                            aria-hidden
                          />
                          Note e video
                          {(ex.notes || ex.videoUrl) && (
                            <span aria-hidden> ·</span>
                          )}
                        </summary>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Note esercizio">
                            <input
                              className={control}
                              value={ex.notes}
                              onChange={(e) =>
                                setExercise(active.id, ex.id, {
                                  notes: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="Link video">
                            <input
                              className={control}
                              inputMode="url"
                              value={ex.videoUrl ?? ""}
                              placeholder="https://"
                              onChange={(e) =>
                                setExercise(active.id, ex.id, {
                                  videoUrl: e.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>
                      </details>
                    </div>
                  ))}
                  {!active.exercises.length && (
                    <p className="py-4 text-sm text-muted-foreground">
                      Nessun esercizio in questa sessione.
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              Aggiungi una sessione per inserire gli esercizi.
            </p>
          )}
        </div>
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Salva piano</Button>
        </div>
      </form>
    </Editor>
  );
}
export function AssignmentEditor({
  planId,
  studentId,
  close,
}: {
  planId?: string;
  studentId?: string;
  close: () => void;
}) {
  const state = useCrm();
  const [student, setStudent] = useState(studentId ?? ""),
    [plan, setPlan] = useState(planId ?? ""),
    [month, setMonth] = useState(todayRome().slice(0, 7)),
    [replace, setReplace] = useState(false),
    [coachChoice, setCoachChoice] = useState<string | null>(null),
    [error, setError] = useState("");
  const [confirmedAssignment, setConfirmedAssignment] = useState("");
  const existing = state.assignments?.find(
    (a) => a.studentId === student && a.month === month,
  );
  const selectedStudent = state.students.find((s) => s.id === student);
  // Follows the subscription of the chosen month until the admin picks someone else.
  const suggestedCoach = existing
    ? assignmentCoachId(state, existing)
    : selectedStudent
      ? defaultPlanCoachId(state, selectedStudent, month)
      : undefined;
  const coach = coachChoice ?? suggestedCoach ?? "";
  return (
    <Editor
      title="Assegna piano mensile"
      description="Ogni studente ha un piano per mese. Viene conservata una copia del piano al momento dell’assegnazione."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await updateCrm((s) => {
              const source = s.plans?.find((p) => p.id === plan),
                old = s.assignments?.find(
                  (a) => a.studentId === student && a.month === month,
                );
              if (!source || !student)
                throw new Error(
                  "Seleziona uno studente e un piano pubblicato.",
                );
              if (old && replace && JSON.stringify(old) !== confirmedAssignment)
                throw new Error(
                  "Il piano mensile è cambiato altrove. Togli e rimetti la conferma per verificare la versione attuale.",
                );
              if (old && !replace)
                throw new Error(
                  "Conferma la sostituzione del piano già assegnato.",
                );
              const item: PlanAssignment = {
                id: old?.id ?? crypto.randomUUID(),
                studentId: student,
                planId: plan,
                month,
                ...(coach ? { coachId: coach } : {}),
                createdAt: new Date().toISOString(),
                snapshot: structuredClone({
                  title: source.title,
                  description: source.description,
                  sessions: source.sessions,
                  ...(source.program ? { program: source.program } : {}),
                }),
              };
              return {
                ...s,
                assignments: old
                  ? (s.assignments ?? []).map((a) =>
                      a.id === old.id ? item : a,
                    )
                  : [...(s.assignments ?? []), item],
              };
            });
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Studente *">
          <SelectControl
            className={control}
            required
            value={student}
            onChange={(e) => {
              setStudent(e.target.value);
              setReplace(false);
              setCoachChoice(null);
            }}
          >
            <option value="">Seleziona studente…</option>
            {state.students
              .filter((s) => !s.archived && studentAccess(state, s).plans)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
          </SelectControl>
        </Field>
        <Field label="Mese *">
          <MonthPicker
            required
            value={month}
            onChange={(v) => {
              setMonth(v);
              setReplace(false);
              setCoachChoice(null);
            }}
          />
        </Field>
        <Field label="Piano *">
          <SelectControl
            className={control}
            required
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="">Seleziona piano…</option>
            {state.plans
              ?.filter((p) => p.status === "published")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </SelectControl>
        </Field>
        <Field
          label="Coach del piano"
          hint={
            coachChoice === null && suggestedCoach
              ? "Predefinito dall’abbonamento Coaching online del mese, se presente."
              : "Il coach che segue questo piano mensile."
          }
        >
          <SelectControl
            className={control}
            value={coach}
            onChange={(e) => setCoachChoice(e.target.value)}
          >
            <option value="">Nessun coach</option>
            {state.admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </SelectControl>
        </Field>
        {existing && (
          <div className="space-y-3 rounded-xl bg-muted p-4 text-xs">
            <p>
              Piano attuale: <strong>{existing.snapshot.title}</strong>
            </p>
            <label className="flex items-start gap-2">
              <CheckboxControl
                checked={replace}
                onChange={(e) => {
                  setReplace(e.target.checked);
                  setConfirmedAssignment(JSON.stringify(existing));
                }}
              />
              Sostituisci il piano e la sua copia per questo mese.
            </label>
          </div>
        )}
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Assegna piano</Button>
        </div>
      </form>
    </Editor>
  );
}
