"use client";
import { useEffect, useRef, useState } from "react";
import { FormError } from "./ui";
import { useCrm, updateCrm, useViewer } from "./store";
import { useClock } from "./use-clock";
import { addDays, romeToIso, todayRome, weekStart } from "./fitness-logic";
import { cellMinutes, paintCells, slotCells } from "./availability";
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
    [drag, setDrag] = useState<Drag | null>(null),
    [local, setLocal] = useState<AvailabilitySlot[] | null>(null),
    [error, setError] = useState("");
  const pending = useRef(0);
  const slots = local ?? member?.availability ?? [];
  const saved = slotCells(slots);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const cellAt = (day: string, index: number) =>
    Date.parse(romeToIso(`${day}T${cellTimes[index]}`));
  const save = async (cells: number[], available: boolean) => {
    if (!member || !cells.length) return;
    setLocal(paintCells(slots, cells, available));
    pending.current += 1;
    try {
      await updateCrm((s) => ({
        ...s,
        admins: s.admins.map((a) =>
          a.id === member.id
            ? {
                ...a,
                availability: paintCells(
                  a.availability ?? [],
                  cells,
                  available,
                ),
              }
            : a,
        ),
      }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current -= 1;
      if (!pending.current) setLocal(null);
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
      void save(
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
  if (!member)
    return (
      <p className="rounded-xl border p-5 text-sm text-muted-foreground">
        Il tuo account non è collegato a una scheda amministratore.
      </p>
    );
  const isOn = (day: string, index: number, at: number) =>
    inDrag(day, index) && at >= now ? drag!.available : saved.has(at);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <WeekNavigation week={week} onChange={setWeek} />
        <p className="text-xs text-muted-foreground">
          Ogni slot dura un’ora. Trascina sul calendario per aggiungere le tue
          disponibilità; trascina su uno slot per toglierlo.
        </p>
      </div>
      <FormError message={error} />
      <div className="mt-3 overflow-x-auto rounded-2xl border">
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
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={past}
                    aria-pressed={on}
                    aria-label={`${dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}, ${label}–${endOf(index)}`}
                    onPointerDown={(e) => {
                      if (e.button === 0)
                        setDrag({
                          day,
                          from: index,
                          to: index,
                          available: !saved.has(at),
                        });
                    }}
                    onPointerEnter={() => {
                      if (drag?.day === day) setDrag({ ...drag, to: index });
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) void save([at], !saved.has(at));
                    }}
                    className={`block h-10 w-full touch-manipulation overflow-visible border-l px-1 text-left text-[10px] leading-tight whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset border-t ${startsRun ? "border-t-transparent" : on ? "border-t-primary-foreground/30" : ""} ${on ? (past ? "bg-primary/30 text-primary" : "bg-primary text-primary-foreground") : past ? "cursor-not-allowed bg-muted/40" : "cursor-pointer hover:bg-muted"}`}
                  >
                    {startsRun ? (
                      <>
                        <span className="block">{`${label}–${endOf(last)}`}</span>
                        <span className="block">{`${last - index + 1} slot`}</span>
                      </>
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
    </>
  );
}
