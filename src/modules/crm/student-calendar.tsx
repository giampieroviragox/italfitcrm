"use client";
import { useState } from "react";
import styles from "./calendar-styles";
import {
  Check,
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
      ) ?? days[0]);
  const mine = upcoming.filter(
    (lesson) => lesson.enrolled && !lesson.cancelled,
  );
  const nextLesson = mine[0];
  const selected = data.lessons.find((lesson) => lesson.id === selectedId);
  const blocked = (lesson: StudentLesson) =>
    lesson.cancelled ||
    (!lesson.enrolled &&
      (lesson.occupied >= lesson.capacity || Boolean(lesson.restriction)));
  const status = (lesson: StudentLesson) =>
    lesson.cancelled
      ? "Annullata"
      : lesson.enrolled
        ? "Prenotata"
        : lesson.occupied >= lesson.capacity
          ? "Completa"
          : `${lesson.capacity - lesson.occupied} ${lesson.capacity - lesson.occupied === 1 ? "posto libero" : "posti liberi"}`;
  const act = async (cancelled: boolean) => {
    if (selected && (await onChange(selected.id, cancelled))) {
      setCancelling(false);
      setSelectedId(null);
    }
  };
  return (
    <section aria-label="Calendario studente" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Il tuo calendario
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-muted-foreground">
            {data.services.lessons
              ? "Scegli il giorno e prenota il tuo prossimo allenamento."
              : "Consulta e gestisci le prenotazioni già confermate."}
          </p>
        </div>
        {refresh && (
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(pending) || refreshing}
            onClick={refresh}
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>{refreshing ? "Aggiornamento…" : "Aggiorna"}</span>
          </Button>
        )}
      </div>
      {nextLesson && (
        <button
          type="button"
          onClick={() => setSelectedId(nextLesson.id)}
          className={styles.nextLesson}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-[#617569]">
              Il prossimo allenamento
            </span>
            <span className="mt-0.5 block text-sm font-medium">
              {nextLesson.title}
            </span>
            <span className="mt-0.5 block text-xs leading-5">
              {dateLabel(romeLocal(nextLesson.startsAt).slice(0, 10), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              · {timeLabel(nextLesson.startsAt)}
            </span>
          </span>
          <Check className="size-5 shrink-0" />
        </button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={styles.filters} aria-label="Filtra calendario">
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={!onlyMine}
            className={styles.filter}
            onClick={() => setOnlyMine(false)}
          >
            Tutti gli orari
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={onlyMine}
            className={styles.filter}
            onClick={() => setOnlyMine(true)}
          >
            <span className="sm:hidden">Le mie · {mine.length}</span>
            <span className="hidden sm:inline">
              Le mie prenotazioni · {mine.length}
            </span>
          </Button>
        </div>
        {data.services.monthlyBookingLimit !== null && (
          <p className="text-xs text-muted-foreground">
            Il tuo percorso: fino a {data.services.monthlyBookingLimit} lezioni
            al mese
          </p>
        )}
      </div>
      <div className={styles.surface}>
        <div className={styles.toolbar}>
          <WeekNavigation week={week} onChange={setWeek} />
          <span className="text-[11px] text-muted-foreground">
            Orari di Roma
          </span>
        </div>
        <div className={styles.studentHeader}>
          {days.map((day) => {
            const count = filtered.filter((lesson) =>
              romeLocal(lesson.startsAt).startsWith(day),
            ).length;
            return (
              <button
                key={day}
                type="button"
                aria-label={dateLabel(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                aria-pressed={day === activeDay}
                onClick={() => setSelectedDay(day)}
                className={`${styles.day} ${styles.studentDay}`}
              >
                <span className="capitalize text-muted-foreground">
                  {dateLabel(day, { weekday: "short" })}
                </span>
                <span
                  className={`${styles.dayNumber} ${day === todayRome() ? styles.today : ""}`}
                >
                  {dateLabel(day, { day: "numeric" })}
                </span>
                <span
                  className={`size-1 rounded-full ${count ? "bg-[#44765c]" : "bg-transparent"}`}
                  aria-label={`${count} lezioni`}
                />
              </button>
            );
          })}
        </div>
        <div className={styles.studentColumns}>
          {days.map((day) => {
            const lessons = filtered.filter((lesson) =>
              romeLocal(lesson.startsAt).startsWith(day),
            );
            return (
              <div
                key={day}
                className={styles.studentColumn}
                data-hidden={day !== activeDay}
              >
                <h3 className="mb-3 text-xs font-medium capitalize text-[#67736a] md:sr-only">
                  {dateLabel(day, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                {lessons.map((lesson) => (
                  <button
                    type="button"
                    key={lesson.id}
                    onClick={() => setSelectedId(lesson.id)}
                    aria-label={`${lesson.title}, ${timeLabel(lesson.startsAt)}, ${status(lesson)}`}
                    className={styles.studentSlot}
                    data-enrolled={lesson.enrolled && !lesson.cancelled}
                    data-cancelled={lesson.cancelled}
                  >
                    <span className={styles.slotTime}>
                      {timeLabel(lesson.startsAt)}
                      <span className={styles.slotDuration}>
                        {lesson.durationMinutes} min
                      </span>
                    </span>
                    <span className="block min-w-0 flex-1">
                      <span className={styles.slotTitle}>{lesson.title}</span>
                      <span className={styles.slotCoach}>{lesson.coach}</span>
                      <span className={styles.slotStatus}>
                        {status(lesson)}
                      </span>
                    </span>
                  </button>
                ))}
                {!lessons.length && (
                  <div className={styles.emptyDay}>
                    <span
                      className="hidden md:inline"
                      aria-label={
                        onlyMine ? "Nessuna prenotazione" : "Nessuna lezione"
                      }
                    >
                      —
                    </span>
                    <p className="md:hidden">
                      {onlyMine
                        ? "Nessuna prenotazione per questo giorno."
                        : "Nessuna lezione per questo giorno."}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!filtered.length && (
        <p className="text-sm leading-6 text-muted-foreground">
          {onlyMine
            ? "Non hai ancora prenotazioni. Scegli una lezione dal calendario."
            : "Il team pubblicherà qui i prossimi orari disponibili."}
        </p>
      )}
      {selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open && !pending) setSelectedId(null);
          }}
        >
          <SheetContent
            side="center"
            className="w-[calc(100%-32px)] max-w-md gap-0 overflow-hidden rounded-xl p-0"
          >
            <SheetHeader className="gap-2 border-b px-6 pt-6 pb-5">
              <p className="text-[11px] font-medium text-[#426a4e]">
                {status(selected)}
              </p>
              <SheetTitle className="pr-6 text-lg leading-6">
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
                    value: `${timeLabel(selected.startsAt)} · ${selected.durationMinutes} min`,
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
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <item.icon className="size-3.5" />
                      {item.label}
                    </p>
                    <p className="mt-1.5 text-sm font-medium break-words">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              {!selected.enrolled && selected.restriction && (
                <p className="rounded-lg bg-muted p-3 text-xs leading-5">
                  {selected.restriction}
                </p>
              )}
              <FormError message={error} />
              <Button
                className="min-h-11 w-full"
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
                      ? "Annulla prenotazione"
                      : selected.occupied >= selected.capacity
                        ? "Lezione completa"
                        : selected.restriction
                          ? "Non disponibile per il percorso"
                          : "Conferma prenotazione"}
              </Button>
              <p className="text-center text-[11px] leading-5 text-muted-foreground">
                La prenotazione è confermata solo dopo il salvataggio.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      )}
      <ConfirmDialog
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
