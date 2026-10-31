"use client";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useState } from "react";
import { Plus, Dumbbell, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { ActionMenu } from "@/components/ui/action-menu";
import { useCrm, updateCrm, useHydrated } from "./store";
import { PlanEditor, AssignmentEditor } from "./plan-editor";
import { LocalNotice, FormError } from "./ui";
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
          <div className="flex items-center gap-3 border-b bg-muted/40 px-5 py-4">
            <span className="flex size-7 items-center justify-center rounded-lg border bg-white text-xs">
              {i + 1}
            </span>
            <h3 className="text-sm font-medium">
              {session.name || "Sessione senza nome"}
            </h3>
          </div>
          <div className="divide-y">
            {session.exercises.map((ex) => (
              <div key={ex.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {ex.name || "Esercizio da completare"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ex.sets} serie × {ex.reps || "—"} · Recupero{" "}
                    {ex.restSeconds}s
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
  const plans = (state.plans ?? []).filter(
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
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          aria-label="Cerca piani"
          placeholder="Cerca un piano…"
          className="h-10 w-full rounded-xl border px-3 text-sm sm:max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SelectControl
          aria-label="Stato piani"
          className="h-10 rounded-xl border bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Tutti gli stati</option>
          <option value="draft">Bozze</option>
          <option value="published">Pubblicati</option>
          <option value="archived">Archiviati</option>
        </SelectControl>
      </div>
      {!plans.length ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center">
          <Dumbbell className="mb-5 size-7 text-muted-foreground" />
          <h2 className="text-lg font-medium">
            {query || status !== "all"
              ? "Nessun piano trovato"
              : "Crea il primo piano"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {query || status !== "all"
              ? "Nessun piano corrisponde alla ricerca e allo stato selezionato."
              : "Crea le sessioni, aggiungi gli esercizi e pubblica il piano prima di assegnarlo."}
          </p>
          <Button
            className="mt-6"
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.id}
              className="flex flex-col rounded-2xl border p-5"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl border bg-muted/30">
                  <Dumbbell className="size-4 text-muted-foreground" />
                </span>
                <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  {labels[p.status]}
                </span>
              </div>
              <Link
                className="mt-5 text-base font-medium tracking-tight hover:underline"
                href={`/admin/piani/${encodeURIComponent(p.id)}`}
              >
                {p.title}
              </Link>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">
                {p.description || "Nessuna descrizione"}
              </p>
              <div className="mt-auto pt-6">
                <p className="mb-4 text-xs text-muted-foreground">
                  {p.sessions.length}{" "}
                  {p.sessions.length === 1 ? "sessione" : "sessioni"} ·{" "}
                  {state.assignments?.filter((a) => a.planId === p.id).length ??
                    0}{" "}
                  assegnazioni
                </p>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    disabled={p.status !== "published"}
                    onClick={() => setAssign(p.id)}
                  >
                    Assegna
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(p)}>
                    Modifica
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
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
    hydrated = useHydrated();
  const [editing, setEditing] = useState(false),
    [assign, setAssign] = useState(false),
    [archive, setArchive] = useState(false),
    [error, setError] = useState("");
  const plan = state.plans?.find((p) => p.id === id);
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
      <Link
        href="/admin/piani"
        className="mb-6 inline-block text-xs text-muted-foreground"
      >
        ← Tutti i piani
      </Link>
      <PageHeading
        title={plan.title}
        description={`${labels[plan.status]} · ${plan.sessions.length} ${plan.sessions.length === 1 ? "sessione" : "sessioni"}`}
        action={
          <>
            <Button
              disabled={plan.status !== "published"}
              onClick={() => setAssign(true)}
            >
              Assegna piano
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Modifica
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
              ]}
            />
          </>
        }
      />
      <LocalNotice />
      <FormError message={error} />
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <WorkoutContent plan={plan} />
        <section className="rounded-xl border p-5">
          <h2 className="text-sm font-medium">Assegnazioni</h2>
          <div className="mt-4 divide-y">
            {(state.assignments ?? [])
              .filter((a) => a.planId === id)
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((a) => {
                const s = state.students.find((s) => s.id === a.studentId);
                return (
                  <Link
                    key={a.id}
                    href={`/admin/studenti/${encodeURIComponent(a.studentId)}`}
                    className="flex items-center justify-between gap-3 py-3 text-xs"
                  >
                    <span>
                      {s?.firstName} {s?.lastName}
                    </span>
                    <span className="text-muted-foreground">
                      {formatMonth(a.month)}
                    </span>
                  </Link>
                );
              })}
          </div>
          {!state.assignments?.some((a) => a.planId === id) && (
            <p className="mt-3 text-xs text-muted-foreground">
              Nessuno studente assegnato.
            </p>
          )}
        </section>
      </div>
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
export function AssignedPlan({ assignment }: { assignment: PlanAssignment }) {
  return (
    <section className="rounded-2xl border p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">{assignment.snapshot.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Piano mensile · {formatMonth(assignment.month)}
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-[11px]">
          {assignment.snapshot.sessions.length}{" "}
          {assignment.snapshot.sessions.length === 1 ? "sessione" : "sessioni"}
        </span>
      </div>
      <WorkoutContent plan={assignment.snapshot} />
    </section>
  );
}
