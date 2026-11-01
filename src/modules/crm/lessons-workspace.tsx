"use client";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useClock } from "./use-clock";
import { useState } from "react";
import { CalendarDays, Plus, MapPin, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { ActionMenu } from "@/components/ui/action-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Editor,
  EditorCancel,
  Field,
  control,
  FormError,
  LocalNotice,
} from "./ui";
import { useCrm, updateCrm, useHydrated } from "./store";
import {
  todayRome,
  addDays,
  weekStart,
  romeLocal,
  romeToIso,
} from "./fitness-logic";
import { ConfirmDialog } from "./confirm-dialog";
import type { Lesson } from "./fitness-model";
import { bookingRestriction } from "./tier-access";
import { AvailabilityCalendar } from "./availability-calendar";
import { WeekNavigation } from "./week-navigation";
export const lessonDate = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
const time = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
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
        <Field label="Data e ora *">
          <input
            className={control}
            required
            type="datetime-local"
            name="date"
            defaultValue={
              lesson
                ? romeLocal(lesson.startsAt)
                : addDays(todayRome(), 1) + "T18:00"
            }
          />
        </Field>
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
export function LessonsWorkspace() {
  const state = useCrm();
  const [week, setWeek] = useState(() => weekStart(todayRome())),
    [editing, setEditing] = useState<Lesson | "new" | null>(null),
    [cancelled, setCancelled] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const lessons = (state.lessons ?? [])
    .filter(
      (l) =>
        (cancelled || !l.cancelled) &&
        days.includes(romeLocal(l.startsAt).slice(0, 10)),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <>
      <PageHeading
        title="Lezioni in sede"
        description="Organizza gli orari e gestisci gli iscritti."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Nuova lezione
          </Button>
        }
      />
      <LocalNotice />
      <Tabs defaultValue="lessons" className="gap-6">
        <TabsList className="group-data-horizontal/tabs:h-10">
          <TabsTrigger className="px-4" value="lessons">
            Lezioni
          </TabsTrigger>
          <TabsTrigger className="px-4" value="availability">
            Disponibilità
          </TabsTrigger>
        </TabsList>
        <TabsContent value="availability">
          <AvailabilityCalendar />
        </TabsContent>
        <TabsContent value="lessons">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <WeekNavigation week={week} onChange={setWeek} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckboxControl
                checked={cancelled}
                onChange={(e) => setCancelled(e.target.checked)}
              />
              Mostra annullate
            </label>
          </div>
          {!lessons.length ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center">
              <CalendarDays className="mb-5 size-7 text-muted-foreground" />
              <h2 className="text-lg font-medium">
                Nessuna lezione questa settimana
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Pubblica un orario per iniziare a raccogliere le iscrizioni.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => setEditing("new")}
              >
                Aggiungi una lezione
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-2xl border px-5 sm:px-6">
              {days.map((day) => {
                const items = lessons.filter((l) =>
                  romeLocal(l.startsAt).startsWith(day),
                );
                return (
                  <section
                    key={day}
                    className="grid gap-4 py-5 sm:grid-cols-[110px_1fr]"
                  >
                    <div>
                      <p
                        className={`text-sm ${day === todayRome() ? "font-semibold" : "font-medium"}`}
                      >
                        {new Intl.DateTimeFormat("it-IT", {
                          weekday: "long",
                        }).format(new Date(day + "T12:00Z"))}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("it-IT", {
                          day: "numeric",
                          month: "short",
                        }).format(new Date(day + "T12:00Z"))}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {!items.length && (
                        <p className="py-2 text-xs text-muted-foreground">
                          Nessuna lezione
                        </p>
                      )}
                      {items.map((l) => {
                        const count =
                          state.bookings?.filter(
                            (b) => b.lessonId === l.id && !b.cancelled,
                          ).length ?? 0;
                        return (
                          <article
                            key={l.id}
                            className="flex flex-wrap items-center gap-4 rounded-xl border p-4"
                          >
                            <div className="w-16 text-xs font-medium">
                              {time(l.startsAt)}
                              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                                {l.durationMinutes} min
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/admin/lezioni/${encodeURIComponent(l.id)}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {l.title}
                              </Link>
                              <p className="mt-1.5 text-xs text-muted-foreground">
                                {l.coach} · {l.location}
                              </p>
                            </div>
                            <span
                              className={`rounded-md px-2 py-1 text-[11px] ${l.cancelled ? "bg-red-50 text-red-700" : count === l.capacity ? "bg-amber-50 text-amber-800" : "bg-muted text-muted-foreground"}`}
                            >
                              {l.cancelled
                                ? "Annullata"
                                : `${count}/${l.capacity} iscritti`}
                            </span>
                            <ActionMenu
                              label={`Azioni ${l.title}`}
                              items={[
                                {
                                  label: "Gestisci iscritti",
                                  href: `/admin/lezioni/${encodeURIComponent(l.id)}`,
                                },
                                {
                                  label: "Modifica lezione",
                                  onSelect: () => setEditing(l),
                                },
                              ]}
                            />
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {editing && (
        <LessonEditor
          lesson={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
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
          Tutte le lezioni
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
      <Link
        href="/admin/lezioni"
        className="mb-6 inline-block text-xs text-muted-foreground"
      >
        ← Tutte le lezioni
      </Link>
      <PageHeading
        title={lesson.title}
        description={lessonDate(lesson.startsAt)}
        action={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Modifica
            </Button>
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
          className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800"
        >
          Lezione annullata. Le iscrizioni sono conservate; non vengono
          accettati nuovi iscritti.
        </p>
      )}
      <FormError message={error} />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
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
          <div key={item.label} className="rounded-xl border p-5">
            <item.icon className="mb-3 size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border">
        <div className="border-b p-5">
          <h2 className="text-sm font-medium">Iscritti</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Coach: {lesson.coach}
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3 border-b p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            run(async () => {
              await changeBooking(id, studentId, false);
              setStudentId("");
            });
          }}
        >
          <div className="min-w-52 flex-1">
            <Field label="Studente">
              <SelectControl
                className={control}
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Seleziona uno studente attivo…</option>
                {state.students
                  .filter(
                    (s) =>
                      !s.archived &&
                      s.status === "active" &&
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
            Aggiungi iscritto
          </Button>
        </form>
        <div className="divide-y px-5">
          {bookings.map((b) => {
            const student = state.students.find((s) => s.id === b.studentId);
            return (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
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
                  Rimuovi iscrizione
                </Button>
              </div>
            );
          })}
          {!bookings.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nessuno studente iscritto.
            </p>
          )}
        </div>
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
