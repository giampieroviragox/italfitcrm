"use client";

import Link from "next/link";
import { useState } from "react";
import { Laptop, Search } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { PageTabs } from "@/components/ui/page-tabs";
import { SelectControl } from "@/components/ui/select-control";
import { formatDate } from "@/lib/format";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import { todayRome } from "./fitness-logic";
import { normalize } from "./model";
import {
  assignmentCoachId,
  assignmentsInPeriod,
  currentSubscription,
  daysBetween,
  includedPlans,
  subscriptionStatus,
  type SubscriptionStatus,
} from "./online-coaching";
import {
  SubscriptionStatusBadge,
  coachLabel,
  durationLabel,
} from "./online-coaching-view";
import { useCrm, useHydrated } from "./store";
import { studentAccess } from "./tier-access";
import { LocalNotice, control } from "./ui";
import { formatDay, shiftDay, trackDue, type CycleDue } from "./plan-cycles";
import { dueText } from "./coaching-client";

type Filter = "all" | SubscriptionStatus;
const order: Record<SubscriptionStatus, number> = {
  expiring: 0,
  active: 1,
  upcoming: 2,
  expired: 3,
};

export function OnlineCoachingWorkspace() {
  const state = useCrm();
  const hydrated = useHydrated();
  const [status, setStatus] = useState<Filter>("all");
  const [coach, setCoach] = useState("all");
  const [query, setQuery] = useState("");
  const today = todayRome();
  if (!hydrated)
    return (
      <p role="status" className="py-12 text-sm text-muted-foreground">
        Caricamento…
      </p>
    );
  const rows = state.students
    .filter((s) => !s.archived && s.onlineSubscriptions?.length)
    .map((student) => {
      const subscription = currentSubscription(
        student.onlineSubscriptions,
        today,
      )!;
      return {
        student,
        subscription,
        status: subscriptionStatus(subscription, today),
        assigned: assignmentsInPeriod(
          state.assignments ?? [],
          student.id,
          subscription,
        ),
      };
    });
  const missing = state.students.filter(
    (s) =>
      !s.archived &&
      !s.onlineSubscriptions?.length &&
      !s.guidedPrograms?.length &&
      studentAccess(state, s).plans,
  );
  // Clients whose next four-week cycle has to be prepared, soonest first.
  const todo = rows
    .flatMap((r) => {
      if (r.status === "expired") return [];
      if (
        r.status === "upcoming" &&
        r.subscription.startsOn > shiftDay(today, 7)
      )
        return [];
      const due = trackDue(
        (state.assignments ?? []).filter(
          (a) => a.studentId === r.student.id && !a.guidedCategory,
        ),
        today,
        r.subscription.startsOn,
      );
      if (
        due.state !== "due" ||
        due.dueOn > r.subscription.endsOn ||
        r.assigned.length >= includedPlans(r.subscription)
      )
        return [];
      return [{ ...r, due: due as Extract<CycleDue, { state: "due" }> }];
    })
    .toSorted((a, b) => a.due.dueOn.localeCompare(b.due.dueOn));
  const coaches = state.admins.filter((a) =>
    rows.some((r) => r.subscription.coachId === a.id),
  );
  const q = normalize(query);
  const visible = rows
    .filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (coach === "all" || r.subscription.coachId === coach) &&
        (!q ||
          normalize(
            `${r.student.firstName} ${r.student.lastName} ${r.student.email}`,
          ).includes(q)),
    )
    .toSorted(
      (a, b) =>
        order[a.status] - order[b.status] ||
        a.subscription.endsOn.localeCompare(b.subscription.endsOn),
    );
  // Plans followed by someone other than the subscription coach, e.g. "· 3 con Marta".
  const otherCoaches = (
    assigned: (typeof rows)[number]["assigned"],
    subscriptionCoach: string,
  ) => {
    const counts = new Map<string, number>();
    for (const a of assigned) {
      const id = assignmentCoachId(state, a);
      if (id && id !== subscriptionCoach)
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts]
      .map(([id, n]) => ` · ${n} con ${coachLabel(state, id)}`)
      .join("");
  };
  const count = (s: SubscriptionStatus) =>
    rows.filter((r) => r.status === s).length;
  const filtered = status !== "all" || coach !== "all" || Boolean(query);
  return (
    <>
      <PageHeading
        title="Coaching online"
        description="Clienti, scadenze e coach. Ogni mese di abbonamento include un piano da quattro settimane: apri un cliente per il piano in corso, le bozze e lo storico."
      />
      <LocalNotice />
      {todo.length > 0 && (
        <section
          aria-labelledby="todo-heading"
          className="mb-6 overflow-hidden rounded-2xl border bg-card"
        >
          <div className="flex items-center justify-between border-b bg-subtle px-4 py-2.5">
            <h2 id="todo-heading" className="text-sm font-semibold">
              Programmi da fare
            </h2>
            <span className="text-xs text-muted-foreground">
              {todo.length} {todo.length === 1 ? "cliente" : "clienti"}
            </span>
          </div>
          <ul className="divide-y">
            {todo.map(({ student, subscription: s, due, assigned }, i) => (
              <li key={student.id}>
                <Link
                  href={`/admin/coaching-online/${encodeURIComponent(student.id)}`}
                  className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-subtle sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto] sm:items-center"
                >
                  <StudentIdentity student={student} index={i} />
                  <p className="text-muted-foreground">{dueText(due, today)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {due.dueOn <= today
                      ? "Da fare subito"
                      : `Entro il ${formatDay(due.dueOn)}`}{" "}
                    · piano {assigned.length + 1} di {includedPlans(s)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-2 sm:px-3">
          <PageTabs
            label="Stato degli abbonamenti"
            className="border-0 pt-0 pb-0 [&_[role=tab]]:h-10 [&_[role=tab]]:after:hidden"
            value={status}
            onChange={(v) => setStatus(v as Filter)}
            tabs={[
              { value: "all", label: "Tutti", count: rows.length },
              { value: "active", label: "Attivi", count: count("active") },
              {
                value: "expiring",
                label: "In scadenza",
                count: count("expiring"),
              },
              {
                value: "upcoming",
                label: "Da iniziare",
                count: count("upcoming"),
              },
              { value: "expired", label: "Scaduti", count: count("expired") },
            ]}
          />
          <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-none">
            <div className="min-w-36 flex-1 sm:w-44">
              <SelectControl
                aria-label="Filtra per coach"
                className={`${control} rounded-xl`}
                value={coach}
                onChange={(e) => setCoach(e.target.value)}
              >
                <option value="all">Tutti i coach</option>
                {coaches.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </SelectControl>
            </div>
            <div className="relative min-w-40 flex-1 sm:w-56">
              <Search
                className="absolute top-3 left-3 size-4 text-muted-foreground"
                aria-hidden
              />
              <input
                aria-label="Cerca studenti"
                placeholder="Cerca uno studente…"
                className={`${control} rounded-xl pl-9`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
      {!visible.length ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border bg-card px-6 py-12 text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-full bg-muted text-[var(--workspace-accent)]">
            <Laptop className="size-5" strokeWidth={1.75} />
          </span>
          <h2 className="text-base font-medium">
            {filtered ? "Nessun abbonamento trovato" : "Nessun abbonamento"}
          </h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {filtered
              ? "Nessun abbonamento corrisponde ai filtri selezionati."
              : "Crea un abbonamento dalla scheda dello studente, nella sezione Coaching online."}
          </p>
          {filtered ? (
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => {
                setStatus("all");
                setCoach("all");
                setQuery("");
              }}
            >
              Azzera filtri
            </Button>
          ) : (
            <Button asChild className="mt-5" variant="outline">
              <Link href="/admin/studenti">Vai agli studenti</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b bg-subtle px-4 py-2.5">
            <h2 className="text-sm font-semibold">Clienti</h2>
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {visible.length} {visible.length === 1 ? "cliente" : "clienti"}
            </span>
          </div>
          <ul className="divide-y">
            {visible.map(
              ({ student, subscription: s, status, assigned }, i) => {
                const left = daysBetween(today, s.endsOn);
                return (
                  <li key={student.id}>
                    <Link
                      href={`/admin/coaching-online/${encodeURIComponent(student.id)}`}
                      className="grid gap-x-4 gap-y-2 px-4 py-3.5 text-sm transition-colors hover:bg-subtle sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <StudentIdentity student={student} index={i} />
                      <div className="min-w-0">
                        <p className="font-medium">
                          {durationLabel(s.durationMonths)}
                        </p>
                        <p className="text-muted-foreground tabular-nums">
                          {formatDate(s.startsOn)} → {formatDate(s.endsOn)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate">
                          {coachLabel(state, s.coachId)}
                        </p>
                        <p className="text-muted-foreground tabular-nums">
                          Piani {assigned.length} di {includedPlans(s)}
                          {otherCoaches(assigned, s.coachId)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        <SubscriptionStatusBadge status={status} />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {status === "expired"
                            ? `Scaduto da ${-left} ${-left === 1 ? "giorno" : "giorni"}`
                            : status === "upcoming"
                              ? `Inizia tra ${daysBetween(today, s.startsOn)} gg`
                              : left === 0
                                ? "Scade oggi"
                                : `Scade tra ${left} ${left === 1 ? "giorno" : "giorni"}`}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              },
            )}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <section className="mt-6 rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">
            Con accesso ai piani ma senza abbonamento
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Questi studenti hanno un tier con i piani attivi. Apri la scheda per
            registrare il loro abbonamento.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {missing.map((student) => (
              <li key={student.id}>
                <Link
                  href={`/admin/studenti/${encodeURIComponent(student.id)}?tab=coaching`}
                  className="inline-flex min-h-10 items-center rounded-full border px-3 text-sm hover:bg-subtle"
                >
                  {student.firstName} {student.lastName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
