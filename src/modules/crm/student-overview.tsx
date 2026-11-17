"use client";

import {
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  Flag,
  Laptop,
  Package,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, formatMonth } from "@/lib/format";
import {
  daysUntil,
  feedbackFor,
  overallRatings,
  upcomingRaces,
} from "./cycle-feedback";
import { todayRome } from "./fitness-logic";
import { useClock } from "./use-clock";
import {
  emptyWallet,
  outstandingAmount,
  remainingCredit,
} from "./lesson-wallet";
import type { CrmState, CrmStudent } from "./model";
import { euro } from "./money";
import {
  assignmentCoachId,
  assignmentsInPeriod,
  currentSubscription,
  includedPlans,
  subscriptionStatus,
} from "./online-coaching";
import { SubscriptionStatusBadge, coachLabel } from "./online-coaching-view";
import { paymentHistory } from "./payment-history";
import { studentAccessLabel } from "./student-access";
import { coachName } from "./student-coach";
import { studentTierLabel } from "./student-tiers";
import { loggedSessions } from "./workout-log";

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
const romeDay = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(iso),
  );
const hours = (minutes: number) =>
  minutes % 60
    ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
    : `${minutes / 60} h`;

function Card({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-muted-foreground" aria-hidden>
            {icon}
          </span>
          {title}
        </h3>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-2 px-4 py-3 text-sm">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium break-words tabular-nums">
        {children}
      </span>
    </div>
  );
}
const empty = (text: string) => <p className="text-muted-foreground">{text}</p>;

/** Everything known about a student at a glance, with links to each section. */
export function StudentOverview({
  student,
  state,
  open,
}: {
  student: CrmStudent;
  state: CrmState;
  open: (tab: string) => void;
}) {
  const today = todayRome();
  const now = useClock();
  const assignments = (state.assignments ?? []).filter(
    (a) => a.studentId === student.id,
  );
  const subscription = currentSubscription(student.onlineSubscriptions, today);
  const plan =
    assignments.find((a) => a.month === today.slice(0, 7)) ??
    assignments.toSorted((a, b) => b.month.localeCompare(a.month))[0];
  const entries = student.workoutEntries ?? [];
  const history = loggedSessions(assignments, entries);
  const planDone = plan
    ? new Set(
        entries
          .filter(
            (e) =>
              e.completed &&
              e.assignmentId === plan.id &&
              e.assignmentCreatedAt === plan.createdAt,
          )
          .map((e) => e.sessionId),
      ).size
    : 0;
  const bookings = (state.bookings ?? [])
    .filter((b) => b.studentId === student.id && !b.cancelled)
    .flatMap((b) => {
      const lesson = state.lessons?.find((l) => l.id === b.lessonId);
      return lesson && !lesson.cancelled ? [lesson] : [];
    });
  const nextLesson = bookings
    .filter((l) => Date.parse(l.startsAt) > now)
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const wallet = student.lessonWallet ?? emptyWallet;
  const thisMonth = wallet.lessons.filter((l) =>
    romeDay(l.startsAt).startsWith(today.slice(0, 7)),
  );
  const pendingReceipts = (wallet.receipts ?? []).filter(
    (r) => r.status === "pending",
  );
  const lastPayment = paymentHistory([student]).find(
    (r) => r.kind !== "rejected",
  );
  const remainingMinutes = wallet.credits
    .filter((c) => c.unit === "minutes")
    .reduce((sum, c) => sum + remainingCredit(wallet, c), 0);
  const remainingLessons = wallet.credits
    .filter((c) => c.unit === "lessons")
    .reduce((sum, c) => sum + remainingCredit(wallet, c), 0);
  const races = upcomingRaces(student.races, today);
  const lastFeedback = (student.cycleFeedback ?? []).toSorted((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  )[0];
  const feedbackPlan = lastFeedback
    ? assignments.find((a) => a.id === lastFeedback.assignmentId)
    : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card
        title="Anagrafica e accesso"
        icon={<UserRound className="size-4" />}
        action={{ label: "Proprietà", onClick: () => open("properties") }}
      >
        <Row label="Email">{student.email || "—"}</Row>
        <Row label="Telefono">{student.phone || "—"}</Row>
        <Row label="Tier">{studentTierLabel(student, state.tiers)}</Row>
        <Row label="Accesso">{studentAccessLabel(student)}</Row>
        <Row label="Coach di riferimento">{coachName(student.coach)}</Row>
        <Row label="Aggiunto il">
          {student.joinedAt ? formatDate(student.joinedAt) : "—"}
        </Row>
      </Card>

      <Card
        title="Coaching online"
        icon={<Laptop className="size-4" />}
        action={{ label: "Abbonamenti", onClick: () => open("coaching") }}
      >
        {subscription ? (
          <>
            <Row label="Abbonamento">
              <span className="inline-flex items-center gap-2">
                {subscription.durationMonths} mesi
                <SubscriptionStatusBadge
                  status={subscriptionStatus(subscription, today)}
                />
              </span>
            </Row>
            <Row label="Periodo">
              {formatDate(subscription.startsOn)} →{" "}
              {formatDate(subscription.endsOn)}
            </Row>
            <Row label="Coach">{coachLabel(state, subscription.coachId)}</Row>
            <Row label="Piani">
              {
                assignmentsInPeriod(
                  state.assignments ?? [],
                  student.id,
                  subscription,
                ).length
              }{" "}
              di {includedPlans(subscription)}
            </Row>
          </>
        ) : (
          empty("Nessun abbonamento Coaching online.")
        )}
      </Card>

      <Card
        title="Piano e allenamenti"
        icon={<Dumbbell className="size-4" />}
        action={{ label: "Piani", onClick: () => open("plans") }}
      >
        {plan ? (
          <>
            <Row label="Piano">
              <span className="first-letter:uppercase">
                {plan.snapshot.title} · {formatMonth(plan.month)}
              </span>
            </Row>
            <Row label="Coach del piano">
              {(() => {
                const id = assignmentCoachId(state, plan);
                return id ? coachLabel(state, id) : "—";
              })()}
            </Row>
            <Row label="Sessioni completate">
              {planDone} di {plan.snapshot.sessions.length}
            </Row>
            <Row label="Ultimo allenamento">
              {history[0] ? formatDate(history[0].date) : "—"}
            </Row>
            <Row label="Questionario">
              {feedbackFor(student, plan) ? "Compilato" : "Non ancora"}
            </Row>
          </>
        ) : (
          empty("Nessun piano assegnato.")
        )}
      </Card>

      <Card
        title="Lezioni in sede"
        icon={<CalendarDays className="size-4" />}
        action={{ label: "Lezioni", onClick: () => open("lessons") }}
      >
        <Row label="Prossima lezione">
          {nextLesson ? (
            <>
              {nextLesson.title}
              <span className="block text-xs font-normal text-muted-foreground">
                {dateTime(nextLesson.startsAt)}
              </span>
            </>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Lezioni svolte">
          {wallet.lessons.length} · {thisMonth.length} questo mese
        </Row>
        <Row label="Individuali / di gruppo">
          {wallet.lessons.filter((l) => l.id.startsWith("manual-")).length} /{" "}
          {wallet.lessons.filter((l) => !l.id.startsWith("manual-")).length}
        </Row>
      </Card>

      <Card
        title="Pacchetti"
        icon={<Package className="size-4" />}
        action={{ label: "Pacchetti", onClick: () => open("packages") }}
      >
        {wallet.credits.length ? (
          <>
            <Row label="Pacchetti">{wallet.credits.length}</Row>
            {remainingMinutes > 0 && (
              <Row label="Ore residue">{hours(remainingMinutes)}</Row>
            )}
            {remainingLessons > 0 && (
              <Row label="Lezioni residue">{remainingLessons}</Row>
            )}
            {!remainingMinutes && !remainingLessons && (
              <Row label="Residuo">Esaurito</Row>
            )}
          </>
        ) : (
          empty("Nessun pacchetto lezioni individuali.")
        )}
      </Card>

      <Card
        title="Pagamenti"
        icon={<CreditCard className="size-4" />}
        action={{ label: "Pagamenti", onClick: () => open("payments") }}
      >
        <Row label="Da saldare">
          <span
            className={
              outstandingAmount(wallet) ? "text-[var(--workspace-accent)]" : ""
            }
          >
            {euro(outstandingAmount(wallet))}
          </span>
        </Row>
        <Row label="Da verificare">
          {pendingReceipts.length
            ? `${pendingReceipts.length} · ${euro(pendingReceipts.reduce((s, r) => s + r.amount, 0))}`
            : "—"}
        </Row>
        <Row label="Ultimo pagamento">
          {lastPayment
            ? `${euro(lastPayment.amount)} · ${formatDate(romeDay(lastPayment.date))}`
            : "—"}
        </Row>
      </Card>

      <Card
        title="Gare"
        icon={<Flag className="size-4" />}
        action={{ label: "Progressi e gare", onClick: () => open("training") }}
      >
        {races[0] ? (
          <>
            <Row label="Prossima">
              {races[0].name}
              <span className="block text-xs font-normal text-muted-foreground">
                {formatDate(races[0].date)} · tra{" "}
                {daysUntil(today, races[0].date)} giorni
              </span>
            </Row>
            <Row label="In programma">{races.length}</Row>
          </>
        ) : (
          empty("Nessuna gara in programma.")
        )}
      </Card>

      <Card
        title="Ultimo feedback"
        icon={<ClipboardCheck className="size-4" />}
        action={{ label: "Progressi e gare", onClick: () => open("training") }}
      >
        {lastFeedback ? (
          <>
            <Row label="Piano">
              <span className="first-letter:uppercase">
                {feedbackPlan ? formatMonth(feedbackPlan.month) : "—"}
              </span>
            </Row>
            <Row label="Com’è andato">
              {
                overallRatings[
                  lastFeedback.rating as keyof typeof overallRatings
                ]
              }
            </Row>
            <Row label="Sessioni/settimana">{lastFeedback.sessionsPerWeek}</Row>
            {lastFeedback.notes && (
              <p className="line-clamp-3 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
                {lastFeedback.notes}
              </p>
            )}
          </>
        ) : (
          empty("Nessun questionario compilato.")
        )}
      </Card>
    </div>
  );
}
