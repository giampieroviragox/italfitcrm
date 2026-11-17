"use client";
import { useState } from "react";
import styles from "./calendar-styles";
import { Check, Clock3, CalendarPlus, Users } from "lucide-react";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { ConfirmDialog } from "./confirm-dialog";
import { useCrm, updateCrm, useViewer } from "./store";
import { withAvailabilityCapacity } from "./availability-lessons";
import { useClock } from "./use-clock";
import {
  addDays,
  romeLocal,
  romeToIso,
  todayRome,
  weekStart,
} from "./fitness-logic";
import {
  availabilityCapacity,
  changeAvailability,
  type AvailabilitySlot,
} from "./availability";
import { AvailabilityEditor } from "./availability-editor";
import { SlotRoster } from "./availability-roster";
import { clockLabel, type AvailabilitySelection } from "./availability-time";
import { AvailabilityGrid } from "./availability-grid";
import { WeekNavigation } from "./week-navigation";
import { Editor, FormError } from "./ui";
interface Draft {
  original: string;
  slots: AvailabilitySlot[];
}
const slotDescription = (slot: AvailabilitySlot) => {
  const day = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "short",
  }).format(new Date(slot.start));
  const capacity = availabilityCapacity(slot);
  return `${day}, ${romeLocal(slot.start).slice(11)}–${romeLocal(slot.end).slice(11)}: ${capacity} ${capacity === 1 ? "posto" : "posti"}`;
};
const slotLabel = (selection: AvailabilitySelection) => {
  const day = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${selection.date}T12:00:00Z`));
  return `${day[0]!.toUpperCase()}${day.slice(1)}, ${selection.start}–${selection.end}`;
};
export function AvailabilityCalendar({
  editing,
  setEditing,
  onNewLesson,
}: {
  /** The availability form is opened here or from the page header. */
  editing: AvailabilitySelection | null;
  setEditing: (selection: AvailabilitySelection | null) => void;
  onNewLesson: (selection: AvailabilitySelection) => void;
}) {
  const state = useCrm(),
    viewer = useViewer(),
    now = useClock();
  const member = state.admins.find((admin) =>
    viewer ? admin.id === viewer.recordId : admin.role === "owner",
  );
  const [week, setWeek] = useState(() => weekStart(todayRome()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [choosing, setChoosing] = useState<AvailabilitySelection | null>(null);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [scrollHour, setScrollHour] = useState(7);
  const [daily, setDaily] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const saved = member?.availability ?? [];
  const slots = draft?.slots ?? saved;
  const dirty = draft !== null;
  useUnsavedChanges(dirty, () => setDraft(null));
  const apply = (
    next: AvailabilitySlot | undefined,
    previous?: AvailabilitySlot,
  ) => {
    const result = changeAvailability(slots, previous, next);
    const original = draft?.original ?? JSON.stringify(saved);
    setDraft(
      JSON.stringify(result) === original ? null : { original, slots: result },
    );
    setNotice("");
    setError("");
  };
  const changeWeek = (next: string) => {
    if (next === week) return;
    const change = () => {
      setDraft(null);
      setNotice("");
      setWeek(next);
    };
    if (dirty) setDiscardAction(() => change);
    else change();
  };
  const save = async () => {
    if (!member || !draft) return;
    setBusy(true);
    setError("");
    try {
      await updateCrm((current) => {
        const admin = current.admins.find((item) => item.id === member.id);
        if (
          !admin ||
          JSON.stringify(admin.availability ?? []) !== draft.original
        )
          throw new Error(
            "Le disponibilità sono cambiate. Ricarica la pagina prima di riprovare.",
          );
        return {
          ...current,
          admins: current.admins.map((item) =>
            item.id === member.id
              ? { ...item, availability: draft.slots }
              : item,
          ),
        };
      });
      setDraft(null);
      setConfirming(false);
      setNotice("Calendario salvato.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const added = slots.filter(
    (slot) =>
      !saved.some((item) => JSON.stringify(item) === JSON.stringify(slot)),
  );
  const removed = saved.filter(
    (slot) =>
      !slots.some((item) => JSON.stringify(item) === JSON.stringify(slot)),
  );
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const weekSlots = slots.filter((slot) =>
    days.some(
      (day) =>
        romeLocal(slot.start).slice(0, 10) <= day &&
        romeLocal(slot.end).slice(0, 10) >= day,
    ),
  );
  const weekStartsAt = Date.parse(romeToIso(`${week}T00:00`));
  const lessons = (state.lessons ?? [])
    .filter(
      (lesson) =>
        (showCancelled || !lesson.cancelled) &&
        romeLocal(lesson.startsAt).slice(0, 10) <= days[6]! &&
        Date.parse(lesson.startsAt) + lesson.durationMinutes * 60_000 >
          weekStartsAt,
    )
    .map((lesson) => withAvailabilityCapacity(state, lesson))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (!member)
    return (
      <p className="rounded-xl border p-5 text-sm text-muted-foreground">
        Il tuo account non è collegato a una scheda amministratore.
      </p>
    );
  return (
    <>
      <section className={styles.surface} aria-label="Le tue disponibilità">
        <div className={styles.toolbar}>
          <WeekNavigation week={week} onChange={changeWeek} />
          <div
            className="ml-auto hidden gap-1 rounded-lg border bg-background p-0.5 md:flex"
            role="group"
            aria-label="Vista calendario"
          >
            <Button
              size="sm"
              variant={daily ? "ghost" : "secondary"}
              aria-pressed={!daily}
              onClick={() => setDaily(false)}
            >
              Settimana
            </Button>
            <Button
              size="sm"
              variant={daily ? "secondary" : "ghost"}
              aria-pressed={daily}
              onClick={() => setDaily(true)}
            >
              Giorno
            </Button>
          </div>
        </div>
        <div className={styles.meta}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-1 rounded-sm bg-[var(--workspace-accent)]"
                aria-hidden="true"
              />
              Disponibilità
              <span className="hidden text-muted-foreground lg:inline">
                · {weekSlots.length}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-1 rounded-sm bg-foreground/75"
                aria-hidden
              />
              Lezioni
              <span className="hidden text-muted-foreground lg:inline">
                · {lessons.length}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <label className="flex items-center gap-2 text-xs">
              <CheckboxControl
                checked={showCancelled}
                onChange={(event) => setShowCancelled(event.target.checked)}
              />
              Mostra annullate
            </label>
            <div className="flex items-center gap-1.5">
              <Clock3 className="size-3.5" aria-hidden="true" />
              <label htmlFor="calendar-hour" className="sr-only">
                Vai alle
              </label>
              <SelectControl
                id="calendar-hour"
                value={scrollHour}
                onChange={(event) => setScrollHour(Number(event.target.value))}
                className="h-7 min-w-20 rounded-md border-0 bg-transparent px-1.5 text-xs shadow-none"
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {clockLabel(hour * 60)}
                  </option>
                ))}
              </SelectControl>
            </div>
          </div>
        </div>
        <AvailabilityGrid
          week={week}
          slots={weekSlots}
          lessons={lessons}
          bookings={state.bookings ?? []}
          now={now}
          scrollHour={scrollHour}
          daily={daily}
          showDay={() => setDaily(true)}
          select={(selection) =>
            selection.existing ? setEditing(selection) : setChoosing(selection)
          }
        />
        <div className={styles.footer} data-dirty={dirty}>
          <p aria-live="polite" className="flex items-center gap-2">
            {dirty ? (
              <>
                <span
                  className="size-1.5 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
                Modifiche non salvate
              </>
            ) : notice ? (
              <>
                <Check className="size-3.5 text-[var(--workspace-accent)]" />
                {notice}
              </>
            ) : (
              <>
                <span className="hidden sm:inline">
                  Trascina sul calendario per aggiungere una disponibilità o una
                  lezione. Clicca una fascia per modificarla o iscrivere
                  studenti.
                </span>
                <span className="sm:hidden">
                  Tocca un orario per aggiungere una disponibilità o una
                  lezione.
                </span>
              </>
            )}
          </p>
          {dirty ? (
            <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  setDiscardAction(() => () => {
                    setDraft(null);
                    setNotice("");
                  })
                }
              >
                Annulla
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setConfirming(true);
                }}
              >
                Salva modifiche
              </Button>
            </div>
          ) : (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              24 ore · Orari di Roma
            </span>
          )}
        </div>
      </section>
      {!confirming && <FormError message={error} />}
      {choosing && (
        <Editor
          centered
          title="Cosa vuoi aggiungere?"
          description={`${slotLabel(choosing)}. Scegli come usare questo orario.`}
          dirty={false}
          close={() => setChoosing(null)}
        >
          <div className="grid gap-3 pb-6 sm:grid-cols-2">
            <button
              type="button"
              className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-foreground/10 focus-visible:outline-none"
              onClick={() => {
                setEditing({ ...choosing });
                setChoosing(null);
              }}
            >
              <Users className="size-5" aria-hidden />
              <span className="text-sm font-semibold">Disponibilità</span>
              <span className="text-[13px] leading-5 text-muted-foreground">
                Una fascia con un numero di posti: gli studenti si prenotano da
                soli.
              </span>
            </button>
            <button
              type="button"
              className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-foreground/10 focus-visible:outline-none"
              onClick={() => {
                onNewLesson({ ...choosing });
                setChoosing(null);
              }}
            >
              <CalendarPlus className="size-5" aria-hidden />
              <span className="text-sm font-semibold">Lezione</span>
              <span className="text-[13px] leading-5 text-muted-foreground">
                Una lezione fissata da te, con gli studenti che scegli o crei.
              </span>
            </button>
          </div>
        </Editor>
      )}
      {editing && (
        <AvailabilityEditor
          key={`${editing.date}${editing.start}${editing.end}${editing.existing?.start ?? ""}`}
          selection={editing}
          close={() => setEditing(null)}
          apply={apply}
          roster={
            editing.existing &&
            saved.some(
              (item) =>
                JSON.stringify(item) === JSON.stringify(editing.existing),
            ) ? (
              <SlotRoster adminId={member.id} slot={editing.existing} />
            ) : undefined
          }
        />
      )}
      <ConfirmDialog
        open={discardAction !== null}
        title="Scartare le modifiche?"
        description="Le disponibilità non salvate andranno perse."
        confirmLabel="Scarta modifiche"
        onCancel={() => setDiscardAction(null)}
        onConfirm={() => {
          discardAction?.();
          setDiscardAction(null);
        }}
      />
      <ConfirmDialog
        open={confirming}
        title="Salvare il calendario?"
        description={[
          added.length
            ? `Aggiungi: ${added.map(slotDescription).join("; ")}.`
            : "",
          removed.length
            ? `Rimuovi: ${removed.map(slotDescription).join("; ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel="Conferma e salva"
        busy={busy}
        error={error}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void save()}
      />
    </>
  );
}
