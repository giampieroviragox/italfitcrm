"use client";
import { useEffect, useRef, useState } from "react";
import { addDays, romeLocal, romeToIso, todayRome } from "./fitness-logic";
import {
  availabilitySlotCount,
  slotDurationMinutes,
  type AvailabilitySlot,
} from "./availability";
import {
  clockLabel,
  durationLabel,
  selectionForPeriod,
  type AvailabilitySelection,
} from "./availability-time";
import type { Lesson, LessonBooking } from "./fitness-model";
import Link from "next/link";

export const calendarDayLabel = (
  day: string,
  options: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    ...options,
  }).format(new Date(day + "T12:00:00Z"));
const rowHeight = 28;
const minutesAt = (iso: string) => {
  const local = romeLocal(iso).slice(11);
  return Number(local.slice(0, 2)) * 60 + Number(local.slice(3));
};
function safeTime(day: string, minutes: number) {
  try {
    return Date.parse(romeToIso(`${day}T${clockLabel(minutes)}`));
  } catch {
    return null;
  }
}
interface Drag {
  day: string;
  from: number;
  to: number;
}
export function AvailabilityGrid({
  week,
  slots,
  lessons,
  bookings,
  now,
  scrollHour,
  select,
}: {
  week: string;
  slots: AvailabilitySlot[];
  lessons: Lesson[];
  bookings: LessonBooking[];
  now: number;
  scrollHour: number;
  select: (selection: AvailabilitySelection) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  useEffect(() => {
    scroll.current?.scrollTo({
      top: scrollHour * rowHeight * 2,
      behavior: "instant",
    });
  }, [scrollHour]);
  useEffect(() => {
    if (!drag) return;
    const finish = () => {
      const from = Math.min(drag.from, drag.to) * 30;
      const to = Math.min(
        1440,
        (Math.max(drag.from, drag.to) + (drag.from === drag.to ? 2 : 1)) * 30,
      );
      setDrag(null);
      select({ date: drag.day, start: clockLabel(from), end: clockLabel(to) });
    };
    const cancel = () => setDrag(null);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  });
  return (
    <div
      ref={scroll}
      data-calendar-scroll
      className="relative isolate max-h-[min(680px,70dvh)] min-h-80 overflow-auto overscroll-contain rounded-b-2xl bg-white"
      aria-label="Calendario disponibilità, tutte le 24 ore"
      tabIndex={0}
    >
      <div className="sticky top-0 z-30 grid grid-cols-7 border-b bg-white/95 backdrop-blur-md md:grid-cols-[52px_repeat(7,minmax(0,1fr))]">
        <div className="hidden items-center justify-center text-[10px] text-muted-foreground md:flex">
          Roma
        </div>
        {days.map((day, index) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(index)}
            aria-label={calendarDayLabel(day, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            aria-pressed={index === selectedDay}
            className={`flex min-h-19 flex-col items-center justify-center gap-1 border-l px-1 py-3 text-xs transition-colors hover:bg-muted/60 ${index === selectedDay ? "bg-muted/60 md:bg-transparent" : ""}`}
          >
            <span className="capitalize text-muted-foreground">
              {calendarDayLabel(day, { weekday: "short" })}
            </span>
            <span
              className={`flex size-8 items-center justify-center rounded-full text-base font-semibold ${day === todayRome() ? "bg-foreground text-white" : ""}`}
            >
              {calendarDayLabel(day, { day: "numeric" })}
            </span>
          </button>
        ))}
      </div>
      {lessons.length > 0 && (
        <div className="grid grid-cols-[52px_minmax(0,1fr)] border-b bg-muted/15 md:grid-cols-[52px_repeat(7,minmax(0,1fr))]">
          <p className="px-1 py-3 text-[10px] text-muted-foreground">Lezioni</p>
          {days.map((day, index) => (
            <div
              key={day}
              className={`space-y-1.5 border-l p-2 ${index !== selectedDay ? "hidden md:block" : ""}`}
            >
              {lessons
                .filter((lesson) => romeLocal(lesson.startsAt).startsWith(day))
                .map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/admin/lezioni/${encodeURIComponent(lesson.id)}`}
                    className={`block rounded-lg border bg-white px-2 py-2 text-xs hover:bg-muted ${lesson.cancelled ? "text-red-700" : ""}`}
                  >
                    <span className="block font-medium break-words">
                      {lesson.title}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {romeLocal(lesson.startsAt).slice(11)} ·{" "}
                      {lesson.cancelled
                        ? "Annullata"
                        : `${bookings.filter((b) => b.lessonId === lesson.id && !b.cancelled).length}/${lesson.capacity} iscritti`}
                    </span>
                  </Link>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[52px_minmax(0,1fr)] md:grid-cols-[52px_repeat(7,minmax(0,1fr))]">
        <div className="relative bg-white" aria-hidden="true">
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              style={{ height: rowHeight * 2 }}
              className="pr-2 pt-1 text-right text-[10px] tabular-nums text-muted-foreground"
            >
              {clockLabel(hour * 60)}
            </div>
          ))}
          <span className="absolute right-2 bottom-0 text-[10px] text-muted-foreground">
            24:00
          </span>
        </div>
        {days.map((day, dayIndex) => {
          const daySlots = slots.filter(
            (slot) =>
              romeLocal(slot.start).slice(0, 10) <= day &&
              romeLocal(slot.end).slice(0, 10) >= day,
          );
          return (
            <div
              key={day}
              className={`relative border-l ${dayIndex !== selectedDay ? "hidden md:block" : ""}`}
            >
              {Array.from({ length: 48 }, (_, index) => {
                const at = safeTime(day, index * 30);
                const past = at === null || at <= now;
                const selected =
                  drag?.day === day &&
                  index >= Math.min(drag.from, drag.to) &&
                  index <= Math.max(drag.from, drag.to);
                return (
                  <button
                    type="button"
                    key={index}
                    disabled={past}
                    aria-label={`${calendarDayLabel(day, { weekday: "long", day: "numeric", month: "long" })}, ${clockLabel(index * 30)}`}
                    onPointerDown={(event) => {
                      if (event.button === 0 && event.pointerType !== "touch") {
                        event.preventDefault();
                        setDrag({ day, from: index, to: index });
                      }
                    }}
                    onPointerEnter={() => {
                      if (drag?.day === day) setDrag({ ...drag, to: index });
                    }}
                    onClick={(event) => {
                      if (
                        event.detail === 0 ||
                        (event.nativeEvent as PointerEvent).pointerType ===
                          "touch"
                      )
                        select({
                          date: day,
                          start: clockLabel(index * 30),
                          end: clockLabel(Math.min(1440, index * 30 + 60)),
                        });
                    }}
                    style={{ height: rowHeight }}
                    className={`block w-full border-t outline-none focus-visible:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-inset ${index % 2 ? "border-dashed border-border/50" : "border-border/80"} ${selected ? "bg-emerald-100" : past ? "bg-muted/35" : "hover:bg-emerald-50"}`}
                  />
                );
              })}
              {daySlots.map((slot) => {
                const startDay = romeLocal(slot.start).slice(0, 10),
                  endDay = romeLocal(slot.end).slice(0, 10);
                const from = startDay < day ? 0 : minutesAt(slot.start),
                  to = endDay > day ? 1440 : minutesAt(slot.end);
                if (to <= from) return null;
                const duration = slotDurationMinutes(slot);
                const label = `${clockLabel(from)}–${clockLabel(to)}, ${availabilitySlotCount(slot)} slot da ${durationLabel(duration)}`;
                return (
                  <button
                    type="button"
                    key={slot.start}
                    title={label}
                    aria-label={`Modifica disponibilità ${label}`}
                    disabled={Date.parse(slot.end) <= now}
                    onClick={() => select(selectionForPeriod(slot))}
                    style={{
                      top: (from / 30) * rowHeight,
                      height: ((to - from) / 30) * rowHeight,
                      backgroundSize: `100% ${(duration / 30) * rowHeight}px`,
                      backgroundImage:
                        "linear-gradient(to bottom, transparent calc(100% - 1px), #a7d5c0 calc(100% - 1px))",
                    }}
                    className="absolute right-1 left-1 overflow-hidden rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-left text-emerald-950 shadow-xs transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"
                  >
                    {to - from >= 30 && (
                      <>
                        <span className="block text-[11px] font-semibold tabular-nums">
                          {clockLabel(from)}–{clockLabel(to)}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-4">
                          {availabilitySlotCount(slot)} slot ·{" "}
                          {durationLabel(duration)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
              {day === romeLocal(new Date(now).toISOString()).slice(0, 10) && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 left-0 z-10 border-t border-rose-400"
                  style={{
                    top:
                      (minutesAt(new Date(now).toISOString()) / 30) * rowHeight,
                  }}
                >
                  <span className="absolute -top-1 -left-1 size-2 rounded-full bg-rose-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
