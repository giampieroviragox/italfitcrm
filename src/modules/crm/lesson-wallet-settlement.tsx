"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lesson, LessonBooking } from "./fitness-model";
import type { CrmStudent } from "./model";
import {
  lessonPrice,
  lessonVenues,
  canUseLessonCredit,
  type LessonVenue,
} from "./lesson-wallet";
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
  const [credits, setCredits] = useState<Record<string, string>>({});
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
  const roster = bookings.map((booking) => {
    const student = students.find((s) => s.id === booking.studentId);
    const wallet = student?.lessonWallet;
    const available =
      wallet && venue
        ? wallet.credits.filter((credit) =>
            canUseLessonCredit(
              wallet,
              credit,
              venue,
              count,
              lesson.durationMinutes,
            ),
          )
        : [];
    const creditId = available.find((c) => credits[booking.id] === c.id)?.id;
    return {
      booking,
      student,
      available,
      creditId,
      present: Boolean(present[booking.id]),
    };
  });
  const manual =
    venue &&
    tariff === undefined &&
    roster.some((r) => r.present && !r.creditId);
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
              ...(r.present && r.creditId ? { creditId: r.creditId } : {}),
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
          Spunta chi ha partecipato. La tariffa a lezione dipende dal numero dei
          presenti e viene fissata quando chiudi il consuntivo.
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
          {roster.map(
            ({ booking, student, available, creditId, present: attended }) => {
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
                  {attended && available.length > 0 && (
                    <select
                      aria-label={`Addebito per ${name}`}
                      className={control + " max-w-xs"}
                      value={creditId ?? ""}
                      onChange={(e) =>
                        setCredits((old) => ({
                          ...old,
                          [booking.id]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Pagamento a lezione</option>
                      {available.map((credit) => (
                        <option key={credit.id} value={credit.id}>
                          {credit.name}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              );
            },
          )}
        </ul>
        <p className="text-sm font-medium">
          {count} presenti
          {tariff !== undefined
            ? ` · ${euro(tariff)} a persona per le lezioni non coperte da crediti`
            : ""}
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
