"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { useCrm, updateCrm, useViewer } from "./store";
import { useClock } from "./use-clock";
import {
  addDays,
  romeLocal,
  romeToIso,
  todayRome,
  weekStart,
} from "./fitness-logic";
import {
  cellMinutes,
  cellsToSlots,
  paintCells,
  slotCells,
} from "./availability";
import type { AvailabilitySlot } from "./availability";
import { WeekNavigation } from "./week-navigation";
const firstHour = 7,
  lastHour = 22;
const cellTimes = Array.from(
  { length: ((lastHour - firstHour) * 60) / cellMinutes },
  (_, i) => {
    const minutes = firstHour * 60 + i * cellMinutes;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  },
);
const endOf = (index: number) => {
  const minutes = firstHour * 60 + (index + 1) * cellMinutes;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("it-IT", options).format(
    new Date(day + "T12:00:00Z"),
  );
const romeFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", ...options });
const slotDay = romeFormat({
    weekday: "short",
    day: "numeric",
    month: "short",
  }),
  slotTime = romeFormat({ hour: "2-digit", minute: "2-digit" });
const describeSlots = (slots: AvailabilitySlot[]) =>
  slots
    .map(
      (slot) =>
        `${slotDay.format(new Date(slot.start))}, ${slotTime.format(new Date(slot.start))}–${slotTime.format(new Date(slot.end))}`,
    )
    .join("; ");
const countLabel = (count: number) =>
  count === 1 ? "1 slot" : `${count} slot`;
interface Drag {
  day: string;
  from: number;
  to: number;
  available: boolean;
}
export function AvailabilityCalendar() {
  const state = useCrm(),
    viewer = useViewer(),
    now = useClock();
  const member = state.admins.find((a) =>
    viewer ? a.id === viewer.recordId : a.role === "owner",
  );
  const [week, setWeek] = useState(() => weekStart(todayRome())),
    [discardAction, setDiscardAction] = useState<(() => void) | null>(null),
    [showCancelled, setShowCancelled] = useState(false),
    [drag, setDrag] = useState<Drag | null>(null),
    [changes, setChanges] = useState<ReadonlyMap<number, boolean>>(new Map()),
    [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const saved = slotCells(member?.availability ?? []);
  const added = [...changes].filter(([, on]) => on).map(([at]) => at),
    removed = [...changes].filter(([, on]) => !on).map(([at]) => at);
  const isAvailable = (at: number) => changes.get(at) ?? saved.has(at);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const cellAt = (day: string, index: number) =>
    Date.parse(romeToIso(`${day}T${cellTimes[index]}`));
  const paint = (cells: number[], available: boolean) => {
    if (!cells.length) return;
    const next = new Map(changes);
    for (const at of cells) {
      if (saved.has(at) === available) next.delete(at);
      else next.set(at, available);
    }
    setChanges(next);
    setNotice("");
  };
  const save = async () => {
    if (!member) return;
    setBusy(true);
    setError("");
    try {
      await updateCrm((s) => ({
        ...s,
        admins: s.admins.map((a) =>
          a.id === member.id
            ? {
                ...a,
                availability: paintCells(
                  paintCells(a.availability ?? [], added, true),
                  removed,
                  false,
                ),
              }
            : a,
        ),
      }));
      setChanges(new Map());
      setConfirming(false);
      setNotice("Disponibilità salvate.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const inDrag = (day: string, index: number) =>
    drag?.day === day &&
    index >= Math.min(drag.from, drag.to) &&
    index <= Math.max(drag.from, drag.to);
  useEffect(() => {
    if (!drag) return;
    const finish = () => {
      const low = Math.min(drag.from, drag.to),
        high = Math.max(drag.from, drag.to);
      setDrag(null);
      paint(
        Array.from({ length: high - low + 1 }, (_, i) =>
          cellAt(drag.day, low + i),
        ).filter((at) => at >= now),
        drag.available,
      );
    };
    const cancel = () => setDrag(null);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  });
  const dirty = changes.size > 0;
  useUnsavedChanges(dirty, () => setChanges(new Map()));
  const changeWeek = (next: string) => {
    if (next === week) return;
    const change = () => {
      setChanges(new Map());
      setDrag(null);
      setNotice("");
      setWeek(next);
    };
    if (dirty) setDiscardAction(() => change);
    else change();
  };
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
  const isOn = (day: string, index: number, at: number) =>
    inDrag(day, index) && at >= now ? drag!.available : isAvailable(at);
  const summary = [
    added.length ? `${countLabel(added.length)} da aggiungere` : "",
    removed.length ? `${countLabel(removed.length)} da togliere` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const description = [
    added.length
      ? `Aggiungi ${countLabel(added.length)}: ${describeSlots(cellsToSlots(added))}.`
      : "",
    removed.length
      ? `Togli ${countLabel(removed.length)}: ${describeSlots(cellsToSlots(removed))}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <WeekNavigation week={week} onChange={changeWeek} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckboxControl
            checked={showCancelled}
            onChange={(event) => setShowCancelled(event.target.checked)}
          />
          Mostra lezioni annullate
        </label>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
          Le tue disponibilità
        </p>
        <p className="text-xs text-muted-foreground">
          Ogni slot dura un’ora. Tocca o trascina sul calendario per aggiungere
          le tue disponibilità; fai lo stesso su uno slot per toglierlo. Le
          modifiche valgono solo dopo il salvataggio.
        </p>
      </div>
      <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3">
        <p aria-live="polite" className="text-sm">
          {dirty
            ? `Da salvare: ${summary}.`
            : notice || "Nessuna modifica da salvare."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty}
            onClick={() => {
              setDiscardAction(() => () => {
                setChanges(new Map());
                setNotice("");
              });
            }}
          >
            Annulla modifiche
          </Button>
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() => {
              setError("");
              setConfirming(true);
            }}
          >
            Salva
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border">
        <div
          className="grid min-w-[640px] select-none"
          style={{ gridTemplateColumns: "52px repeat(7, minmax(0, 1fr))" }}
        >
          <div className="border-b" />
          {days.map((day) => (
            <div
              key={day}
              className={`border-b border-l px-1 py-2 text-center text-xs ${day === todayRome() ? "font-semibold" : "text-muted-foreground"}`}
            >
              <span className="capitalize">
                {dayLabel(day, { weekday: "short" })}
              </span>{" "}
              {dayLabel(day, { day: "numeric" })}
            </div>
          ))}
          {lessons.length > 0 && (
            <>
              <div className="border-b px-1 py-3 text-[10px] text-muted-foreground">
                Lezioni
              </div>
              {days.map((day) => (
                <div key={day} className="space-y-2 border-b border-l p-1.5">
                  {lessons
                    .filter((lesson) =>
                      romeLocal(lesson.startsAt).startsWith(day),
                    )
                    .map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={`/admin/lezioni/${encodeURIComponent(lesson.id)}`}
                        className={`block rounded-lg border p-2 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 ${lesson.cancelled ? "border-red-200 bg-red-50 text-red-700" : "bg-muted/50"}`}
                      >
                        <span className="block font-medium break-words">
                          {lesson.title}
                        </span>
                        <span className="mt-1 block">
                          {slotTime.format(new Date(lesson.startsAt))} ·{" "}
                          {lesson.durationMinutes} min
                        </span>
                        <span className="mt-1 block break-words">
                          {lesson.coach} · {lesson.location}
                        </span>
                        <span className="mt-1 block">
                          {lesson.cancelled
                            ? "Annullata"
                            : `${(state.bookings ?? []).filter((booking) => booking.lessonId === lesson.id && !booking.cancelled).length}/${lesson.capacity} iscritti`}
                        </span>
                      </Link>
                    ))}
                </div>
              ))}
            </>
          )}
          <div>
            {cellTimes.map((label) => (
              <div
                key={label}
                className="h-10 pr-2 text-right text-[10px] leading-none text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day}>
              {cellTimes.map((label, index) => {
                const at = cellAt(day, index),
                  past = at < now,
                  on = isOn(day, index, at),
                  pending = changes.has(at),
                  toRemove = changes.get(at) === false && !on,
                  startsRun =
                    on &&
                    (index === 0 ||
                      !isOn(day, index - 1, cellAt(day, index - 1)));
                let last = index;
                if (startsRun)
                  while (
                    last + 1 < cellTimes.length &&
                    isOn(day, last + 1, cellAt(day, last + 1))
                  )
                    last += 1;
                const status = toRemove
                  ? ", da togliere"
                  : on && pending
                    ? ", da aggiungere"
                    : on
                      ? ", disponibile"
                      : "";
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={past}
                    aria-pressed={on}
                    aria-label={`${dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}, ${label}–${endOf(index)}${status}`}
                    onPointerDown={(e) => {
                      if (e.button === 0)
                        setDrag({
                          day,
                          from: index,
                          to: index,
                          available: !isAvailable(at),
                        });
                    }}
                    onPointerEnter={() => {
                      if (drag?.day === day) setDrag({ ...drag, to: index });
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) paint([at], !isAvailable(at));
                    }}
                    className={`block h-10 w-full touch-manipulation overflow-visible border-l px-1 text-left text-[10px] leading-tight whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset border-t ${startsRun ? "border-t-transparent" : on ? "border-t-primary-foreground/30" : ""} ${toRemove ? "cursor-pointer bg-red-50 text-red-700 line-through hover:bg-red-100" : on ? (past ? "bg-primary/30 text-primary" : pending ? "cursor-pointer bg-primary/70 text-primary-foreground" : "cursor-pointer bg-primary text-primary-foreground") : past ? "cursor-not-allowed bg-muted/40" : "cursor-pointer hover:bg-muted"}`}
                  >
                    {startsRun ? (
                      <>
                        <span className="block">{`${label}–${endOf(last)}`}</span>
                        <span className="block">
                          {countLabel(last - index + 1)}
                        </span>
                      </>
                    ) : toRemove ? (
                      `${label}–${endOf(index)}`
                    ) : (
                      ""
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
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
        title="Salvare le disponibilità?"
        description={description}
        confirmLabel="Conferma e salva"
        busy={busy}
        error={error}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void save()}
      />
    </>
  );
}
