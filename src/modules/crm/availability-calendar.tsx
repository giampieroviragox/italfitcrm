"use client";
import { useState } from "react";
import { CalendarPlus, Check, Clock3, RotateCcw } from "lucide-react";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { ConfirmDialog } from "./confirm-dialog";
import { useCrm, updateCrm, useViewer } from "./store";
import { useClock } from "./use-clock";
import { addDays, romeLocal, todayRome, weekStart } from "./fitness-logic";
import {
  availabilitySlotCount,
  changeAvailability,
  slotDurationMinutes,
  type AvailabilitySlot,
} from "./availability";
import { AvailabilityEditor } from "./availability-editor";
import {
  clockLabel,
  durationLabel,
  type AvailabilitySelection,
} from "./availability-time";
import { AvailabilityGrid } from "./availability-grid";
import { WeekNavigation } from "./week-navigation";
import { FormError } from "./ui";
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
  return `${day}, ${romeLocal(slot.start).slice(11)}–${romeLocal(slot.end).slice(11)}: ${availabilitySlotCount(slot)} slot da ${durationLabel(slotDurationMinutes(slot))}`;
};
export function AvailabilityCalendar() {
  const state = useCrm(),
    viewer = useViewer(),
    now = useClock();
  const member = state.admins.find((admin) =>
    viewer ? admin.id === viewer.recordId : admin.role === "owner",
  );
  const [week, setWeek] = useState(() => weekStart(todayRome()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<AvailabilitySelection | null>(null);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [scrollHour, setScrollHour] = useState(7);
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
  const lessons = (state.lessons ?? [])
    .filter(
      (lesson) =>
        (showCancelled || !lesson.cancelled) &&
        days.includes(romeLocal(lesson.startsAt).slice(0, 10)),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (!member)
    return (
      <p className="rounded-xl border p-5 text-sm text-muted-foreground">
        Il tuo account non è collegato a una scheda amministratore.
      </p>
    );
  return (
    <>
      <section
        className="overflow-hidden rounded-2xl border shadow-xs"
        aria-label="Le tue disponibilità"
      >
        <div className="space-y-5 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <WeekNavigation week={week} onChange={changeWeek} />
            <Button
              variant="outline"
              onClick={() =>
                setEditing({
                  date:
                    days.find((day) => day > todayRome()) ??
                    addDays(todayRome(), 1),
                  start: "07:00",
                  end: "08:00",
                })
              }
            >
              <CalendarPlus className="size-4" />
              Aggiungi disponibilità
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm border border-emerald-300 bg-emerald-100" />
                Le tue disponibilità
              </span>
              <span>
                {weekSlots.length} {weekSlots.length === 1 ? "fascia" : "fasce"}{" "}
                questa settimana
              </span>
              <label className="flex items-center gap-2">
                <CheckboxControl
                  checked={showCancelled}
                  onChange={(event) => setShowCancelled(event.target.checked)}
                />
                Mostra lezioni annullate
              </label>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              <label htmlFor="calendar-hour">Vai alle</label>
              <SelectControl
                id="calendar-hour"
                value={scrollHour}
                onChange={(event) => setScrollHour(Number(event.target.value))}
                className="h-8 min-w-24 rounded-lg border px-2 text-xs"
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
        <div className="border-t">
          <AvailabilityGrid
            week={week}
            slots={slots}
            lessons={lessons}
            bookings={state.bookings ?? []}
            now={now}
            scrollHour={scrollHour}
            select={setEditing}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <p>
            Tocca un orario o trascina per creare una fascia. Tocca una
            disponibilità per modificarne gli slot.
          </p>
          <span className="shrink-0 tabular-nums">
            00:00–24:00 · Europe/Rome
          </span>
        </div>
      </section>
      <div
        className={`sticky bottom-3 z-40 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 shadow-sm ${dirty ? "border-amber-200 bg-amber-50" : "bg-white"}`}
      >
        <p aria-live="polite" className="flex items-center gap-2 text-sm">
          {dirty ? (
            <>
              <span className="size-2 rounded-full bg-amber-500" />
              Modifiche non salvate
            </>
          ) : (
            <>
              <Check className="size-4 text-emerald-700" />
              {notice || "Calendario aggiornato"}
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || busy}
            onClick={() =>
              setDiscardAction(() => () => {
                setDraft(null);
                setNotice("");
              })
            }
          >
            <RotateCcw className="size-3.5" />
            Annulla
          </Button>
          <Button
            size="sm"
            disabled={!dirty || busy}
            onClick={() => {
              setError("");
              setConfirming(true);
            }}
          >
            Salva calendario
          </Button>
        </div>
      </div>
      {!confirming && <FormError message={error} />}
      {editing && (
        <AvailabilityEditor
          selection={editing}
          close={() => setEditing(null)}
          apply={apply}
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
