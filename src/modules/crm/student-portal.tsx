"use client";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Field, control, FormError } from "./ui";
import { AssignedPlan } from "./plans-workspace";
import { lessonDate } from "./lessons-workspace";
import { todayRome } from "./fitness-logic";
import { useClock } from "./use-clock";
import type { StudentPortalData } from "./student-portal-model";
export function StudentPortal({ initial }: { initial: StudentPortalData }) {
  const [data, setData] = useState(initial),
    [month, setMonth] = useState(todayRome().slice(0, 7)),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const now = useClock();
  const assignment = data.assignments.find((a) => a.month === month);
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-8">
        <Brand />
        <form method="POST" action="/auth/signout">
          <Button type="submit" variant="outline">
            Esci
          </Button>
        </form>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
        <PageHeading
          title={`Ciao, ${data.student.firstName}`}
          description="Il tuo piano di allenamento e le lezioni in sede."
        />
        <div className="mb-7 max-w-xs">
          <Field label="Mese del piano">
            <input
              className={control}
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        </div>
        {assignment ? (
          <AssignedPlan assignment={assignment} />
        ) : (
          <div className="rounded-xl border p-6">
            <h2 className="text-sm font-medium">
              Nessun piano per questo mese
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Il team ti assegnerà il piano del tuo percorso.
            </p>
          </div>
        )}
        <section className="mt-10">
          <h2 className="text-lg font-medium">Lezioni in sede</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Orari di Roma. Prenota un posto tra le lezioni disponibili.
          </p>
          <FormError message={error} />
          <div className="mt-5 divide-y rounded-xl border">
            {data.lessons
              .filter((l) => Date.parse(l.startsAt) > now)
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((l) => (
                <article
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div>
                    <h3 className="text-sm font-medium">
                      {l.title}
                      {l.cancelled ? " · Annullata" : ""}
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {lessonDate(l.startsAt)} · {l.durationMinutes} min
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {l.coach} · {l.location} · {l.occupied}/{l.capacity} posti
                    </p>
                  </div>
                  <Button
                    variant={l.enrolled ? "outline" : "default"}
                    disabled={
                      pending ||
                      l.cancelled ||
                      (!l.enrolled &&
                        (l.occupied >= l.capacity ||
                          data.student.status !== "active"))
                    }
                    onClick={async () => {
                      setPending(true);
                      try {
                        const response = await fetch("/api/prenotazioni", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            lessonId: l.id,
                            cancelled: l.enrolled,
                          }),
                        });
                        const next = await response.json();
                        if (!response.ok)
                          throw new Error(
                            next.error ?? "Prenotazione non riuscita.",
                          );
                        setData(next);
                        setError("");
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    {l.cancelled
                      ? "Lezione annullata"
                      : l.enrolled
                        ? "Annulla prenotazione"
                        : l.occupied >= l.capacity
                          ? "Completa"
                          : "Prenota"}
                  </Button>
                </article>
              ))}
            {!data.lessons.some((l) => Date.parse(l.startsAt) > now) && (
              <p className="p-6 text-sm text-muted-foreground">
                Nessuna lezione disponibile.
              </p>
            )}
          </div>
          {data.student.status !== "active" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Le prenotazioni saranno disponibili quando il team attiverà il tuo
              percorso.
            </p>
          )}
        </section>
        <Link
          href="/imposta-password"
          className="mt-8 inline-block text-xs text-muted-foreground underline underline-offset-4"
        >
          Cambia password
        </Link>
      </main>
    </div>
  );
}
