"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { ActionMenu } from "@/components/ui/action-menu";
import { useCrm, updateCrm, useHydrated, removeCrmRecord } from "./store";
import { PlanEditor, AssignmentEditor } from "./plan-editor";
import { LocalNotice, FormError } from "./ui";
import { ConfirmDialog } from "./confirm-dialog";
import { ExerciseThumb } from "./exercise-media-view";
import type { WorkoutPlan, PlanAssignment } from "./fitness-model";
import { assignmentPeriod, periodLabel } from "./plan-cycles";
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
                  <div className="flex min-w-0 items-center gap-3">
                    <ExerciseThumb name={ex.name} videoUrl={ex.videoUrl} />
                    <p className="text-sm font-medium">
                      {ex.name || "Esercizio da completare"}
                    </p>
                  </div>
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
/** Where a plan lives: its client in Coaching online, or its guided program. */
export function planHome(
  plan: Pick<WorkoutPlan, "studentId" | "guidedCategory">,
) {
  if (plan.studentId)
    return {
      href: `/admin/coaching-online/${encodeURIComponent(plan.studentId)}`,
      label: "Torna al cliente",
    };
  if (plan.guidedCategory)
    return {
      href: `/admin/programmi-guidati/${plan.guidedCategory}`,
      label: "Torna al programma guidato",
    };
  return { href: "/admin/coaching-online", label: "Coaching online" };
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
          href="/admin/coaching-online"
          className="mt-4 inline-block text-sm underline"
        >
          Coaching online
        </Link>
      </>
    );
  return (
    <>
      <PageHeading
        title={plan.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href={planHome(plan).href}
              className="underline-offset-4 hover:underline"
            >
              {planHome(plan).label}
            </Link>
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
              .sort((a, b) =>
                assignmentPeriod(b).startsOn.localeCompare(
                  assignmentPeriod(a).startsOn,
                ),
              )
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
                        {periodLabel(a)}
                      </span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rimuovi l’assegnazione di ${s?.firstName ?? ""} ${s?.lastName ?? ""} per ${periodLabel(a)}`}
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
            router.push(planHome(plan).href);
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
          ? `${student?.firstName ?? "Lo studente"} ${student?.lastName ?? ""} non vedrà più “${assignment.snapshot.title}” del ciclo ${periodLabel(assignment)}. Anche i completamenti e le note di questo piano verranno eliminati. L’operazione resta nella cronologia dello studente e non si può annullare.`
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
  coachControl,
}: {
  assignment: PlanAssignment;
  onRemove?: () => void;
  coachControl?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">{assignment.snapshot.title}</h2>
          <p className="text-[13px] text-muted-foreground first-letter:uppercase">
            {periodLabel(assignment)}
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
      {coachControl && (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-subtle px-3 py-2.5">
          <span className="text-sm font-medium">Coach del piano</span>
          {coachControl}
        </div>
      )}
      <WorkoutContent plan={assignment.snapshot} />
    </section>
  );
}
const chipDots = {
  draft: "bg-neutral-400",
  published: "bg-emerald-500/100",
  archived: "bg-neutral-300",
};
export function StatusChip({ status }: { status: WorkoutPlan["status"] }) {
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
