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
import { useCrm, updateCrm, useHydrated, useViewer } from "./store";
import { todayRome, addDays, romeLocal, romeToIso } from "./fitness-logic";
import { ConfirmDialog } from "./confirm-dialog";
import type { Lesson } from "./fitness-model";
import { coachName, defaultCoachName } from "./student-coach";
import { withAvailabilityCapacity } from "./availability-lessons";
import { bookingRestriction } from "./tier-access";
import { AvailabilityCalendar } from "./availability-calendar";
import { lessonHasEnded } from "./lesson-wallet";
import { LessonWalletSettlement } from "./lesson-wallet-settlement";
import { bookableStudents, staffBooking } from "./lesson-booking";
import { NewStudentButton, StudentPicker } from "./lesson-students";
import type { AvailabilitySelection } from "./availability-time";
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
  await updateCrm((s) => staffBooking(s, lessonId, studentId, cancelled));
}
const minutes = (clock: string) =>
  Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
/** The grid selection becomes the lesson's day, time and duration. */
export const lessonFromSelection = (selection: AvailabilitySelection) => ({
  when: `${selection.date}T${selection.start}`,
  duration: Math.min(
    240,
    Math.max(15, minutes(selection.end) - minutes(selection.start)),
  ),
});
export type LessonStart = ReturnType<typeof lessonFromSelection>;
function LessonEditor({
  lesson,
  initial,
  close,
}: {
  lesson?: Lesson;
  initial?: LessonStart;
  close: () => void;
}) {
  const state = useCrm(),
    viewer = useViewer(),
    clock = useClock();
  const member = state.admins.find((admin) =>
    viewer ? admin.id === viewer.recordId : admin.role === "owner",
  );
  const [original] = useState(JSON.stringify(lesson)),
    [error, setError] = useState(""),
    [when, setWhen] = useState(
      lesson
        ? romeLocal(lesson.startsAt)
        : (initial?.when ?? addDays(todayRome(), 1) + "T18:00"),
    ),
    [students, setStudents] = useState<string[]>([]),
    [places, setPlaces] = useState<number | null>(lesson?.capacity ?? null),
    [draftId] = useState(() => crypto.randomUUID()),
    [saving, setSaving] = useState(false);
  // New lessons start with one place per chosen student.
  const capacity = Math.max(places ?? 1, students.length, 1);
  let startsAt = "";
  try {
    startsAt = romeToIso(when);
  } catch {
    /* an incomplete date is reported when saving */
  }
  const allowed = bookableStudents(state, {
    id: draftId,
    title: "Lezione",
    startsAt: startsAt || new Date(clock + 86_400_000).toISOString(),
    durationMinutes: 60,
    capacity: 200,
    coach: "",
    location: "",
    cancelled: false,
  });
  return (
    <Editor
      title={lesson ? "Modifica lezione" : "Nuova lezione"}
      description={
        lesson
          ? "L’orario è nel fuso Europe/Rome. Coach e sala non possono avere lezioni sovrapposte."
          : "Scegli giorno, orario e gli studenti. Gli iscritti ricevono l’invito sul calendario Google."
      }
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving) return;
          try {
            const f = new FormData(e.currentTarget);
            if (students.some((id) => !allowed.some((s) => s.id === id)))
              throw new Error(
                "Uno studente scelto non ha le lezioni in sede nel suo tier. Toglilo o cambia il tier.",
              );
            const item: Lesson = {
              id: lesson?.id ?? draftId,
              ...(lesson?.availability
                ? { availability: lesson.availability }
                : {}),
              title: String(f.get("title")).trim(),
              startsAt: romeToIso(when),
              durationMinutes: Number(f.get("duration")),
              capacity,
              coach: coachName(String(f.get("coach") ?? "")),
              location: String(f.get("location")).trim(),
              cancelled: lesson?.cancelled ?? false,
            };
            setSaving(true);
            await updateCrm((s) => {
              if (
                lesson &&
                JSON.stringify(s.lessons?.find((l) => l.id === lesson.id)) !==
                  original
              )
                throw new Error("La lezione è cambiata. Riapri il form.");
              const now = new Date().toISOString();
              return {
                ...s,
                lessons: lesson
                  ? (s.lessons ?? []).map((l) => (l.id === item.id ? item : l))
                  : [...(s.lessons ?? []), item],
                bookings: [
                  ...(s.bookings ?? []),
                  ...students.map((studentId) => ({
                    id: crypto.randomUUID(),
                    lessonId: item.id,
                    studentId,
                    createdAt: now,
                    cancelled: false,
                  })),
                ],
              };
            });
            close();
          } catch (e) {
            setSaving(false);
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
            defaultValue={lesson?.title ?? "Allenamento in sede"}
            placeholder="Es. Functional training"
          />
        </Field>
        <LessonDateTime value={when} onChange={setWhen} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Durata (minuti) *">
            <input
              className={control}
              type="number"
              name="duration"
              required
              min={15}
              max={240}
              defaultValue={lesson?.durationMinutes ?? initial?.duration ?? 60}
            />
          </Field>
          <Field
            label="Posti *"
            hint={
              lesson ? undefined : "Di solito uno per ogni studente scelto."
            }
          >
            <input
              className={control}
              type="number"
              required
              min={1}
              max={200}
              value={capacity}
              onChange={(e) => setPlaces(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Coach *">
          <input
            className={control}
            required
            name="coach"
            defaultValue={coachName(lesson?.coach ?? member?.name ?? "")}
            placeholder={defaultCoachName}
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
        {!lesson && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Studenti</p>
            <StudentPicker
              allowed={allowed}
              selected={students}
              onChange={setStudents}
              max={200}
            />
            <p className="text-xs text-muted-foreground">
              Compaiono gli studenti con le lezioni in sede nel loro tier. Puoi
              anche iscriverli dopo, dalla lezione.
            </p>
          </div>
        )}
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit" disabled={saving}>
            Salva lezione
          </Button>
        </div>
      </form>
    </Editor>
  );
}
function LessonDateTime({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const date = value.slice(0, 10),
    time = value.slice(11, 16);
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Data *">
        <DatePicker
          required
          value={date}
          onChange={(next) => onChange(`${next}T${time}`)}
        />
      </Field>
      <Field label="Ora *">
        <TimePicker
          required
          value={time}
          onChange={(next) => onChange(`${date}T${next}`)}
        />
      </Field>
    </div>
  );
}
export function LessonsWorkspace() {
  const [lessonStart, setLessonStart] = useState<LessonStart | null>(null),
    [availability, setAvailability] = useState<AvailabilitySelection | null>(
      null,
    );
  const tomorrow = () => addDays(todayRome(), 1);
  return (
    <>
      <PageHeading
        title="Calendario"
        description="Disponibilità, lezioni e prenotazioni in sede."
        action={
          <>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setAvailability({
                  date: tomorrow(),
                  start: "07:00",
                  end: "08:00",
                })
              }
            >
              <Plus className="size-4" />
              Aggiungi disponibilità
            </Button>
            <Button
              size="lg"
              className="rounded-full"
              onClick={() =>
                setLessonStart({ when: `${tomorrow()}T18:00`, duration: 60 })
              }
            >
              <Plus className="size-4" />
              Aggiungi lezione
            </Button>
          </>
        }
      />
      <LocalNotice />
      <AvailabilityCalendar
        editing={availability}
        setEditing={setAvailability}
        onNewLesson={(selection) =>
          setLessonStart(lessonFromSelection(selection))
        }
      />
      {lessonStart && (
        <LessonEditor
          key={lessonStart.when}
          initial={lessonStart}
          close={() => setLessonStart(null)}
        />
      )}
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
  const savedLesson = state.lessons?.find((l) => l.id === id);
  const lesson = savedLesson && withAvailabilityCapacity(state, savedLesson);
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
          !lesson.settlement && (
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
          )
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
              lesson.cancelled ||
              !!lesson.settlement ||
              !future ||
              bookings.length >= lesson.capacity
            }
          >
            Iscrivi
          </Button>
          <NewStudentButton onCreated={setStudentId} />
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
                  disabled={!!lesson.settlement}
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
      {!lesson.cancelled &&
        (lesson.settlement || lessonHasEnded(lesson, now)) && (
          <LessonWalletSettlement
            key={id}
            lesson={lesson}
            bookings={bookings}
            students={state.students}
          />
        )}
      {editing && !lesson.settlement && (
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
