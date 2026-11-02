import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Dumbbell,
  LockKeyhole,
} from "lucide-react";
import type { TierAccess } from "./model";
export type StudentView = "home" | "piano" | "prenotazioni";

export function StudentHome({
  services,
  hasBookings,
  hasPlan,
  studentId,
}: {
  services: TierAccess;
  hasBookings: boolean;
  hasPlan: boolean;
  studentId?: string;
}) {
  const query = studentId ? `?studente=${encodeURIComponent(studentId)}` : "";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {services.plans && hasPlan ? (
        <Link
          href={`/area-studente/piano${query}`}
          className="group flex items-center gap-4 rounded-2xl border border-violet-200 bg-white p-6 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Dumbbell className="size-6 shrink-0 text-violet-700" />
          <div className="flex-1">
            <h2 className="font-semibold">Il mio piano</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Il programma e i tuoi allenamenti.
            </p>
          </div>
          <ArrowUpRight className="size-4" />
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="flex items-center gap-4 rounded-2xl border border-border bg-muted/40 p-6 text-left text-muted-foreground disabled:cursor-not-allowed"
        >
          <Dumbbell className="size-6 shrink-0 opacity-50" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold">Il mio piano</span>
            <span className="mt-2 block text-sm">Nessun piano disponibile</span>
          </span>
          <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
        </button>
      )}
      {(services.lessons || hasBookings) && (
        <Link
          href={`/area-studente/prenotazioni${query}`}
          className="group flex items-center gap-4 rounded-2xl border border-sky-200 bg-white p-6 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <CalendarDays className="size-6 shrink-0 text-sky-700" />
          <div className="flex-1">
            <h2 className="font-semibold">
              {services.lessons ? "Prenota una lezione" : "Le mie prenotazioni"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {services.lessons
                ? "Scegli un orario e gestisci le prenotazioni."
                : "Consulta o annulla le prenotazioni esistenti."}
            </p>
          </div>
          <ArrowUpRight className="size-4" />
        </Link>
      )}
      {!services.plans && !services.lessons && !hasBookings && (
        <p className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">
          Il team non ha ancora abilitato servizi per il tuo percorso.
        </p>
      )}
    </div>
  );
}
