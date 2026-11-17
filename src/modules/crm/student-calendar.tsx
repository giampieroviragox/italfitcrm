"use client";
import { bookingWindowClosed } from "./student-booking";
import { useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "./confirm-dialog";
import { FormError } from "./ui";
import { addDays, romeLocal, todayRome, weekStart } from "./fitness-logic";
import { useClock } from "./use-clock";
import { WeekNavigation } from "./week-navigation";
import type { StudentPortalData } from "./student-portal-model";

type StudentLesson = StudentPortalData["lessons"][number];
const dateLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    ...options,
  }).format(new Date(day + "T12:00:00Z"));
const timeLabel = (iso: string) => romeLocal(iso).slice(11);
const endTimeLabel = (lesson: StudentLesson) =>
  timeLabel(
    new Date(
      Date.parse(lesson.startsAt) + lesson.durationMinutes * 60_000,
    ).toISOString(),
  );
const lessonTimeLabel = (lesson: StudentLesson) =>
  lesson.availability
    ? `${timeLabel(lesson.startsAt)}–${endTimeLabel(lesson)}`
    : timeLabel(lesson.startsAt);
export function StudentCalendar({
  data,
  pending = null,
  refreshing = false,
  error = "",
  refresh,
  onChange,
}: {
  data: StudentPortalData;
  pending?: string | null;
  refreshing?: boolean;
  error?: string;
  refresh?: () => void;
  onChange: (lessonId: string, cancelled: boolean) => Promise<boolean>;
}) {
  const now = useClock();
  const today = todayRome();
  const calendar = useRef<HTMLDivElement>(null);
  const lessonTrigger = useRef<HTMLButtonElement>(null);
  const upcoming = data.lessons
    .filter((lesson) => Date.parse(lesson.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const [week, setWeek] = useState(() =>
    weekStart(
      romeLocal(upcoming[0]?.startsAt ?? new Date(now).toISOString()).slice(
        0,
        10,
      ),
    ),
  );
  const [onlyMine, setOnlyMine] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const filtered = upcoming.filter((lesson) => !onlyMine || lesson.enrolled);
  const activeDay = days.includes(selectedDay)
    ? selectedDay
    : (days.find((day) =>
        filtered.some((lesson) => romeLocal(lesson.startsAt).startsWith(day)),
      ) ?? week);
  const dayLessons = filtered.filter((lesson) =>
    romeLocal(lesson.startsAt).startsWith(activeDay),
  );
  const mine = upcoming.filter(
    (lesson) => lesson.enrolled && !lesson.cancelled,
  );
  const nextLesson = mine[0];
  const selected = data.lessons.find((lesson) => lesson.id === selectedId);
  const blocked = (lesson: StudentLesson) =>
    lesson.cancelled ||
    (lesson.enrolled && Boolean(lesson.cancelRestriction)) ||
    (!lesson.enrolled &&
      (lesson.occupied >= lesson.capacity || Boolean(lesson.restriction)));
  const status = (lesson: StudentLesson) =>
    lesson.cancelled
      ? "Annullata"
      : lesson.enrolled
        ? "Prenotata"
        : lesson.occupied >= lesson.capacity
          ? "Completa"
          : lesson.restriction
            ? "Non prenotabile"
            : `${lesson.capacity - lesson.occupied} ${lesson.capacity - lesson.occupied === 1 ? "posto libero" : "posti liberi"}`;
  const act = async (cancelled: boolean) => {
    if (selected && (await onChange(selected.id, cancelled))) {
      setCancelling(false);
      setSelectedId(null);
    }
  };
  return (
    <section
      aria-label="Calendario studente"
      className="space-y-4 sm:space-y-5"
    >
      {nextLesson && (
        <button
          type="button"
          onClick={(event) => {
            lessonTrigger.current = event.currentTarget;
            setSelectedId(nextLesson.id);
          }}
          className="group flex w-full items-center gap-3 rounded-3xl border bg-card p-4 text-left transition-colors hover:border-primary/60 sm:gap-4 sm:p-5"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-[var(--workspace-accent)]">
            <Check className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">
              Prossima lezione prenotata
            </span>
            <span className="block text-lg font-semibold tracking-tight">
              {nextLesson.title}
            </span>
            <span className="block text-sm text-muted-foreground">
              {dateLabel(romeLocal(nextLesson.startsAt).slice(0, 10), {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              {" · "}
              {lessonTimeLabel(nextLesson)}
            </span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-[var(--workspace-accent)] transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtra calendario"
          className="inline-flex max-w-full gap-1 rounded-full border bg-card p-1"
        >
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={!onlyMine}
            className="min-h-10 rounded-full px-3 aria-pressed:bg-muted aria-pressed:text-foreground"
            onClick={() => {
              setOnlyMine(false);
              setSelectedDay("");
            }}
          >
            Tutti gli orari
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={onlyMine}
            className="min-h-10 rounded-full px-3 aria-pressed:bg-muted aria-pressed:text-foreground"
            onClick={() => {
              setOnlyMine(true);
              setSelectedDay("");
            }}
          >
            <span className="sm:hidden">Le mie · {mine.length}</span>
            <span className="hidden sm:inline">
              Le mie prenotazioni · {mine.length}
            </span>
          </Button>
        </div>
        {refresh && (
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full text-muted-foreground"
            aria-label={refreshing ? "Aggiornamento…" : "Aggiorna orari"}
            title="Aggiorna orari"
            disabled={Boolean(pending) || refreshing}
            onClick={refresh}
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
          </Button>
        )}
      </div>
      <div
        ref={calendar}
        tabIndex={-1}
        className="rounded-3xl border bg-card p-3 sm:p-6"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <WeekNavigation week={week} onChange={setWeek} />
          {data.services.monthlyBookingLimit !== null && (
            <p className="px-1 text-xs text-muted-foreground">
              Fino a {data.services.monthlyBookingLimit} lezioni al mese
            </p>
          )}
        </div>
        <div
          role="group"
          aria-label="Giorni della settimana"
          className="grid grid-cols-7 gap-1 sm:gap-2"
        >
          {days.map((day) => {
            const count = filtered.filter((lesson) =>
              romeLocal(lesson.startsAt).startsWith(day),
            ).length;
            return (
              <button
                key={day}
                type="button"
                aria-label={`${dateLabel(day, { weekday: "long", day: "numeric", month: "long" })}, ${count} ${count === 1 ? "lezione" : "lezioni"}`}
                aria-current={day === today ? "date" : undefined}
                aria-pressed={day === activeDay}
                onClick={() => setSelectedDay(day)}
                className="group flex min-h-[70px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border bg-background py-2 transition-colors hover:bg-muted aria-[current=date]:border-primary/60 aria-pressed:border-[var(--border-hover)] aria-pressed:bg-muted aria-pressed:text-foreground sm:min-h-[82px] sm:rounded-2xl"
              >
                <span className="text-xs capitalize text-muted-foreground group-aria-pressed:text-foreground">
                  {dateLabel(day, { weekday: "short" })}
                </span>
                <span className="text-lg leading-tight font-bold tabular-nums sm:text-xl">
                  {dateLabel(day, { day: "numeric" })}
                </span>
                <span
                  className={
                    count ? "size-1 rounded-full bg-primary" : "size-1"
                  }
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>
      <div
        key={activeDay}
        className="space-y-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="text-xl font-bold tracking-tight first-letter:uppercase sm:text-2xl">
            {dateLabel(activeDay, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <span className="text-xs text-muted-foreground">Orari di Roma</span>
        </div>
        {dayLessons.length ? (
          <ul className="space-y-2">
            {dayLessons.map((lesson) => (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={(event) => {
                    lessonTrigger.current = event.currentTarget;
                    setSelectedId(lesson.id);
                  }}
                  aria-label={`${lesson.title}, ${lessonTimeLabel(lesson)}, ${status(lesson)}`}
                  className="group grid w-full grid-cols-[3.4rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl border bg-card p-3 text-left transition-colors hover:border-primary/55 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto_auto] sm:gap-x-5 sm:px-5 sm:py-4"
                >
                  <span className="row-span-2 self-start border-r pr-1 sm:row-span-1 sm:self-center sm:pr-3">
                    <span className="block text-base font-bold tracking-tight tabular-nums sm:text-xl">
                      {timeLabel(lesson.startsAt)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {lesson.availability
                        ? `– ${endTimeLabel(lesson)}`
                        : `${lesson.durationMinutes} min`}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base leading-tight font-semibold break-words">
                      {lesson.title}
                    </span>
                    <span className="mt-1 block text-xs break-words text-muted-foreground">
                      {[lesson.coach, lesson.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span
                    data-available={
                      !blocked(lesson) || (lesson.enrolled && !lesson.cancelled)
                    }
                    className="col-start-2 w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground data-[available=true]:text-foreground sm:col-start-auto"
                  >
                    {status(lesson)}
                  </span>
                  <ChevronRight
                    className="col-start-3 row-start-1 row-span-2 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:col-start-auto sm:row-span-1"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            <CalendarDays className="size-5 shrink-0" aria-hidden />
            {onlyMine
              ? "Nessuna prenotazione per questo giorno."
              : "Nessuna lezione per questo giorno."}
          </div>
        )}
      </div>
      {selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open && !pending) setSelectedId(null);
          }}
        >
          <SheetContent
            side="center"
            className="student-area dark gap-0 overflow-y-auto rounded-3xl p-0 data-[side=center]:max-w-md"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              (lessonTrigger.current?.isConnected
                ? lessonTrigger.current
                : calendar.current
              )?.focus();
            }}
          >
            <SheetHeader className="gap-1 border-b px-6 pt-6 pb-5">
              <p className="text-xs font-medium text-muted-foreground">
                {status(selected)}
              </p>
              <SheetTitle className="pr-6 text-xl leading-6 font-semibold tracking-tight">
                {selected.title}
              </SheetTitle>
              <SheetDescription className="capitalize">
                {dateLabel(romeLocal(selected.startsAt).slice(0, 10), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 p-6">
              <div className="grid grid-cols-2 gap-x-5 gap-y-6">
                {[
                  {
                    icon: Clock3,
                    label: "Orario",
                    value: `${lessonTimeLabel(selected)} · ${selected.durationMinutes} min`,
                  },
                  { icon: UserRound, label: "Coach", value: selected.coach },
                  { icon: MapPin, label: "Dove", value: selected.location },
                  {
                    icon: Users,
                    label: "Posti",
                    value: `${selected.occupied} / ${selected.capacity} occupati`,
                  },
                ].map((item) => (
                  <div key={item.label} className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <item.icon className="size-3.5" />
                      {item.label}
                    </p>
                    <p className="mt-1.5 text-sm font-medium break-words">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              {(selected.enrolled
                ? selected.cancelRestriction
                : selected.restriction) && (
                <p className="rounded-[10px] bg-muted px-3 py-2.5 text-[13px] leading-5">
                  {selected.enrolled
                    ? selected.cancelRestriction
                    : selected.restriction}
                </p>
              )}
              <FormError message={error} />
              <Button
                variant={selected.enrolled ? "outline" : "default"}
                className="min-h-11 w-full rounded-full"
                disabled={Boolean(pending) || refreshing || blocked(selected)}
                onClick={() =>
                  selected.enrolled ? setCancelling(true) : void act(false)
                }
              >
                {pending === selected.id
                  ? "Salvataggio…"
                  : selected.cancelled
                    ? "Lezione annullata"
                    : selected.enrolled
                      ? selected.cancelRestriction
                        ? "Non più annullabile"
                        : "Annulla prenotazione"
                      : selected.occupied >= selected.capacity
                        ? "Lezione completa"
                        : selected.restriction
                          ? bookingWindowClosed(selected.startsAt)
                            ? "Prenotazioni chiuse"
                            : "Non disponibile per il percorso"
                          : "Conferma prenotazione"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
      <ConfirmDialog
        className="student-area dark"
        open={cancelling}
        title="Annullare la prenotazione?"
        description="Il tuo posto sarà di nuovo disponibile. Potrai prenotare ancora se resteranno posti liberi."
        confirmLabel="Annulla prenotazione"
        busy={Boolean(pending)}
        error={error}
        onCancel={() => setCancelling(false)}
        onConfirm={() => void act(true)}
      />
    </section>
  );
}
