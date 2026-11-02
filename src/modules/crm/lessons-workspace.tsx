"use client";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useClock } from "./use-clock";
import { useState } from "react";
import { Plus, MapPin, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import {
  Editor,
  EditorCancel,
  Field,
  control,
  FormError,
  LocalNotice,
} from "./ui";
import { useCrm, updateCrm, useHydrated } from "./store";
import { todayRome, addDays, romeLocal, romeToIso } from "./fitness-logic";
import { ConfirmDialog } from "./confirm-dialog";
import type { Lesson } from "./fitness-model";
import { bookingRestriction } from "./tier-access";
import { AvailabilityCalendar } from "./availability-calendar";
export const lessonDate = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
export async function changeBooking(
  lessonId: string,
  studentId: string,
  cancelled: boolean,
) {
  await updateCrm((s) => {
    const old = s.bookings?.find(
      (b) => b.lessonId === lessonId && b.studentId === studentId,
    );
    const item = {
      id: old?.id ?? crypto.randomUUID(),
      lessonId,
      studentId,
      createdAt: old?.createdAt ?? new Date().toISOString(),
      cancelled,
    };
    return {
      ...s,
      bookings: old
        ? (s.bookings ?? []).map((b) => (b.id === old.id ? item : b))
        : [...(s.bookings ?? []), item],
    };
  });
}
function LessonEditor({
  lesson,
  close,
}: {
  lesson?: Lesson;
  close: () => void;
}) {
  const [original] = useState(JSON.stringify(lesson)),
    [error, setError] = useState("");
  return (
    <Editor
      title={lesson ? "Modifica lezione" : "Nuova lezione"}
      description="L’orario è nel fuso Europe/Rome. Coach e sala non possono avere lezioni sovrapposte."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const f = new FormData(e.currentTarget);
            const item: Lesson = {
              id: lesson?.id ?? crypto.randomUUID(),
              ...(lesson?.availability
                ? { availability: lesson.availability }
                : {}),
              title: String(f.get("title")).trim(),
              startsAt: romeToIso(String(f.get("date"))),
              durationMinutes: Number(f.get("duration")),
              capacity: Number(f.get("capacity")),
              coach: String(f.get("coach")).trim(),
              location: String(f.get("location")).trim(),
              cancelled: lesson?.cancelled ?? false,
            };
            await updateCrm((s) => {
              if (
                lesson &&
                JSON.stringify(s.lessons?.find((l) => l.id === lesson.id)) !==
                  original
              )
                throw new Error("La lezione è cambiata. Riapri il form.");
              return {
                ...s,
                lessons: lesson
                  ? (s.lessons ?? []).map((l) => (l.id === item.id ? item : l))
                  : [...(s.lessons ?? []), item],
              };
            });
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Titolo lezione *">
          <input
            className={control}
            required
            name="title"
            maxLength={120}
            defaultValue={lesson?.title}
            placeholder="Es. Functional training"
          />
        </Field>
        <LessonDateTime
          initial={
            lesson
              ? romeLocal(lesson.startsAt)
              : addDays(todayRome(), 1) + "T18:00"
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Durata (minuti) *">
            <input
              className={control}
              type="number"
              name="duration"
              required
              min={15}
              max={240}
              defaultValue={lesson?.durationMinutes ?? 60}
            />
          </Field>
          <Field label="Posti disponibili *">
            <input
              className={control}
              type="number"
              name="capacity"
              required
              min={1}
              max={200}
              defaultValue={lesson?.capacity ?? 8}
            />
          </Field>
        </div>
        <Field label="Coach *">
          <input
            className={control}
            required
            name="coach"
            defaultValue={lesson?.coach}
          />
        </Field>
        <Field label="Sala o luogo *">
          <input
            className={control}
            required
            name="location"
            defaultValue={lesson?.location ?? "Sala principale"}
          />
        </Field>
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Salva lezione</Button>
        </div>
      </form>
    </Editor>
  );
}
function LessonDateTime({ initial }: { initial: string }) {
  const [date, setDate] = useState(initial.slice(0, 10)),
    [time, setTime] = useState(initial.slice(11, 16));
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Data *">
        <DatePicker required value={date} onChange={setDate} />
      </Field>
      <Field label="Ora *">
        <TimePicker required value={time} onChange={setTime} />
      </Field>
      <input type="hidden" name="date" value={`${date}T${time}`} />
    </div>
  );
}
export function LessonsWorkspace() {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <PageHeading
        title="Calendario"
        description="Disponibilità, lezioni e prenotazioni in sede."
        action={
          <Button onClick={() => setEditing(true)}>
            <Plus className="size-4" />
            Aggiungi lezione
          </Button>
        }
      />
      <LocalNotice />
      <AvailabilityCalendar />
      {editing && <LessonEditor close={() => setEditing(false)} />}
    </>
  );
}
export function LessonDetail({ id }: { id: string }) {
  const now = useClock();
  const state = useCrm(),
    hydrated = useHydrated();
  const [editing, setEditing] = useState(false),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [studentId, setStudentId] = useState("");
  const lesson = state.lessons?.find((l) => l.id === id);
  if (!hydrated) return <p role="status">Caricamento lezione…</p>;
  if (!lesson)
    return (
      <>
        <h1 className="text-xl font-medium">Lezione non trovata</h1>
        <Link
          href="/admin/lezioni"
          className="mt-4 inline-block text-sm underline"
        >
          Calendario
        </Link>
      </>
    );
  const bookings = (state.bookings ?? []).filter(
      (b) => b.lessonId === id && !b.cancelled,
    ),
    future = Date.parse(lesson.startsAt) > now;
  const run = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <PageHeading
        title={lesson.title}
        description={
          <span className="first-letter:uppercase">
            {lessonDate(lesson.startsAt)} · {lesson.coach}
          </span>
        }
        action={
          <>
            {!lesson.availability && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Modifica
              </Button>
            )}
            <Button
              variant="outline"
              disabled={lesson.cancelled && !future}
              onClick={() => setConfirm(true)}
            >
              {lesson.cancelled ? "Ripristina lezione" : "Annulla lezione"}
            </Button>
          </>
        }
      />
      <LocalNotice />
      {lesson.cancelled && (
        <p
          role="status"
          className="mb-6 rounded-[10px] bg-red-500/10 px-3 py-2.5 text-[13px] text-red-800 dark:text-red-400"
        >
          Lezione annullata. Le iscrizioni sono conservate; non vengono
          accettati nuovi iscritti.
        </p>
      )}
      <FormError message={error} />
      <div className="mb-10 grid overflow-hidden rounded-xl border sm:grid-cols-3">
        {[
          {
            icon: Clock,
            label: "Durata",
            value: `${lesson.durationMinutes} minuti`,
          },
          { icon: MapPin, label: "Sala", value: lesson.location },
          {
            icon: Users,
            label: "Posti",
            value: `${bookings.length} / ${lesson.capacity}`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 border-b px-5 py-4 last:border-b-0 sm:border-b-0 sm:not-first:border-l"
          >
            <item.icon
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            <div className="min-w-0">
              <p className="text-[13px] text-muted-foreground">{item.label}</p>
              <p className="truncate text-sm font-medium tabular-nums">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Iscritti
        </h2>
        <form
          className="mb-3 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            run(async () => {
              await changeBooking(id, studentId, false);
              setStudentId("");
            });
          }}
        >
          <div className="min-w-52 flex-1">
            <Field label="Aggiungi uno studente">
              <SelectControl
                className={control}
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Seleziona uno studente…</option>
                {state.students
                  .filter(
                    (s) =>
                      !s.archived &&
                      !bookingRestriction(state, s.id, id) &&
                      !bookings.some((b) => b.studentId === s.id),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
              </SelectControl>
            </Field>
          </div>
          <Button
            type="submit"
            disabled={
              lesson.cancelled || !future || bookings.length >= lesson.capacity
            }
          >
            Iscrivi
          </Button>
        </form>
        <div className="divide-y rounded-xl border px-4 empty:hidden">
          {bookings.map((b) => {
            const student = state.students.find((s) => s.id === b.studentId);
            return (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <Link
                  href={`/admin/studenti/${encodeURIComponent(b.studentId)}`}
                  className="text-sm hover:underline"
                >
                  {student?.firstName} {student?.lastName}
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    run(async () => changeBooking(id, b.studentId, true))
                  }
                >
                  Rimuovi
                </Button>
              </div>
            );
          })}
        </div>
        {!bookings.length && (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nessuno studente iscritto.
          </p>
        )}
      </section>
      {editing && (
        <LessonEditor lesson={lesson} close={() => setEditing(false)} />
      )}
      <ConfirmDialog
        error={error}
        open={confirm}
        title={
          lesson.cancelled
            ? "Ripristinare la lezione?"
            : "Annullare la lezione?"
        }
        description="Gli iscritti vengono conservati. Questa operazione non invia notifiche automatiche."
        confirmLabel={lesson.cancelled ? "Ripristina" : "Annulla lezione"}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          run(async () => {
            await updateCrm((s) => ({
              ...s,
              lessons: s.lessons?.map((l) =>
                l.id === id ? { ...l, cancelled: !l.cancelled } : l,
              ),
            }));
            setConfirm(false);
          })
        }
      />
    </>
  );
}
