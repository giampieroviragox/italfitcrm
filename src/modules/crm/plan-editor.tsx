"use client";
import { DatePicker, MonthPicker } from "@/components/ui/date-time-picker";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { studentAccess } from "./tier-access";
import { SelectControl } from "@/components/ui/select-control";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Editor, EditorCancel, Field, control, FormError } from "./ui";
import { useCrm, updateCrm } from "./store";
import type {
  WorkoutPlan,
  WorkoutExercise,
  WorkoutSession,
  PlanAssignment,
} from "./fitness-model";
import { todayRome } from "./fitness-logic";
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
      description="Organizza sessioni ed esercizi. Le assegnazioni già esistenti conservano la loro copia."
      dirty={JSON.stringify(draft) !== baseline}
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
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
        {draft.program && (
          <details className="space-y-4 rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">
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
        {draft.sessions.map((s, i) => (
          <section key={s.id} className="space-y-4 rounded-xl border p-4">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label={`Sessione ${i + 1}`}>
                  <input
                    className={control}
                    value={s.name}
                    onChange={(e) => setSession(s.id, { name: e.target.value })}
                  />
                </Field>
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={`Rimuovi sessione ${i + 1}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    sessions: draft.sessions.filter((x) => x.id !== s.id),
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <details className="rounded-lg border bg-background p-3">
              <summary className="cursor-pointer text-xs font-medium">
                Settimana, giornata e indicazioni
              </summary>
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Settimana">
                    <input
                      className={control}
                      type="number"
                      min={1}
                      max={52}
                      value={s.week ?? 1}
                      onChange={(e) =>
                        setSession(s.id, { week: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Giorno">
                    <input
                      className={control}
                      value={s.day ?? ""}
                      placeholder="Es. Lunedì"
                      onChange={(e) =>
                        setSession(s.id, { day: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Tipo di allenamento">
                  <SelectControl
                    className={control}
                    value={s.kind ?? "strength"}
                    onChange={(e) =>
                      setSession(s.id, {
                        kind: e.target.value as "strength" | "run",
                      })
                    }
                  >
                    <option value="strength">Forza</option>
                    <option value="run">Corsa</option>
                  </SelectControl>
                </Field>
                <Field label="Riscaldamento">
                  <textarea
                    className={control}
                    rows={4}
                    value={s.preparation ?? ""}
                    onChange={(e) =>
                      setSession(s.id, { preparation: e.target.value })
                    }
                  />
                </Field>
                <Field label="Indicazioni e progressione">
                  <textarea
                    className={control}
                    rows={3}
                    value={s.guidance ?? ""}
                    onChange={(e) =>
                      setSession(s.id, { guidance: e.target.value })
                    }
                  />
                </Field>
                <Field label="Defaticamento">
                  <textarea
                    className={control}
                    rows={3}
                    value={s.cooldown ?? ""}
                    onChange={(e) =>
                      setSession(s.id, { cooldown: e.target.value })
                    }
                  />
                </Field>
              </div>
            </details>
            {s.exercises.map((ex, j) => (
              <div
                key={ex.id}
                className="space-y-3 rounded-xl border bg-background p-4"
              >
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label={`Esercizio ${j + 1}`}>
                      <input
                        className={control}
                        value={ex.name}
                        onChange={(e) =>
                          setExercise(s.id, ex.id, { name: e.target.value })
                        }
                        placeholder="Nome esercizio"
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Rimuovi esercizio ${j + 1} dalla sessione ${i + 1}`}
                    onClick={() =>
                      setSession(s.id, {
                        exercises: s.exercises.filter((x) => x.id !== ex.id),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Serie">
                    <input
                      className={control}
                      type="number"
                      min={1}
                      max={20}
                      required
                      value={ex.sets}
                      onChange={(e) =>
                        setExercise(s.id, ex.id, {
                          sets: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Ripetizioni / durata">
                    <input
                      className={control}
                      value={ex.reps}
                      onChange={(e) =>
                        setExercise(s.id, ex.id, { reps: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Recupero (s)">
                    <input
                      className={control}
                      type="number"
                      min={0}
                      max={900}
                      required
                      value={ex.restSeconds}
                      onChange={(e) =>
                        setExercise(s.id, ex.id, {
                          restSeconds: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label="Note esercizio">
                  <input
                    className={control}
                    value={ex.notes}
                    onChange={(e) =>
                      setExercise(s.id, ex.id, { notes: e.target.value })
                    }
                  />
                </Field>
                <Field label="Video (facoltativo)">
                  <input
                    className={control}
                    type="url"
                    value={ex.videoUrl ?? ""}
                    onChange={(e) =>
                      setExercise(s.id, ex.id, { videoUrl: e.target.value })
                    }
                    placeholder="https://"
                  />
                </Field>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={s.exercises.length >= 30}
              onClick={() =>
                setSession(s.id, { exercises: [...s.exercises, exercise()] })
              }
            >
              <Plus className="size-3.5" />
              Aggiungi esercizio
            </Button>
          </section>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={draft.sessions.length >= 52}
          onClick={() =>
            setDraft({
              ...draft,
              sessions: [
                ...draft.sessions,
                {
                  ...session(),
                  name: `Sessione ${String.fromCharCode(65 + draft.sessions.length)}`,
                },
              ],
            })
          }
        >
          <Plus className="size-4" />
          Aggiungi sessione
        </Button>
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
    [error, setError] = useState("");
  const [confirmedAssignment, setConfirmedAssignment] = useState("");
  const existing = state.assignments?.find(
    (a) => a.studentId === student && a.month === month,
  );
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
