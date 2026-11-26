"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { todayRome } from "./fitness-logic";
import type { PlanAssignment, WorkoutPlan } from "./fitness-model";
import {
  assignmentsInPeriod,
  currentSubscription,
  includedPlans,
  subscriptionStatus,
} from "./online-coaching";
import {
  PlanCoachSelect,
  SubscriptionStatusBadge,
  coachLabel,
  durationLabel,
} from "./online-coaching-view";
import {
  assignmentPeriod,
  formatDay,
  guidedLabel,
  runningAssignments,
  trackDue,
  type CycleDue,
} from "./plan-cycles";
import { AssignmentEditor, PlanEditor } from "./plan-editor";
import {
  AssignedPlan,
  RemoveAssignmentDialog,
  StatusChip,
} from "./plans-workspace";
import { useCan, useCrm, useHydrated } from "./store";
import { studentAccess } from "./tier-access";
import { LocalNotice } from "./ui";

/** What the next cycle needs, in one line. */
export function dueText(due: CycleDue, today: string) {
  if (due.state === "running")
    return `Ciclo in corso fino al ${formatDay(due.endsOn)}`;
  if (due.state === "planned")
    return `Prossimo ciclo già pronto: inizia il ${formatDay(due.startsOn)}`;
  return due.dueOn <= today
    ? `Da preparare: il ciclo è iniziato il ${formatDay(due.dueOn)}`
    : `Da preparare: il prossimo ciclo inizia il ${formatDay(due.dueOn)}`;
}

/** A Coaching online client: running plan, plans being prepared, past cycles. */
export function CoachingClient({ id }: { id: string }) {
  const state = useCrm();
  const hydrated = useHydrated();
  const can = useCan();
  const today = todayRome();
  const [editing, setEditing] = useState<WorkoutPlan | "new" | null>(null),
    [assigning, setAssigning] = useState<string | null>(null),
    [removing, setRemoving] = useState<PlanAssignment | null>(null);
  if (!hydrated)
    return (
      <p role="status" className="py-12 text-sm text-muted-foreground">
        Caricamento…
      </p>
    );
  const student = state.students.find((s) => s.id === id);
  if (!student)
    return (
      <>
        <h1 className="text-xl font-medium">Cliente non trovato</h1>
        <Link
          href="/admin/coaching-online"
          className="mt-4 inline-block text-sm underline"
        >
          Coaching online
        </Link>
      </>
    );
  const canPlans = can("plans");
  const plansEnabled = studentAccess(state, student).plans;
  const mine = (state.assignments ?? []).filter(
    (a) => a.studentId === id && !a.guidedCategory,
  );
  const running = runningAssignments(mine, today)[0];
  const upcoming = mine
    .filter((a) => assignmentPeriod(a).startsOn > today)
    .toSorted((a, b) =>
      assignmentPeriod(a).startsOn.localeCompare(assignmentPeriod(b).startsOn),
    );
  const past = mine
    .filter((a) => assignmentPeriod(a).endsOn < today)
    .toSorted((a, b) =>
      assignmentPeriod(b).startsOn.localeCompare(assignmentPeriod(a).startsOn),
    );
  const subscription = currentSubscription(student.onlineSubscriptions, today);
  const due = trackDue(mine, today, subscription?.startsOn);
  const plans = (state.plans ?? [])
    .filter((p) => p.studentId === id && p.status !== "archived")
    .toSorted(
      (a, b) =>
        Number(a.status === "published") - Number(b.status === "published"),
    );
  const name = `${student.firstName} ${student.lastName}`.trim();
  const cycle = (a: PlanAssignment) => (
    <AssignedPlan
      key={a.id}
      assignment={a}
      onRemove={canPlans ? () => setRemoving(a) : undefined}
      coachControl={canPlans ? <PlanCoachSelect assignment={a} /> : undefined}
    />
  );
  return (
    <>
      <PageHeading
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href="/admin/coaching-online"
              className="underline-offset-4 hover:underline"
            >
              Coaching online
            </Link>
            <Link
              href={`/admin/studenti/${encodeURIComponent(id)}`}
              className="underline-offset-4 hover:underline"
            >
              Scheda studente
            </Link>
          </span>
        }
        action={
          canPlans && (
            <Button
              disabled={student.archived || !plansEnabled}
              onClick={() => setEditing("new")}
            >
              <Plus className="size-4" aria-hidden />
              Nuovo piano
            </Button>
          )
        }
      />
      <LocalNotice />
      {!plansEnabled && (
        <p className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm">
          Il tier di questo studente non include i piani di allenamento.
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="running-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="running-heading" className="text-base font-semibold">
                Piano in corso
              </h2>
              <p
                className={`text-sm ${due.state === "due" ? "font-medium text-[var(--workspace-accent)]" : "text-muted-foreground"}`}
              >
                {dueText(due, today)}
              </p>
            </div>
            {running ? (
              cycle(running)
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Nessun ciclo in corso oggi.
              </p>
            )}
          </section>
          {upcoming.length > 0 && (
            <section aria-labelledby="next-heading" className="space-y-3">
              <h2 id="next-heading" className="text-base font-semibold">
                Prossimi cicli
              </h2>
              {upcoming.map(cycle)}
            </section>
          )}
          <section aria-labelledby="history-heading" className="space-y-2">
            <h2 id="history-heading" className="text-base font-semibold">
              Storico
            </h2>
            {past.length ? (
              <ul className="space-y-2">
                {past.map((a) => (
                  <li key={a.id}>
                    <details className="group rounded-xl border bg-card">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {a.snapshot.title}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDay(assignmentPeriod(a).startsOn)} →{" "}
                            {formatDay(assignmentPeriod(a).endsOn)}
                          </span>
                        </span>
                        <ChevronDown
                          className="size-4 shrink-0 transition-transform group-open:rotate-180"
                          aria-hidden
                        />
                      </summary>
                      <div className="border-t p-3">{cycle(a)}</div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessun ciclo concluso.
              </p>
            )}
          </section>
        </div>
        <aside className="min-w-0 space-y-6">
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Abbonamento</h2>
            {subscription ? (
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Stato</dt>
                <dd>
                  <SubscriptionStatusBadge
                    status={subscriptionStatus(subscription, today)}
                  />
                </dd>
                <dt className="text-muted-foreground">Pacchetto</dt>
                <dd>{durationLabel(subscription.durationMonths)}</dd>
                <dt className="text-muted-foreground">Periodo</dt>
                <dd className="tabular-nums">
                  {formatDate(subscription.startsOn)} →{" "}
                  {formatDate(subscription.endsOn)}
                </dd>
                <dt className="text-muted-foreground">Coach</dt>
                <dd>{coachLabel(state, subscription.coachId)}</dd>
                <dt className="text-muted-foreground">Piani</dt>
                <dd className="tabular-nums">
                  {
                    assignmentsInPeriod(
                      state.assignments ?? [],
                      id,
                      subscription,
                    ).length
                  }{" "}
                  di {includedPlans(subscription)}
                </dd>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Nessun abbonamento registrato.
              </p>
            )}
            <Link
              href={`/admin/studenti/${encodeURIComponent(id)}?tab=coaching`}
              className="mt-3 inline-block text-sm underline-offset-4 hover:underline"
            >
              Gestisci abbonamento e pagamenti
            </Link>
          </section>
          <section
            aria-labelledby="plans-heading"
            className="rounded-2xl border bg-card"
          >
            <div className="border-b px-4 py-3">
              <h2 id="plans-heading" className="text-sm font-semibold">
                Piani del cliente
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Le bozze arrivano anche da Claude. Pubblica e assegna il
                prossimo ciclo.
              </p>
            </div>
            {plans.length ? (
              <ul className="divide-y">
                {plans.map((p) => (
                  <li key={p.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/piani/${encodeURIComponent(p.id)}`}
                        className="min-w-0 text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {p.title || "Senza titolo"}
                      </Link>
                      <StatusChip status={p.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.sessions.length}{" "}
                      {p.sessions.length === 1 ? "sessione" : "sessioni"}
                      {" · "}
                      {(() => {
                        const n = (state.assignments ?? []).filter(
                          (a) => a.planId === p.id,
                        ).length;
                        return n
                          ? `assegnato a ${n} ${n === 1 ? "ciclo" : "cicli"}`
                          : "non ancora assegnato";
                      })()}
                    </p>
                    {canPlans && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(p)}
                        >
                          Modifica
                        </Button>
                        <Button
                          size="sm"
                          disabled={
                            p.status !== "published" ||
                            student.archived ||
                            !plansEnabled
                          }
                          title={
                            p.status !== "published"
                              ? "Pubblica il piano per assegnarlo"
                              : undefined
                          }
                          onClick={() => setAssigning(p.id)}
                        >
                          Assegna ciclo
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nessun piano. Crealo qui o chiedi a Claude di caricarlo nel CRM
                per {name}.
              </p>
            )}
          </section>
          {Boolean(student.guidedPrograms?.length) && (
            <section className="rounded-2xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Programmi guidati</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {student.guidedPrograms!.map((g) => (
                  <li key={g.category}>
                    <Link
                      href={`/admin/programmi-guidati/${g.category}`}
                      className="inline-flex min-h-10 items-center rounded-full border px-3 text-sm hover:bg-subtle"
                    >
                      {guidedLabel(g.category)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
      {editing && (
        <PlanEditor
          plan={editing === "new" ? undefined : editing}
          owner={{ studentId: id }}
          close={() => setEditing(null)}
        />
      )}
      {assigning && (
        <AssignmentEditor
          planId={assigning}
          studentId={id}
          close={() => setAssigning(null)}
        />
      )}
      <RemoveAssignmentDialog
        assignment={removing}
        close={() => setRemoving(null)}
      />
    </>
  );
}
