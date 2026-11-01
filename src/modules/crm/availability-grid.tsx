"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./calendar-styles";
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
const rowHeight = 32;
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
      className={styles.scroll}
      aria-label="Calendario disponibilità, tutte le 24 ore"
      tabIndex={0}
    >
      <div
        className={`${styles.dayHeader} grid grid-cols-7 md:grid-cols-[64px_repeat(7,minmax(0,1fr))]`}
      >
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
            className={styles.day}
          >
            <span className="capitalize text-muted-foreground">
              {calendarDayLabel(day, { weekday: "short" })}
            </span>
            <span
              className={`${styles.dayNumber} ${day === todayRome() ? styles.today : ""}`}
            >
              {calendarDayLabel(day, { day: "numeric" })}
            </span>
          </button>
        ))}
      </div>
      {lessons.length > 0 && (
        <div
          className={`${styles.lessons} grid grid-cols-[64px_minmax(0,1fr)] md:grid-cols-[64px_repeat(7,minmax(0,1fr))]`}
        >
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
                    className={`${styles.lessonLink} ${lesson.cancelled ? "line-through" : ""}`}
                  >
                    <span className="block font-medium break-words">
                      {lesson.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] opacity-80">
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
      <div className="grid grid-cols-[64px_minmax(0,1fr)] md:grid-cols-[64px_repeat(7,minmax(0,1fr))]">
        <div className={styles.axis} aria-hidden="true">
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              style={{ height: rowHeight * 2 }}
              className={styles.hour}
            >
              <span>{clockLabel(hour * 60)}</span>
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
              className={`${styles.column} ${dayIndex !== selectedDay ? "hidden md:block" : ""}`}
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
                    className={styles.cell}
                    data-half={index % 2 === 1}
                    data-selected={selected}
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
                    }}
                    className={`${styles.event} ${to - from < 60 ? styles.compactEvent : ""}`}
                  >
                    {to - from >= 30 && (
                      <span className={styles.eventTime}>
                        {clockLabel(from)}–{clockLabel(to)}
                      </span>
                    )}
                    {to - from >= 60 && (
                      <span className={styles.eventDetail}>
                        {availabilitySlotCount(slot)} slot ·{" "}
                        {durationLabel(duration)}
                      </span>
                    )}
                  </button>
                );
              })}
              {day === romeLocal(new Date(now).toISOString()).slice(0, 10) && (
                <div
                  aria-hidden="true"
                  className={styles.now}
                  style={{
                    top:
                      (minutesAt(new Date(now).toISOString()) / 30) * rowHeight,
                  }}
                >
                  <span />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
