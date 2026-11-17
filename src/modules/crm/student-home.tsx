import Link from "next/link";
import { ArrowUpRight, CalendarDays, Dumbbell } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { TierAccess } from "./model";
import {
  daysBetween,
  subscriptionStatus,
  subscriptionStatusLabels,
} from "./online-coaching";
import type { StudentCoaching } from "./student-portal-model";
import type { Receipt } from "./lesson-wallet";
import { euro } from "./money";
import { ReceiptForm, ReceiptList } from "./receipts-view";

export type StudentView = "home" | "piano" | "progressi" | "prenotazioni";

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

export function StudentCoachingCard({
  coaching,
  today,
  outstanding = 0,
  receipts = [],
  onSubmitReceipt,
}: {
  coaching: StudentCoaching;
  today: string;
  /** Still to pay for online coaching, in cents. */
  outstanding?: number;
  receipts?: Receipt[];
  onSubmitReceipt?: (form: FormData) => Promise<string>;
}) {
  const status = subscriptionStatus(coaching, today);
  const left = daysBetween(today, coaching.endsOn);
  return (
    <section
      aria-labelledby="coaching-online-title"
      className="mt-3 rounded-3xl border bg-card p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">Coaching online</p>
        <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
          {subscriptionStatusLabels[status]}
        </span>
      </div>
      <h2
        id="coaching-online-title"
        className="mt-1 text-2xl font-semibold tracking-tight"
      >
        Abbonamento {coaching.durationMonths} mesi
      </h2>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Periodo</dt>
          <dd className="font-medium tabular-nums">
            {formatDate(coaching.startsOn)} → {formatDate(coaching.endsOn)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Piani inclusi</dt>
          <dd className="font-medium">
            {coaching.durationMonths} piani da quattro settimane
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {coaching.coachName ? "Coach" : "Scadenza"}
          </dt>
          <dd className="font-medium">
            {coaching.coachName ||
              (status === "expired" ? "Scaduto" : `Tra ${left} giorni`)}
          </dd>
        </div>
      </dl>
      {status === "expiring" && (
        <p className="mt-4 text-sm text-muted-foreground">
          {left === 0
            ? "L’abbonamento scade oggi."
            : `L’abbonamento scade tra ${left} ${left === 1 ? "giorno" : "giorni"}.`}{" "}
          Contatta il team per il rinnovo.
        </p>
      )}
      {(outstanding > 0 || receipts.length > 0) && (
        <div className="mt-5 space-y-3 border-t pt-4">
          <p className="text-sm">
            <span className="text-muted-foreground">Da saldare: </span>
            <span className="font-semibold tabular-nums">
              {euro(outstanding)}
            </span>
          </p>
          {onSubmitReceipt && outstanding > 0 && (
            <ReceiptForm outstanding={outstanding} onSubmit={onSubmitReceipt} />
          )}
          <ReceiptList receipts={receipts} />
        </div>
      )}
    </section>
  );
}
