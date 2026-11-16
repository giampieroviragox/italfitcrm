"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./calendar-styles";
import { addDays, romeLocal, romeToIso, todayRome } from "./fitness-logic";
import { availabilityCapacity, type AvailabilitySlot } from "./availability";
import {
  clockLabel,
  selectionForPeriod,
  type AvailabilitySelection,
} from "./availability-time";
import type { Lesson, LessonBooking } from "./fitness-model";
import Link from "next/link";
import { placeCalendarItems } from "./calendar-layout";

export const calendarDayLabel = (
  day: string,
  options: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    ...options,
  }).format(new Date(day + "T12:00:00Z"));
const rowHeight = 30;
function dayMinute(local: string, day: string) {
  const date = local.slice(0, 10);
  if (date < day) return 0;
  if (date > day) return 1440;
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14));
}
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
  daily,
  showDay,
  select,
}: {
  week: string;
  slots: AvailabilitySlot[];
  lessons: Lesson[];
  bookings: LessonBooking[];
  now: number;
  scrollHour: number;
  daily: boolean;
  showDay: () => void;
  select: (selection: AvailabilitySelection) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const today = todayRome();
  const [selectedDay, setSelectedDay] = useState(() => {
    const index = Array.from({ length: 7 }, (_, day) =>
      addDays(week, day),
    ).indexOf(today);
    return Math.max(0, index);
  });
  const [drag, setDrag] = useState<Drag | null>(null);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = addDays(week, index);
        return {
          day,
          label: calendarDayLabel(day, {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          cells: Array.from({ length: 48 }, (_, cell) =>
            safeTime(day, cell * 30),
          ),
        };
      }),
    [week],
  );
  const nowLocal = romeLocal(new Date(now).toISOString());
  const intervals = [
    ...slots.map((slot) => ({
      slot,
      start: romeLocal(slot.start),
      end: romeLocal(slot.end),
    })),
    ...lessons.map((lesson) => ({
      lesson,
      start: romeLocal(lesson.startsAt),
      end: romeLocal(
        new Date(
          Date.parse(lesson.startsAt) + lesson.durationMinutes * 60_000,
        ).toISOString(),
      ),
    })),
  ];
  const layout = daily
    ? "grid grid-cols-[54px_minmax(0,1fr)]"
    : "grid grid-cols-[54px_minmax(0,1fr)] md:grid-cols-[54px_repeat(7,minmax(0,1fr))]";
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
    <>
      <div
        className={`${styles.dayHeader} grid grid-cols-7 md:grid-cols-[54px_repeat(7,minmax(0,1fr))]`}
      >
        <div className="hidden items-center justify-center text-[10px] text-muted-foreground md:flex">
          Roma
        </div>
        {days.map(({ day, label }, index) => (
          <button
            key={day}
            type="button"
            onClick={() => {
              setSelectedDay(index);
              showDay();
            }}
            aria-label={label}
            aria-current={day === today ? "date" : undefined}
            aria-pressed={index === selectedDay}
            data-daily={daily}
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
      <div
        ref={scroll}
        data-calendar-scroll
        className={styles.scroll}
        role="region"
        aria-label="Griglia oraria di lezioni e disponibilità"
        tabIndex={0}
      >
        <div className={layout}>
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
          {days.map(({ day, label, cells }, dayIndex) => {
            const items = placeCalendarItems(
              intervals
                .map((item) => ({
                  ...item,
                  from: dayMinute(item.start, day),
                  to: dayMinute(item.end, day),
                }))
                .filter((item) => item.from < item.to),
            );
            return (
              <div
                key={day}
                className={`${styles.column} ${dayIndex === selectedDay ? "" : daily ? "hidden" : "hidden md:block"}`}
              >
                {cells.map((at, index) => {
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
                      aria-label={`${label}, ${clockLabel(index * 30)}`}
                      onPointerDown={(event) => {
                        if (
                          event.button === 0 &&
                          event.pointerType !== "touch"
                        ) {
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
                {items.map((item) => {
                  const { from, to, lane, lanes } = item;
                  const blockStyle = {
                    top: (from / 30) * rowHeight,
                    height: ((to - from) / 30) * rowHeight,
                    left: `calc(${(lane / lanes) * 100}% + 3px)`,
                    width: `max(2px, calc(${100 / lanes}% - 6px))`,
                  };
                  const time = `${clockLabel(from)}–${clockLabel(to)}`;
                  if ("lesson" in item) {
                    const { lesson } = item;
                    const occupied = bookings.filter(
                      (b) => b.lessonId === lesson.id && !b.cancelled,
                    ).length;
                    const status = lesson.cancelled
                      ? "Annullata"
                      : `${occupied}/${lesson.capacity} iscritti`;
                    const label = `${lesson.title}, ${time}, ${status}`;
                    return (
                      <Link
                        key={lesson.id}
                        href={`/admin/lezioni/${encodeURIComponent(lesson.id)}`}
                        className={`${styles.event} ${styles.lessonLink} ${to - from < 45 ? styles.compactEvent : ""}`}
                        style={blockStyle}
                        aria-label={label}
                        title={label}
                        data-cancelled={lesson.cancelled}
                      >
                        <span className={styles.eventTitle}>
                          {lesson.title}
                        </span>
                        {to - from >= 30 && (
                          <span className={styles.eventDetail}>
                            {clockLabel(from)} · {status}
                          </span>
                        )}
                      </Link>
                    );
                  }
                  const { slot } = item;
                  const count = availabilityCapacity(slot);
                  const places = `${count} ${count === 1 ? "posto" : "posti"}`;
                  const label = `${time}, ${places}`;
                  return (
                    <button
                      type="button"
                      key={slot.start}
                      title={label}
                      aria-label={`Modifica disponibilità ${label}`}
                      disabled={Date.parse(slot.end) <= now}
                      onClick={() => select(selectionForPeriod(slot))}
                      style={blockStyle}
                      className={`${styles.event} ${to - from < 60 ? styles.compactEvent : ""}`}
                    >
                      <span className={styles.eventTitle}>{time}</span>
                      {to - from >= 45 && (
                        <span className={styles.eventDetail}>{places}</span>
                      )}
                    </button>
                  );
                })}
                {day === nowLocal.slice(0, 10) && (
                  <div
                    aria-hidden="true"
                    className={styles.now}
                    style={{
                      top: (dayMinute(nowLocal, day) / 30) * rowHeight,
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
    </>
  );
}
