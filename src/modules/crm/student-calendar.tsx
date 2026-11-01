"use client";
import { useState } from "react";
import {
  CalendarDays,
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
      (lesson.occupied >= lesson.capacity ||
        data.student.status !== "active" ||
        Boolean(lesson.restriction)));
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
    <section aria-label="Calendario studente" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Il tuo calendario
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
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
          className="flex w-full items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-emerald-950 transition-colors hover:bg-emerald-100 sm:p-5"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white">
            <CalendarDays className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-emerald-800">
              Il prossimo allenamento
            </span>
            <span className="mt-1 block font-semibold">{nextLesson.title}</span>
            <span className="mt-1 block text-xs leading-5">
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
        <div
          className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 sm:inline-flex sm:w-auto"
          aria-label="Filtra calendario"
        >
          <Button
            size="sm"
            variant={!onlyMine ? "outline" : "ghost"}
            aria-pressed={!onlyMine}
            className={!onlyMine ? "bg-white shadow-xs" : ""}
            onClick={() => setOnlyMine(false)}
          >
            Tutti gli orari
          </Button>
          <Button
            size="sm"
            variant={onlyMine ? "outline" : "ghost"}
            aria-pressed={onlyMine}
            className={onlyMine ? "bg-white shadow-xs" : ""}
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
      <div className="overflow-hidden rounded-2xl border bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:px-5">
          <WeekNavigation week={week} onChange={setWeek} />
          <span className="text-[11px] text-muted-foreground">
            Orari di Roma
          </span>
        </div>
        <div className="grid grid-cols-7 border-b bg-muted/20">
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
                className={`flex min-h-24 flex-col items-center gap-1.5 border-r py-3 text-xs last:border-r-0 ${day === activeDay ? "bg-muted/70 md:bg-transparent" : "hover:bg-muted/50"}`}
              >
                <span className="capitalize text-muted-foreground">
                  {dateLabel(day, { weekday: "short" })}
                </span>
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-base font-semibold ${day === todayRome() ? "bg-foreground text-white" : ""}`}
                >
                  {dateLabel(day, { day: "numeric" })}
                </span>
                <span
                  className={`size-1 rounded-full ${count ? "bg-emerald-600" : "bg-transparent"}`}
                  aria-label={`${count} lezioni`}
                />
              </button>
            );
          })}
        </div>
        <div className="grid md:min-h-80 md:grid-cols-7">
          {days.map((day) => {
            const lessons = filtered.filter((lesson) =>
              romeLocal(lesson.startsAt).startsWith(day),
            );
            return (
              <div
                key={day}
                className={`min-w-0 space-y-2 p-3 md:border-r md:p-2 md:last:border-r-0 ${day === activeDay ? "" : "hidden md:block"}`}
              >
                <h3 className="px-1 py-2 text-sm font-medium capitalize md:sr-only">
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
                    className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 md:block md:p-3 ${lesson.enrolled && !lesson.cancelled ? "border-emerald-200 bg-emerald-50" : lesson.cancelled ? "bg-muted/50 text-muted-foreground" : "bg-white"}`}
                  >
                    <span className="block shrink-0 text-lg font-semibold tabular-nums md:text-sm">
                      {timeLabel(lesson.startsAt)}
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        {lesson.durationMinutes} min
                      </span>
                    </span>
                    <span className="block min-w-0 flex-1 md:mt-3">
                      <span className="block text-sm font-medium break-words md:text-xs">
                        {lesson.title}
                      </span>
                      <span className="mt-1.5 block text-xs text-muted-foreground md:text-[11px]">
                        {lesson.coach}
                      </span>
                      <span
                        className={`mt-3 inline-block rounded-md px-1.5 py-1 text-[10px] font-medium ${lesson.enrolled ? "bg-emerald-100 text-emerald-900" : lesson.occupied >= lesson.capacity || lesson.cancelled ? "bg-muted text-muted-foreground" : "bg-emerald-50 text-emerald-800"}`}
                      >
                        {status(lesson)}
                      </span>
                    </span>
                  </button>
                ))}
                {!lessons.length && (
                  <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-4 text-center md:min-h-32 md:px-1">
                    <CalendarDays className="size-5 text-muted-foreground/50 md:hidden" />
                    <p className="text-xs leading-5 text-muted-foreground">
                      {onlyMine ? "Nessuna prenotazione" : "Nessuna lezione"}
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
      {data.student.status !== "active" && (
        <p className="text-xs leading-5 text-muted-foreground">
          Potrai prenotare quando il team attiverà il tuo percorso.
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
            className="w-[calc(100%-24px)] max-w-md gap-0 overflow-hidden rounded-2xl p-0"
          >
            <SheetHeader className="border-b px-6 pt-7 pb-5">
              <p className="mb-2 text-xs font-medium text-emerald-800">
                {status(selected)}
              </p>
              <SheetTitle className="pr-6 text-xl">{selected.title}</SheetTitle>
              <SheetDescription className="capitalize">
                {dateLabel(romeLocal(selected.startsAt).slice(0, 10), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
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
                        : data.student.status !== "active"
                          ? "Percorso da attivare"
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
