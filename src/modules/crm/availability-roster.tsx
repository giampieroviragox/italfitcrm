"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SelectControl } from "@/components/ui/select-control";
import { useClock } from "./use-clock";
import { updateCrm, useCrm } from "./store";
import { control, Field, FormError } from "./ui";
import {
  availabilityCapacity,
  availabilityDurationMinutes,
  type AvailabilitySlot,
} from "./availability";
import {
  availabilityLessonId,
  availabilityLessons,
  withAvailabilityCapacity,
} from "./availability-lessons";
import { bookableStudents, staffBooking } from "./lesson-booking";
import { NewStudentButton } from "./lesson-students";

/**
 * Who is enrolled in a published period, and a way to enrol a student who
 * did not book by themselves. Each place taken is one place less.
 */
export function SlotRoster({
  adminId,
  slot,
}: {
  adminId: string;
  slot: AvailabilitySlot;
}) {
  const state = useCrm(),
    now = useClock();
  const [studentId, setStudentId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = availabilityLessonId(
    adminId,
    new Date(Date.parse(slot.start)).toISOString(),
    availabilityDurationMinutes(slot),
  );
  const saved = state.lessons?.find((lesson) => lesson.id === id);
  const lesson = saved
    ? withAvailabilityCapacity(state, saved)
    : availabilityLessons(state, now).find((item) => item.id === id);
  const enrolled = (state.bookings ?? []).filter(
    (b) => b.lessonId === id && !b.cancelled,
  );
  const capacity = availabilityCapacity(slot);
  const free = Math.max(0, capacity - enrolled.length);
  const closed =
    !lesson || lesson.cancelled || Boolean(lesson.settlement) || free === 0;
  const candidates = lesson
    ? bookableStudents(
        state,
        lesson,
        enrolled.map((b) => b.studentId),
      )
    : [];
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const enrol = (student: string) =>
    run(async () => {
      await updateCrm((s) => staffBooking(s, id, student, false));
      setStudentId("");
    });
  const name = (student: string) => {
    const s = state.students.find((x) => x.id === student);
    return s ? `${s.firstName} ${s.lastName}`.trim() : "Studente";
  };
  return (
    <section className="mt-6 border-t pt-5" aria-label="Iscritti alla fascia">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Iscritti</h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          {enrolled.length} / {capacity}{" "}
          {free === 0 ? "· al completo" : `· ${free} liberi`}
        </p>
      </div>
      {enrolled.length > 0 ? (
        <ul className="mb-4 divide-y rounded-xl border px-4">
          {enrolled.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <Link
                href={`/admin/studenti/${encodeURIComponent(b.studentId)}`}
                className="text-sm hover:underline"
              >
                {name(b.studentId)}
              </Link>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy || Boolean(lesson?.settlement)}
                onClick={() =>
                  run(async () => {
                    await updateCrm((s) =>
                      staffBooking(s, id, b.studentId, true),
                    );
                  })
                }
              >
                Rimuovi
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-xl border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
          Nessuno studente iscritto.
        </p>
      )}
      {!lesson && (
        <p className="text-xs text-muted-foreground">
          Questa fascia si sovrappone a un’altra lezione: non si può iscrivere
          nessuno finché l’orario è occupato.
        </p>
      )}
      {lesson && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Field label="Iscrivi uno studente">
              <SelectControl
                className={control}
                value={studentId}
                disabled={closed || busy}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">
                  {free === 0
                    ? "Posti esauriti"
                    : candidates.length
                      ? "Scegli uno studente…"
                      : "Nessuno studente disponibile"}
                </option>
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </SelectControl>
            </Field>
          </div>
          <Button
            type="button"
            disabled={closed || busy || !studentId}
            onClick={() => void enrol(studentId)}
          >
            Iscrivi
          </Button>
          <NewStudentButton
            className={free === 0 ? "hidden" : undefined}
            onCreated={setStudentId}
          />
        </div>
      )}
      <FormError message={error} />
    </section>
  );
}
