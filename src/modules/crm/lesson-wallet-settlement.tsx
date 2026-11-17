"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lesson, LessonBooking } from "./fitness-model";
import type { CrmStudent } from "./model";
import { lessonPrice, lessonVenues, type LessonVenue } from "./lesson-wallet";
import { euro } from "./lesson-wallet-view";
import { updateLessonWallet } from "./store";
import { Field, FormError, control } from "./ui";

export function LessonWalletSettlement({
  lesson,
  bookings,
  students,
}: {
  lesson: Lesson;
  bookings: LessonBooking[];
  students: CrmStudent[];
}) {
  const [venue, setVenue] = useState<LessonVenue | "">(
    /milano/i.test(lesson.location)
      ? "milano"
      : /monza|brianza/i.test(lesson.location)
        ? "monza"
        : "",
  );
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  if (lesson.settlement)
    return (
      <p className="mt-5 rounded-xl border p-4 text-sm font-medium">
        Consuntivo salvato · {lesson.settlement.participants} presenti ·{" "}
        {lessonVenues[lesson.settlement.venue]}
      </p>
    );
  if (!bookings.length) return null;

  const count = bookings.filter((b) => present[b.id]).length;
  const tariff = venue
    ? lessonPrice(venue, count, lesson.durationMinutes)
    : undefined;
  const roster = bookings.map((booking) => ({
    booking,
    student: students.find((s) => s.id === booking.studentId),
    present: Boolean(present[booking.id]),
  }));
  const manual = venue && tariff === undefined && count > 0;
  return (
    <form
      className="mt-5 space-y-3 rounded-xl border bg-card p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!venue || lock.current) return;
        const form = new FormData(event.currentTarget);
        lock.current = true;
        setPending(true);
        setError("");
        try {
          await updateLessonWallet({
            action: "settle",
            lessonId: lesson.id,
            venue,
            ...(manual
              ? {
                  manualPrice: Math.round(
                    Number(form.get("manualPrice")) * 100,
                  ),
                }
              : {}),
            roster: roster.map((r) => ({
              bookingId: r.booking.id,
              present: r.present,
            })),
          });
        } catch (error) {
          setError((error as Error).message);
        } finally {
          lock.current = false;
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        <legend className="text-base font-semibold">
          Registra presenze e costi
        </legend>
        <p className="text-sm text-muted-foreground">
          Spunta chi ha partecipato. Le lezioni di gruppo si pagano a listino:
          la tariffa a persona dipende dalla sede e dal numero dei presenti e
          viene fissata quando chiudi il consuntivo.
        </p>
        <Field label="Sede per la tariffa">
          <select
            className={control}
            required
            value={venue}
            onChange={(e) => setVenue(e.target.value as LessonVenue | "")}
          >
            <option value="">Seleziona la sede</option>
            <option value="milano">{lessonVenues.milano}</option>
            <option value="monza">{lessonVenues.monza}</option>
          </select>
        </Field>
        <ul className="divide-y rounded-lg border px-3">
          {roster.map(({ booking, student, present: attended }) => {
            const name = student
              ? `${student.firstName} ${student.lastName}`
              : "Studente";
            return (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={attended}
                    onChange={(e) =>
                      setPresent((old) => ({
                        ...old,
                        [booking.id]: e.target.checked,
                      }))
                    }
                  />{" "}
                  {name}
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-sm font-medium">
          {count} {count === 1 ? "presente" : "presenti"}
          {tariff !== undefined ? ` · ${euro(tariff)} a persona` : ""}
        </p>
        {manual && (
          <Field
            label="Tariffa per persona (€)"
            hint="Per questo numero di presenti o questa durata non è definita una tariffa."
          >
            <input
              className={control}
              name="manualPrice"
              type="number"
              required
              min="0"
              max="100000"
              step="0.01"
            />
          </Field>
        )}
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" required /> Confermo le presenze e gli
          addebiti.
        </label>
        <Button type="submit" size="sm">
          Chiudi consuntivo
        </Button>
      </fieldset>
      <FormError message={error} />
    </form>
  );
}
