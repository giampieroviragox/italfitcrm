"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Dumbbell, ArrowUpRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageTabs } from "@/components/ui/page-tabs";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { ActionMenu } from "@/components/ui/action-menu";
import { useCrm, updateCrm, useHydrated, removeCrmRecord } from "./store";
import { PlanEditor, AssignmentEditor } from "./plan-editor";
import { LocalNotice, FormError, control } from "./ui";
import { ConfirmDialog } from "./confirm-dialog";
import type { WorkoutPlan, PlanAssignment } from "./fitness-model";
import { formatMonth } from "@/lib/format";
const labels = {
  draft: "Bozza",
  published: "Pubblicato",
  archived: "Archiviato",
};
export function WorkoutContent({
  plan,
}: {
  plan: Pick<WorkoutPlan, "sessions" | "description">;
}) {
  return (
    <div className="space-y-6">
      {plan.description && (
        <p className="text-sm leading-6 text-muted-foreground">
          {plan.description}
        </p>
      )}
      {plan.sessions.map((session, i) => (
        <section key={session.id} className="overflow-hidden rounded-xl border">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-foreground/[.045] text-xs font-medium tabular-nums">
              {i + 1}
            </span>
            <h3 className="text-sm font-medium">
              {session.week ? `Settimana ${session.week} · ` : ""}
              {session.day ? `${session.day} · ` : ""}
              {session.name || "Sessione senza nome"}
            </h3>
          </div>
          {(session.preparation || session.guidance) && (
            <p className="whitespace-pre-line border-b px-4 py-3.5 text-sm leading-6 text-muted-foreground">
              {[
                session.preparation && `Riscaldamento\n${session.preparation}`,
                session.guidance,
              ]
                .filter(Boolean)
                .join("\n\n")}
            </p>
          )}
          <div className="divide-y">
            {session.exercises.map((ex) => (
              <div key={ex.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {ex.name || "Esercizio da completare"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ex.sets} serie × {ex.reps || "—"}
                    {ex.restSeconds > 0 ? ` · Recupero ${ex.restSeconds}s` : ""}
                  </p>
                </div>
                {ex.notes && (
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {ex.notes}
                  </p>
                )}
                {ex.videoUrl && /^https?:\/\//.test(ex.videoUrl) && (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-4"
                    href={ex.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Video esercizio
                    <ArrowUpRight className="size-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
          {session.cooldown && (
            <p className="whitespace-pre-line border-t px-4 py-3.5 text-sm leading-6 text-muted-foreground">
              {`Defaticamento\n${session.cooldown}`}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
export function PlansWorkspace() {
  const state = useCrm();
  const [editing, setEditing] = useState<WorkoutPlan | "new" | null>(null),
    [assign, setAssign] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");
  const all = state.plans ?? [];
  const plans = all.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      p.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Piani e percorsi"
        description="Prepara i piani di allenamento e assegnali mese per mese."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Nuovo piano
          </Button>
        }
      />
      <LocalNotice />
      {all.length > 0 && (
        <>
          <PageTabs
            label="Stato dei piani"
            className="mb-4"
            value={status}
            onChange={setStatus}
            tabs={[
              { value: "all", label: "Tutti", count: all.length },
              {
                value: "published",
                label: "Pubblicati",
                count: all.filter((p) => p.status === "published").length,
              },
              {
                value: "draft",
                label: "Bozze",
                count: all.filter((p) => p.status === "draft").length,
              },
              {
                value: "archived",
                label: "Archiviati",
                count: all.filter((p) => p.status === "archived").length,
              },
            ]}
          />
          <div className="relative mb-4">
            <Search
              className="absolute top-3 left-3 size-4 text-muted-foreground"
              aria-hidden
            />
            <input
              aria-label="Cerca piani"
              placeholder="Cerca un piano…"
              className={`${control} rounded-xl pl-9`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </>
      )}
      {!plans.length ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
          <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-foreground/[.045]">
            <Dumbbell className="size-5" strokeWidth={1.75} />
          </span>
          <h2 className="text-base font-medium">
            {query || status !== "all"
              ? "Nessun piano trovato"
              : "Crea il primo piano"}
          </h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {query || status !== "all"
              ? "Nessun piano corrisponde alla ricerca e allo stato selezionato."
              : "Crea le sessioni, aggiungi gli esercizi e pubblica il piano prima di assegnarlo."}
          </p>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => {
              if (query || status !== "all") {
                setQuery("");
                setStatus("all");
              } else setEditing("new");
            }}
          >
            {query || status !== "all" ? "Azzera filtri" : "Crea piano"}
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-1 text-[13px] text-muted-foreground">
            {plans.length} {plans.length === 1 ? "piano" : "piani"}
          </p>
          <ul className="-mx-2">
            {plans.map((p) => {
              const assigned =
                state.assignments?.filter((a) => a.planId === p.id).length ?? 0;
              return (
                <li
                  key={p.id}
                  className="group relative flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-foreground/[.03]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[.045]">
                    <Dumbbell className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      className="block truncate text-sm font-medium after:absolute after:inset-0"
                      href={`/admin/piani/${encodeURIComponent(p.id)}`}
                    >
                      {p.title}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.description || "Nessuna descrizione"}
                    </span>
                  </span>
                  <span className="hidden w-40 shrink-0 text-[13px] text-muted-foreground tabular-nums md:block">
                    {p.sessions.length}{" "}
                    {p.sessions.length === 1 ? "sessione" : "sessioni"} ·{" "}
                    {assigned} {assigned === 1 ? "studente" : "studenti"}
                  </span>
                  <span className="hidden w-24 shrink-0 sm:block">
                    <StatusChip status={p.status} />
                  </span>
                  <span className="relative flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={p.status !== "published"}
                      onClick={() => setAssign(p.id)}
                    >
                      Assegna
                    </Button>
                    <ActionMenu
                      label={`Azioni per ${p.title}`}
                      items={[
                        { label: "Modifica", onSelect: () => setEditing(p) },
                        {
                          label: "Apri dettaglio",
                          href: `/admin/piani/${encodeURIComponent(p.id)}`,
                        },
                      ]}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editing && (
        <PlanEditor
          plan={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
        />
      )}
      {assign && (
        <AssignmentEditor planId={assign} close={() => setAssign(null)} />
      )}
    </>
  );
}
export function PlanDetail({ id }: { id: string }) {
  const state = useCrm(),
    hydrated = useHydrated(),
    router = useRouter();
  const [editing, setEditing] = useState(false),
    [assign, setAssign] = useState(false),
    [archive, setArchive] = useState(false),
    [removing, setRemoving] = useState<PlanAssignment | null>(null),
    [deleting, setDeleting] = useState(false),
    [deleted, setDeleted] = useState(false),
    [error, setError] = useState("");
  const plan = state.plans?.find((p) => p.id === id);
  const assigned = (state.assignments ?? []).some((a) => a.planId === id);
  if (deleted) return <p role="status">Piano eliminato.</p>;
  if (!hydrated) return <p role="status">Caricamento piano…</p>;
  if (!plan)
    return (
      <>
        <h1 className="text-xl font-medium">Piano non trovato</h1>
        <Link
          href="/admin/piani"
          className="mt-4 inline-block text-sm underline"
        >
          Tutti i piani
        </Link>
      </>
    );
  return (
    <>
      <PageHeading
        title={plan.title}
        description={
          <span className="flex items-center gap-2">
            <StatusChip status={plan.status} />
            {plan.sessions.length}{" "}
            {plan.sessions.length === 1 ? "sessione" : "sessioni"}
          </span>
        }
        action={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Modifica
            </Button>
            <Button
              disabled={plan.status !== "published"}
              onClick={() => setAssign(true)}
            >
              Assegna piano
            </Button>
            <ActionMenu
              label="Azioni piano"
              items={[
                {
                  label:
                    plan.status === "archived"
                      ? "Ripristina come bozza"
                      : "Archivia piano",
                  onSelect: () => setArchive(true),
                },
                ...(assigned
                  ? []
                  : [
                      {
                        label: "Elimina piano",
                        onSelect: () => setDeleting(true),
                      },
                    ]),
              ]}
            />
          </>
        }
      />
      <LocalNotice />
      <FormError message={error} />
      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <WorkoutContent plan={plan} />
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Assegnazioni
          </h2>
          <div className="-mx-2">
            {(state.assignments ?? [])
              .filter((a) => a.planId === id)
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((a) => {
                const s = state.students.find((s) => s.id === a.studentId);
                return (
                  <div key={a.id} className="flex items-center gap-1">
                    <Link
                      href={`/admin/studenti/${encodeURIComponent(a.studentId)}`}
                      className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-3 rounded-[10px] px-2 py-2 text-sm transition-colors hover:bg-foreground/[.03]"
                    >
                      <span className="truncate">
                        {s?.firstName} {s?.lastName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground first-letter:uppercase">
                        {formatMonth(a.month)}
                      </span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rimuovi l’assegnazione di ${s?.firstName ?? ""} ${s?.lastName ?? ""} per ${formatMonth(a.month)}`}
                      onClick={() => {
                        setError("");
                        setRemoving(a);
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                );
              })}
          </div>
          {!state.assignments?.some((a) => a.planId === id) && (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Nessuno studente assegnato.
            </p>
          )}
        </section>
      </div>
      <RemoveAssignmentDialog
        assignment={removing}
        close={() => setRemoving(null)}
      />
      <ConfirmDialog
        error={error}
        open={deleting}
        title="Eliminare il piano?"
        description="Il piano non è assegnato a nessuno studente e verrà eliminato definitivamente. L’operazione non si può annullare."
        confirmLabel="Elimina"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await removeCrmRecord({ planId: id });
            setDeleting(false);
            setDeleted(true);
            router.push("/admin/piani");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      {editing && <PlanEditor plan={plan} close={() => setEditing(false)} />}
      {assign && (
        <AssignmentEditor planId={id} close={() => setAssign(false)} />
      )}
      <ConfirmDialog
        error={error}
        open={archive}
        title={
          plan.status === "archived"
            ? "Ripristinare il piano?"
            : "Archiviare il piano?"
        }
        description="Le copie già assegnate agli studenti vengono conservate."
        confirmLabel={plan.status === "archived" ? "Ripristina" : "Archivia"}
        onCancel={() => setArchive(false)}
        onConfirm={async () => {
          try {
            await updateCrm((s) => ({
              ...s,
              plans: s.plans?.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      status: p.status === "archived" ? "draft" : "archived",
                    }
                  : p,
              ),
            }));
            setArchive(false);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
    </>
  );
}
/** Confirms and removes an assignment: the student no longer sees it. */
export function RemoveAssignmentDialog({
  assignment,
  close,
}: {
  assignment: PlanAssignment | null;
  close: () => void;
}) {
  const state = useCrm();
  const [error, setError] = useState("");
  const student = state.students.find((s) => s.id === assignment?.studentId);
  return (
    <ConfirmDialog
      error={error}
      open={assignment !== null}
      title="Rimuovere l’assegnazione?"
      description={
        assignment
          ? `${student?.firstName ?? "Lo studente"} ${student?.lastName ?? ""} non vedrà più “${assignment.snapshot.title}” di ${formatMonth(assignment.month)}. Anche i completamenti e le note di questo piano verranno eliminati. L’operazione resta nella cronologia dello studente e non si può annullare.`
          : ""
      }
      confirmLabel="Rimuovi"
      onCancel={() => {
        setError("");
        close();
      }}
      onConfirm={async () => {
        if (!assignment) return;
        try {
          await removeCrmRecord({ assignmentId: assignment.id });
          setError("");
          close();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    />
  );
}
export function AssignedPlan({
  assignment,
  onRemove,
}: {
  assignment: PlanAssignment;
  onRemove?: () => void;
}) {
  return (
    <section className="rounded-xl border p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">{assignment.snapshot.title}</h2>
          <p className="text-[13px] text-muted-foreground first-letter:uppercase">
            {formatMonth(assignment.month)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-foreground/[.045] px-2.5 py-0.5 text-xs">
            {assignment.snapshot.sessions.length}{" "}
            {assignment.snapshot.sessions.length === 1
              ? "sessione"
              : "sessioni"}
          </span>
          {onRemove && (
            <Button variant="outline" size="sm" onClick={onRemove}>
              Rimuovi
            </Button>
          )}
        </div>
      </div>
      <WorkoutContent plan={assignment.snapshot} />
    </section>
  );
}
const chipDots = {
  draft: "bg-neutral-400",
  published: "bg-emerald-500/100",
  archived: "bg-neutral-300",
};
function StatusChip({ status }: { status: WorkoutPlan["status"] }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-foreground/[.045] px-2.5 text-xs font-medium text-foreground">
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${chipDots[status]}`}
      />
      {labels[status]}
    </span>
  );
}
