"use client";

import Link from "next/link";
import { useState } from "react";
import { Folder, Plus } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time-picker";
import { SelectControl } from "@/components/ui/select-control";
import { ConfirmDialog } from "./confirm-dialog";
import { todayRome } from "./fitness-logic";
import type { PlanAssignment, WorkoutPlan } from "./fitness-model";
import type { CrmState, CrmStudent } from "./model";
import {
  currentGuidedVersion,
  cycleEnd,
  formatDay,
  guidedCategories,
  guidedLabel,
  trackDue,
  type CycleDue,
  type GuidedCategory,
} from "./plan-cycles";
import { dueText } from "./coaching-client";
import { PlanEditor } from "./plan-editor";
import { StatusChip } from "./plans-workspace";
import { updateCrm, useCan, useCrm, useHydrated } from "./store";
import { studentAccess } from "./tier-access";
import {
  Editor,
  EditorCancel,
  Field,
  FormError,
  LocalNotice,
  control,
} from "./ui";

/** Subscribers of a guided program with where their four-week cycle stands. */
export function guidedSubscribers(
  state: CrmState,
  category: GuidedCategory,
  today: string,
) {
  return state.students
    .filter((s) => !s.archived)
    .flatMap((student) => {
      const enrollment = student.guidedPrograms?.find(
        (g) => g.category === category,
      );
      if (!enrollment) return [];
      const track = (state.assignments ?? []).filter(
        (a) => a.studentId === student.id && a.guidedCategory === category,
      );
      return [
        {
          student,
          enrollment,
          due: trackDue(track, today, enrollment.startsOn),
        },
      ];
    })
    .toSorted((a, b) =>
      `${a.student.lastName} ${a.student.firstName}`.localeCompare(
        `${b.student.lastName} ${b.student.firstName}`,
        "it",
      ),
    );
}
const isDue = (due: CycleDue): due is Extract<CycleDue, { state: "due" }> =>
  due.state === "due";

/** The four guided programs, as folders. */
export function GuidedPrograms() {
  const state = useCrm();
  const hydrated = useHydrated();
  const today = todayRome();
  if (!hydrated)
    return (
      <p role="status" className="py-12 text-sm text-muted-foreground">
        Caricamento…
      </p>
    );
  return (
    <>
      <PageHeading
        title="Programmi guidati"
        description="Hyrox, Old School, Hybrid e Home Edition: ogni abbonato riceve la versione corrente del programma a cicli di quattro settimane, dalla sua data di iscrizione."
      />
      <LocalNotice />
      <ul className="grid gap-4 sm:grid-cols-2">
        {guidedCategories.map((c) => {
          const version = currentGuidedVersion(state.plans, c.id);
          const subscribers = guidedSubscribers(state, c.id, today);
          const due = subscribers.filter((s) => isDue(s.due)).length;
          return (
            <li key={c.id}>
              <Link
                href={`/admin/programmi-guidati/${c.id}`}
                className="flex h-full items-start gap-4 rounded-2xl border bg-card p-5 transition-colors hover:bg-subtle"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-[var(--workspace-accent)]">
                  <Folder className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block text-base font-semibold">
                    {c.label}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {version
                      ? `Versione corrente: ${version.title}`
                      : "Nessuna versione pubblicata"}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {subscribers.length}{" "}
                    {subscribers.length === 1 ? "abbonato" : "abbonati"}
                    {due ? ` · ${due} da rinnovare` : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** One guided program: its versions and its subscribers. */
export function GuidedProgram({ category }: { category: GuidedCategory }) {
  const state = useCrm();
  const hydrated = useHydrated();
  const can = useCan();
  const today = todayRome();
  const [editing, setEditing] = useState<WorkoutPlan | "new" | null>(null),
    [assigning, setAssigning] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [enrolling, setEnrolling] = useState(false),
    [leaving, setLeaving] = useState<CrmStudent | null>(null);
  if (!hydrated)
    return (
      <p role="status" className="py-12 text-sm text-muted-foreground">
        Caricamento…
      </p>
    );
  const label = guidedLabel(category);
  const canPlans = can("plans");
  const version = currentGuidedVersion(state.plans, category);
  const others = (state.plans ?? [])
    .filter((p) => p.guidedCategory === category && p.id !== version?.id)
    .toSorted(
      (a, b) =>
        Number(a.status !== "draft") - Number(b.status !== "draft") ||
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    );
  const subscribers = guidedSubscribers(state, category, today);
  const due = subscribers.filter(
    (
      s,
    ): s is (typeof subscribers)[number] & {
      due: Extract<CycleDue, { state: "due" }>;
    } => isDue(s.due) && studentAccess(state, s.student).plans,
  );
  const assignVersion = async () => {
    if (!version) return;
    setBusy(true);
    setError("");
    try {
      await updateCrm((s) => {
        const from = s.plans?.find((p) => p.id === version.id);
        if (!from || from.status !== "published")
          throw new Error("La versione corrente è cambiata. Riprova.");
        const items: PlanAssignment[] = due.map(({ student, due }) => ({
          id: crypto.randomUUID(),
          studentId: student.id,
          planId: from.id,
          month: due.dueOn.slice(0, 7),
          startsOn: due.dueOn,
          endsOn: cycleEnd(due.dueOn),
          guidedCategory: category,
          createdAt: new Date().toISOString(),
          snapshot: structuredClone({
            title: from.title,
            description: from.description,
            sessions: from.sessions,
            ...(from.program ? { program: from.program } : {}),
          }),
        }));
        return { ...s, assignments: [...(s.assignments ?? []), ...items] };
      });
      setAssigning(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        title={label}
        description={
          <Link
            href="/admin/programmi-guidati"
            className="underline-offset-4 hover:underline"
          >
            Programmi guidati
          </Link>
        }
        action={
          canPlans && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden />
              Nuova versione
            </Button>
          )
        }
      />
      <LocalNotice />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Versione corrente</h2>
            {version ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/admin/piani/${encodeURIComponent(version.id)}`}
                    className="text-base font-medium underline-offset-4 hover:underline"
                  >
                    {version.title}
                  </Link>
                  <StatusChip status={version.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {version.sessions.length}{" "}
                  {version.sessions.length === 1 ? "sessione" : "sessioni"}
                  {version.publishedAt
                    ? ` · pubblicata il ${formatDay(version.publishedAt.slice(0, 10))}`
                    : ""}
                </p>
                {canPlans && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(version)}
                    >
                      Modifica
                    </Button>
                    <Button
                      size="sm"
                      disabled={!due.length}
                      onClick={() => setAssigning(true)}
                    >
                      Assegna a {due.length}{" "}
                      {due.length === 1 ? "abbonato" : "abbonati"} da rinnovare
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Nessuna versione pubblicata. Crea una nuova versione, oppure
                chiedi a Claude di caricarla nel CRM come {label}, poi
                pubblicala.
              </p>
            )}
          </section>
          <section className="rounded-2xl border bg-card">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">
              Bozze e versioni precedenti
            </h2>
            {others.length ? (
              <ul className="divide-y">
                {others.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <Link
                      href={`/admin/piani/${encodeURIComponent(p.id)}`}
                      className="min-w-0 text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {p.title || "Senza titolo"}
                    </Link>
                    <span className="flex items-center gap-2">
                      <StatusChip status={p.status} />
                      {canPlans && p.status !== "archived" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(p)}
                        >
                          Modifica
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nessuna bozza o versione precedente.
              </p>
            )}
          </section>
        </div>
        <section className="min-w-0 rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">
              Abbonati{" "}
              <span className="font-normal text-muted-foreground">
                ({subscribers.length})
              </span>
            </h2>
            {canPlans && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEnrolling(true)}
              >
                Iscrivi studente
              </Button>
            )}
          </div>
          {subscribers.length ? (
            <ul className="divide-y">
              {subscribers.map(({ student, enrollment, due }) => (
                <li
                  key={student.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <Link
                      href={`/admin/studenti/${encodeURIComponent(student.id)}?tab=plans`}
                      className="block font-medium underline-offset-4 hover:underline"
                    >
                      {student.firstName} {student.lastName}
                    </Link>
                    <span
                      className={`block text-xs ${due.state === "due" ? "font-medium text-[var(--workspace-accent)]" : "text-muted-foreground"}`}
                    >
                      {dueText(due, today)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Iscritto dal {formatDay(enrollment.startsOn)}
                    </span>
                  </span>
                  {canPlans && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLeaving(student)}
                    >
                      Togli
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nessuno studente segue {label}.
            </p>
          )}
        </section>
      </div>
      {editing && (
        <PlanEditor
          plan={editing === "new" ? undefined : editing}
          owner={{ guidedCategory: category }}
          close={() => setEditing(null)}
        />
      )}
      {enrolling && (
        <EnrollDialog category={category} close={() => setEnrolling(false)} />
      )}
      <ConfirmDialog
        open={assigning}
        busy={busy}
        error={error}
        title={`Assegnare «${version?.title ?? ""}»?`}
        description={`Ogni abbonato riceve un ciclo di quattro settimane dal giorno indicato: ${due
          .map(
            ({ student, due }) =>
              `${student.firstName} ${student.lastName} dal ${formatDay(due.dueOn)}`,
          )
          .join(", ")}.`}
        confirmLabel="Assegna"
        onCancel={() => {
          setAssigning(false);
          setError("");
        }}
        onConfirm={assignVersion}
      />
      <ConfirmDialog
        open={Boolean(leaving)}
        error={error}
        title={`Togliere ${leaving?.firstName ?? ""} da ${label}?`}
        description="Non riceverà più le nuove versioni. I cicli già assegnati restano visibili nella sua area."
        confirmLabel="Togli"
        onCancel={() => {
          setLeaving(null);
          setError("");
        }}
        onConfirm={async () => {
          if (!leaving) return;
          try {
            await updateCrm((s) => ({
              ...s,
              students: s.students.map((x) =>
                x.id === leaving.id
                  ? {
                      ...x,
                      guidedPrograms: (x.guidedPrograms ?? []).filter(
                        (g) => g.category !== category,
                      ),
                    }
                  : x,
              ),
            }));
            setLeaving(null);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
    </>
  );
}

function EnrollDialog({
  category,
  close,
}: {
  category: GuidedCategory;
  close: () => void;
}) {
  const state = useCrm();
  const [student, setStudent] = useState(""),
    [startsOn, setStartsOn] = useState(todayRome()),
    [error, setError] = useState("");
  const options = state.students
    .filter(
      (s) =>
        !s.archived &&
        studentAccess(state, s).plans &&
        !s.guidedPrograms?.some((g) => g.category === category),
    )
    .toSorted((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        "it",
      ),
    );
  return (
    <Editor
      title={`Iscrivi a ${guidedLabel(category)}`}
      description="Lo studente riceve la versione corrente a cicli di quattro settimane da questa data. Serve un tier con i piani attivi."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            if (!student) throw new Error("Seleziona uno studente.");
            await updateCrm((s) => ({
              ...s,
              students: s.students.map((x) =>
                x.id === student
                  ? {
                      ...x,
                      guidedPrograms: [
                        ...(x.guidedPrograms ?? []).filter(
                          (g) => g.category !== category,
                        ),
                        { category, startsOn },
                      ],
                    }
                  : x,
              ),
            }));
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Studente *">
          <SelectControl
            className={control}
            required
            value={student}
            onChange={(e) => setStudent(e.target.value)}
          >
            <option value="">Seleziona studente…</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </SelectControl>
        </Field>
        <Field label="Iscritto dal *">
          <DatePicker required value={startsOn} onChange={setStartsOn} />
        </Field>
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Iscrivi</Button>
        </div>
      </form>
    </Editor>
  );
}
