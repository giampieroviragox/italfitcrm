import Link from "next/link";
import { CalendarDays, Dumbbell } from "lucide-react";
import type { TierAccess } from "./model";
export type StudentView = "home" | "piano" | "prenotazioni";

const tile =
  "flex items-center gap-4 rounded-xl border p-4 text-left transition-colors sm:p-5";
const icon =
  "flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[.045]";

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
    <div className="grid gap-2 sm:grid-cols-2">
      {services.plans && hasPlan ? (
        <Link
          href={`/area-studente/piano${query}`}
          className={`${tile} hover:bg-foreground/[.02]`}
        >
          <span className={icon}>
            <Dumbbell className="size-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Il mio piano</span>
            <span className="block text-[13px] text-muted-foreground">
              Il programma e i tuoi allenamenti
            </span>
          </span>
        </Link>
      ) : (
        <div className={`${tile} bg-foreground/[.02] text-muted-foreground`}>
          <span className={`${icon} opacity-60`}>
            <Dumbbell className="size-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Il mio piano</span>
            <span className="block text-[13px]">
              {services.plans
                ? "Nessun piano per questo mese"
                : "Non incluso nel tuo percorso"}
            </span>
          </span>
        </div>
      )}
      {(services.lessons || hasBookings) && (
        <Link
          href={`/area-studente/prenotazioni${query}`}
          className={`${tile} hover:bg-foreground/[.02]`}
        >
          <span className={icon}>
            <CalendarDays className="size-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {services.lessons ? "Prenota una lezione" : "Le mie prenotazioni"}
            </span>
            <span className="block text-[13px] text-muted-foreground">
              {services.lessons
                ? "Scegli un orario in sede"
                : "Consulta o annulla le prenotazioni"}
            </span>
          </span>
        </Link>
      )}
      {!services.plans && !services.lessons && !hasBookings && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2">
          Il team non ha ancora abilitato servizi per il tuo percorso.
        </p>
      )}
    </div>
  );
}
