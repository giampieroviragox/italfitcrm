"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time-picker";
import { SelectControl } from "@/components/ui/select-control";
import { formatDate, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { todayRome } from "./fitness-logic";
import { euro } from "./lesson-wallet-view";
import { normalize, type CrmState, type CrmStudent } from "./model";
import {
  assignmentCoachId,
  assignmentsInPeriod,
  coachingDurations,
  coachingPrices,
  defaultEndDate,
  includedPlans,
  nextDay,
  subscriptionStatus,
  subscriptionStatusLabels,
  type CoachingDuration,
  type OnlineSubscription,
  type SubscriptionStatus,
} from "./online-coaching";
import { updateCrm, updateOnlineCoaching, useCrm } from "./store";
import type { PlanAssignment } from "./fitness-model";
import { coachName } from "./student-coach";
import { Field, FormError, control } from "./ui";

const statusTone: Record<SubscriptionStatus, string> = {
  upcoming: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  active: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  expiring: "bg-amber-500/10 text-amber-900 dark:text-amber-200",
  expired: "bg-muted text-muted-foreground",
};
export function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        statusTone[status],
      )}
    >
      {subscriptionStatusLabels[status]}
    </span>
  );
}

export const durationLabel = (months: number) => `${months} mesi`;
export const coachLabel = (state: CrmState, coachId: string) =>
  state.admins.find((a) => a.id === coachId)?.name ?? "Coach non disponibile";

/** The admin matching the student's reference coach, else the owner. */
function defaultCoachId(state: CrmState, student: CrmStudent) {
  const name = normalize(coachName(student.coach));
  return (
    state.admins.find((a) => normalize(coachName(a.name)) === name)?.id ??
    state.admins.find((a) => a.role === "owner")?.id ??
    ""
  );
}

function SubscriptionForm({
  student,
  editing,
  close,
}: {
  student: CrmStudent;
  editing?: OnlineSubscription;
  close: () => void;
}) {
  const state = useCrm();
  const today = todayRome();
  const latest = (student.onlineSubscriptions ?? [])
    .filter((s) => s.id !== editing?.id)
    .toSorted((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
  const initialStart =
    editing?.startsOn ??
    (latest && latest.endsOn >= today ? nextDay(latest.endsOn) : today);
  const initialDuration = editing?.durationMonths ?? 3;
  const [duration, setDuration] = useState<CoachingDuration>(initialDuration);
  const [startsOn, setStartsOn] = useState(initialStart);
  const [endsOn, setEndsOn] = useState(
    editing?.endsOn ?? defaultEndDate(initialStart, initialDuration),
  );
  const [endCustom, setEndCustom] = useState(
    editing
      ? editing.endsOn !==
          defaultEndDate(editing.startsOn, editing.durationMonths)
      : false,
  );
  const [price, setPrice] = useState(
    String((editing?.price ?? coachingPrices[initialDuration]) / 100),
  );
  const [priceCustom, setPriceCustom] = useState(
    editing ? editing.price !== coachingPrices[editing.durationMonths] : false,
  );
  const [coachId, setCoachId] = useState(
    editing?.coachId ?? defaultCoachId(state, student),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const computedEnd = defaultEndDate(startsOn, duration);

  const changeDuration = (value: CoachingDuration) => {
    setDuration(value);
    if (!endCustom) setEndsOn(defaultEndDate(startsOn, value));
    if (!priceCustom) setPrice(String(coachingPrices[value] / 100));
  };
  const changeStart = (value: string) => {
    setStartsOn(value);
    if (!endCustom && value) setEndsOn(defaultEndDate(value, duration));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const subscription = {
        durationMonths: duration,
        startsOn,
        endsOn,
        coachId,
        price: Math.round(Number(price) * 100),
      };
      await updateOnlineCoaching(
        editing
          ? {
              action: "update",
              studentId: student.id,
              subscriptionId: editing.id,
              subscription,
            }
          : { action: "create", studentId: student.id, subscription },
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border bg-card p-4"
      aria-busy={pending}
    >
      <h3 className="text-sm font-semibold">
        {editing ? "Modifica abbonamento" : "Nuovo abbonamento"}
      </h3>
      <FormError message={error} />
      <fieldset disabled={pending} className="space-y-4">
        <div role="radiogroup" aria-label="Durata" className="space-y-1.5">
          <span className="block text-sm font-medium">Durata</span>
          <div className="grid grid-cols-3 gap-2">
            {coachingDurations.map((months) => (
              <button
                key={months}
                type="button"
                role="radio"
                aria-checked={duration === months}
                onClick={() => changeDuration(months)}
                className={cn(
                  "min-h-14 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  duration === months
                    ? "border-foreground bg-muted"
                    : "hover:bg-subtle",
                )}
              >
                <span className="block font-semibold">
                  {durationLabel(months)}
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {months} piani · {euro(coachingPrices[months])}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valido dal">
            <DatePicker required value={startsOn} onChange={changeStart} />
          </Field>
          <Field
            label="Valido fino al"
            hint={
              endCustom
                ? `Data personalizzata. Con ${durationLabel(duration)}: ${formatDate(computedEnd)}.`
                : `Calcolata su ${durationLabel(duration)}. Puoi modificarla.`
            }
          >
            <DatePicker
              required
              min={startsOn}
              value={endsOn}
              onChange={(value) => {
                setEndsOn(value);
                setEndCustom(value !== computedEnd);
              }}
            />
          </Field>
        </div>
        {endCustom && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => {
              setEndsOn(computedEnd);
              setEndCustom(false);
            }}
          >
            Ripristina la scadenza calcolata
          </button>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Coach">
            <SelectControl
              required
              className={control}
              value={coachId}
              onChange={(e) => setCoachId(e.target.value)}
            >
              {!coachId && <option value="">Seleziona il coach</option>}
              {state.admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name}
                </option>
              ))}
            </SelectControl>
          </Field>
          <Field
            label="Prezzo totale (€)"
            hint={
              priceCustom
                ? `Listino: ${euro(coachingPrices[duration])}.`
                : "Da listino. Puoi modificarlo."
            }
          >
            <input
              required
              type="number"
              min="0"
              max="100000"
              step="0.01"
              inputMode="decimal"
              className={control}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceCustom(
                  Math.round(Number(e.target.value) * 100) !==
                    coachingPrices[duration],
                );
              }}
            />
          </Field>
        </div>
        <p className="text-sm text-muted-foreground">
          Include {duration} piani mensili da quattro settimane.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            {pending
              ? "Salvataggio…"
              : editing
                ? "Salva modifiche"
                : "Crea abbonamento"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={close}>
            Annulla
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function OnlineCoachingPanel({ student }: { student: CrmStudent }) {
  const state = useCrm();
  const today = todayRome();
  const [form, setForm] = useState<
    | { mode: "create" }
    | { mode: "edit"; subscription: OnlineSubscription }
    | null
  >(null);
  const [removing, setRemoving] = useState<OnlineSubscription | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [removePending, setRemovePending] = useState(false);
  const subscriptions = (student.onlineSubscriptions ?? []).toSorted((a, b) =>
    b.startsOn.localeCompare(a.startsOn),
  );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Coaching online</h2>
          <p className="text-sm text-muted-foreground">
            Abbonamenti da 3, 6 o 12 mesi: un piano da quattro settimane per
            ogni mese.
          </p>
        </div>
        {!form && !student.archived && (
          <Button size="sm" onClick={() => setForm({ mode: "create" })}>
            Nuovo abbonamento
          </Button>
        )}
      </div>
      {form && (
        <SubscriptionForm
          key={form.mode === "edit" ? form.subscription.id : "new"}
          student={student}
          editing={form.mode === "edit" ? form.subscription : undefined}
          close={() => setForm(null)}
        />
      )}
      {subscriptions.length ? (
        <ul className="divide-y rounded-xl border">
          {subscriptions.map((s) => {
            const status = subscriptionStatus(s, today);
            const assigned = assignmentsInPeriod(
              state.assignments ?? [],
              student.id,
              s,
            ).toSorted((a, b) => a.month.localeCompare(b.month));
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3.5 text-sm"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    Coaching online · {durationLabel(s.durationMonths)}
                    <SubscriptionStatusBadge status={status} />
                  </p>
                  <p className="text-muted-foreground">
                    {formatDate(s.startsOn)} → {formatDate(s.endsOn)} · Coach{" "}
                    {coachLabel(state, s.coachId)}
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    Piani inclusi {includedPlans(s)} · assegnati nel periodo{" "}
                    {assigned.length} · {euro(s.price)}
                  </p>
                  {assigned.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 pt-1">
                      {assigned.map((a) => {
                        const coachId = assignmentCoachId(state, a);
                        return (
                          <li
                            key={a.id}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs",
                              coachId !== s.coachId &&
                                "border-foreground/40 font-medium",
                            )}
                          >
                            {formatMonth(a.month)} ·{" "}
                            {coachId ? coachLabel(state, coachId) : "—"}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {!student.archived && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setForm({ mode: "edit", subscription: s })}
                    >
                      Modifica
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRemoveError("");
                        setRemoving(s);
                      }}
                    >
                      Rimuovi
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !form && (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nessun abbonamento Coaching online.
          </p>
        )
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Rimuovere l’abbonamento?"
        description={
          removing
            ? `L’abbonamento ${durationLabel(removing.durationMonths)} dal ${formatDate(removing.startsOn)} al ${formatDate(removing.endsOn)} verrà rimosso. Resterà traccia nella cronologia della scheda; i piani già assegnati non cambiano.`
            : ""
        }
        confirmLabel="Rimuovi"
        busy={removePending}
        error={removeError}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing || removePending) return;
          setRemovePending(true);
          try {
            await updateOnlineCoaching({
              action: "remove",
              studentId: student.id,
              subscriptionId: removing.id,
            });
            setRemoving(null);
          } catch (e) {
            setRemoveError((e as Error).message);
          } finally {
            setRemovePending(false);
          }
        }}
      />
    </section>
  );
}

/** Reassigns the coach of one monthly plan; the coach is credited for that month. */
export function PlanCoachSelect({
  assignment,
}: {
  assignment: PlanAssignment;
}) {
  const state = useCrm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const effective = assignmentCoachId(state, assignment) ?? "";
  return (
    <div className="min-w-48 space-y-1">
      <SelectControl
        aria-label={`Coach del piano di ${assignment.month}`}
        className={control}
        value={effective}
        disabled={pending}
        onChange={async (e) => {
          const coachId = e.target.value;
          if (!coachId || coachId === assignment.coachId) return;
          setPending(true);
          setError("");
          try {
            await updateCrm((s) => ({
              ...s,
              assignments: (s.assignments ?? []).map((a) =>
                a.id === assignment.id ? { ...a, coachId } : a,
              ),
            }));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        {!effective && <option value="">Seleziona il coach</option>}
        {state.admins.map((admin) => (
          <option key={admin.id} value={admin.id}>
            {admin.name}
          </option>
        ))}
      </SelectControl>
      {!assignment.coachId && effective && (
        <p className="text-xs text-muted-foreground">
          Predefinito dall’abbonamento
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
