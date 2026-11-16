import Link from "next/link";
import { ArrowUpRight, CalendarDays, Dumbbell } from "lucide-react";
import type { TierAccess } from "./model";

export type StudentView = "home" | "piano" | "prenotazioni";

export function StudentHome({
  services,
  hasBookings,
  planTitle,
}: {
  services: TierAccess;
  hasBookings: boolean;
  planTitle?: string;
}) {
  const links = [
    ...(services.plans
      ? [
          {
            href: "/area-studente/piano",
            label: "Il mio piano",
            title: planTitle ?? "Nessun piano per questo mese",
            icon: Dumbbell,
          },
        ]
      : []),
    ...(services.lessons || hasBookings
      ? [
          {
            href: "/area-studente/prenotazioni",
            label: "Prenotazioni",
            title: services.lessons ? "Lezioni in sede" : "Le mie lezioni",
            icon: CalendarDays,
          },
        ]
      : []),
  ];

  return links.length ? (
    <div className="grid gap-3 md:grid-cols-2">
      {links.map(({ href, label, title, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex min-h-44 flex-col justify-between gap-6 rounded-3xl border bg-card p-5 transition-colors hover:border-primary/60 sm:min-h-56 sm:p-7"
        >
          <div className="flex items-start justify-between">
            <span className="grid size-11 place-items-center rounded-full border border-foreground/15">
              <Icon
                className="size-5 text-[var(--workspace-accent)]"
                aria-hidden
              />
            </span>
            <ArrowUpRight
              className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </p>
          </div>
        </Link>
      ))}
    </div>
  ) : (
    <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
      Il team non ha ancora abilitato servizi per il tuo percorso.
    </p>
  );
}
