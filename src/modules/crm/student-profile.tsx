"use client";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import { StatusBadge } from "@/modules/students/components/status-badge";
import { formatDate } from "@/lib/format";
import {
  formatPropertyValue,
  emptyValue,
  validPropertyValue,
  type CrmProperty,
  type PropertyValue,
} from "./model";
import { useCrm, updateCrm, useHydrated } from "./store";
import { LocalNotice, FormError, Field, control } from "./ui";
import { StudentEditor } from "./student-editor";
import { ConfirmDialog } from "./confirm-dialog";
import { AssignmentEditor } from "./plan-editor";
import { AssignedPlan } from "./plans-workspace";
import { lessonDate } from "./lessons-workspace";
import { InviteButton } from "./invite-button";
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
function PropertyDisplay({
  property: p,
  value,
}: {
  property: CrmProperty;
  value: PropertyValue | undefined;
}) {
  if (emptyValue(value))
    return <span className="text-muted-foreground">Non compilato</span>;
  if (p.type === "date" && typeof value === "string") return formatDate(value);
  if (
    p.type === "url" &&
    typeof value === "string" &&
    validPropertyValue(p, value)
  )
    return (
      <a
        className="text-primary underline underline-offset-4"
        href={value}
        target="_blank"
        rel="noopener noreferrer"
      >
        {value}
      </a>
    );
  if (p.type === "email" && typeof value === "string")
    return (
      <a className="underline underline-offset-4" href={`mailto:${value}`}>
        {value}
      </a>
    );
  return formatPropertyValue(p, value);
}
export function StudentProfile({ id }: { id: string }) {
  const state = useCrm(),
    hydrated = useHydrated();
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false),
    [tab, setTab] = useState("properties"),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [restoreTier, setRestoreTier] = useState("");
  const student = state.students.find((s) => s.id === id);
  if (!hydrated)
    return (
      <p role="status" className="py-12 text-sm text-muted-foreground">
        Caricamento scheda…
      </p>
    );
  if (!student)
    return (
      <>
        <h1 className="text-xl font-semibold">Studente non trovato.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          La scheda potrebbe essere stata archiviata o non essere disponibile.
        </p>
        <Button asChild className="mt-6">
          <Link href="/admin/studenti">Tutti gli studenti</Link>
        </Button>
      </>
    );
  const properties = state.properties.filter((p) => !p.archived),
    tier = state.tiers.find((t) => t.id === student.tierId),
    missing = properties.filter(
      (p) => p.required && !validPropertyValue(p, student.properties[p.id]),
    );
  const run = async (action: () => void | Promise<void>) => {
    try {
      await action();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <Link
        className="mb-6 inline-block text-xs text-muted-foreground"
        href="/admin/studenti"
      >
        ← Tutti gli studenti
      </Link>
      <LocalNotice />
      <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <StudentIdentity student={student} large />
        <div className="flex flex-wrap items-center gap-3">
          {student.archived ? (
            <span className="rounded-md border bg-muted px-3 py-2 text-xs">
              Studente archiviato
            </span>
          ) : (
            <StatusBadge status={student.status} />
          )}
          <InviteButton
            id={student.id}
            kind="student"
            disabled={student.archived}
          />
          <Button disabled={student.archived} onClick={() => setEditing(true)}>
            Modifica studente
          </Button>
        </div>
      </div>
      <FormError message={error} />
      {missing.length > 0 && (
        <p className="my-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {missing.length} proprietà obbligatorie da compilare:{" "}
          {missing.map((p) => p.name).join(", ")}.
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card className="gap-4 p-6 shadow-none">
            <h1 className="text-lg font-semibold">Scheda studente</h1>
            <dl className="divide-y">
              {[
                ["Email", student.email],
                ["Telefono", student.phone || "Non compilato"],
                [
                  "Accesso",
                  student.access?.status === "active"
                    ? "Account attivo"
                    : student.access
                      ? "Invito preparato"
                      : "Non creato",
                ],
                ["Coach", student.coach || "Non assegnato"],
                ["Aggiunto il", formatDate(student.joinedAt)],
                ["Tag", student.tags.join(", ") || "Nessun tag"],
              ].map(([label, value]) => (
                <div
                  className="flex flex-wrap justify-between gap-3 py-4 text-xs"
                  key={label}
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="max-w-full break-words">
                    {label === "Email" ? (
                      <a
                        className="hover:underline"
                        href={`mailto:${student.email}`}
                      >
                        {value}
                      </a>
                    ) : label === "Telefono" && student.phone ? (
                      <a
                        className="hover:underline"
                        href={`tel:${student.phone.replace(/[^+\d]/g, "")}`}
                      >
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <div
            role="tablist"
            aria-label="Dettagli studente"
            onKeyDown={(e) => {
              const ids = ["properties", "plans", "notes", "history"];
              const index = ids.indexOf(tab);
              const next =
                e.key === "ArrowRight"
                  ? (index + 1) % 4
                  : e.key === "ArrowLeft"
                    ? (index + 3) % 4
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? 3
                        : -1;
              if (next >= 0) {
                e.preventDefault();
                setTab(ids[next]!);
                e.currentTarget
                  .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next]?.focus();
              }
            }}
            className="flex gap-1 overflow-x-auto rounded-lg border bg-white p-1"
          >
            {[
              { id: "properties", label: "Proprietà" },
              { id: "plans", label: "Piani e lezioni" },
              { id: "notes", label: `Note (${student.notes?.length ?? 0})` },
              { id: "history", label: "Cronologia" },
            ].map((t) => (
              <Button
                key={t.id}
                role="tab"
                tabIndex={tab === t.id ? 0 : -1}
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                variant={tab === t.id ? "secondary" : "ghost"}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <section
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className="space-y-5"
          >
            {tab === "properties" && (
              <>
                {!properties.length && (
                  <Card className="p-6 shadow-none">
                    <h2 className="text-sm font-semibold">
                      Nessuna proprietà personalizzata
                    </h2>
                    <p className="text-xs leading-6 text-muted-foreground">
                      Configura i campi nelle impostazioni per completare le
                      schede del team.
                    </p>
                    <Link
                      href="/admin/impostazioni/proprieta"
                      className="text-xs underline"
                    >
                      Gestisci proprietà
                    </Link>
                  </Card>
                )}
                {Array.from(new Set(properties.map((p) => p.group))).map(
                  (group) => (
                    <Card key={group} className="gap-3 p-6 shadow-none">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold">{group}</h2>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={student.archived}
                          onClick={() => setEditing(true)}
                        >
                          Modifica
                        </Button>
                      </div>
                      <dl className="divide-y">
                        {properties
                          .filter((p) => p.group === group)
                          .map((p) => (
                            <div key={p.id} className="py-4 text-sm">
                              <dt className="text-xs text-muted-foreground">
                                {p.name}
                                {p.required ? " *" : ""}
                              </dt>
                              <dd className="mt-2 whitespace-pre-wrap break-words leading-6">
                                <PropertyDisplay
                                  property={p}
                                  value={student.properties[p.id]}
                                />
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </Card>
                  ),
                )}
              </>
            )}
            {tab === "plans" && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-medium">Piani mensili</h2>
                  <Button
                    variant="outline"
                    disabled={student.archived}
                    onClick={() => setAssigning(true)}
                  >
                    Assegna piano
                  </Button>
                </div>
                {(state.assignments ?? [])
                  .filter((a) => a.studentId === id)
                  .sort((a, b) => b.month.localeCompare(a.month))
                  .map((a) => (
                    <AssignedPlan key={a.id} assignment={a} />
                  ))}
                {!state.assignments?.some((a) => a.studentId === id) && (
                  <p className="rounded-xl border p-5 text-sm text-muted-foreground">
                    Nessun piano assegnato.
                  </p>
                )}
                <section className="rounded-xl border p-5">
                  <h2 className="text-sm font-medium">Lezioni prenotate</h2>
                  <div className="mt-3 divide-y">
                    {(state.bookings ?? [])
                      .filter((b) => b.studentId === id && !b.cancelled)
                      .map((b) => {
                        const l = state.lessons?.find(
                          (l) => l.id === b.lessonId,
                        );
                        return l ? (
                          <Link
                            className="block py-3 text-sm"
                            key={b.id}
                            href={`/admin/lezioni/${encodeURIComponent(l.id)}`}
                          >
                            {l.title}
                            {l.cancelled ? " · Annullata" : ""}
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {lessonDate(l.startsAt)}
                            </span>
                          </Link>
                        ) : null;
                      })}
                  </div>
                  {!state.bookings?.some(
                    (b) => b.studentId === id && !b.cancelled,
                  ) && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nessuna prenotazione.
                    </p>
                  )}
                </section>
              </>
            )}
            {tab === "notes" && (
              <>
                <Card className="p-6 shadow-none">
                  <h2 className="text-sm font-semibold">Aggiungi nota</h2>
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      run(async () => {
                        const text = note.trim();
                        if (!text || text.length > 5000)
                          throw new Error(
                            "Inserisci una nota tra 1 e 5000 caratteri.",
                          );
                        await updateCrm((s) => ({
                          ...s,
                          students: s.students.map((x) =>
                            x.id === id
                              ? {
                                  ...x,
                                  notes: [
                                    ...(x.notes ?? []),
                                    {
                                      id: crypto.randomUUID(),
                                      text,
                                      createdAt: new Date().toISOString(),
                                    },
                                  ],
                                }
                              : x,
                          ),
                        }));
                        setNote("");
                      });
                    }}
                  >
                    <Field label="Nota interna">
                      <textarea
                        className={control}
                        rows={4}
                        required
                        maxLength={5000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </Field>
                    <Button type="submit">Aggiungi nota</Button>
                  </form>
                </Card>
                {(student.notes ?? [])
                  .slice()
                  .reverse()
                  .map((n) => (
                    <Card className="gap-3 p-6 shadow-none" key={n.id}>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={n.createdAt}
                      >
                        {timestamp(n.createdAt)}
                        {n.actorName ? ` · ${n.actorName}` : ""}
                      </time>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7">
                        {n.text}
                      </p>
                    </Card>
                  ))}
                {!student.notes?.length && (
                  <p className="p-4 text-xs text-muted-foreground">
                    Nessuna nota ancora presente.
                  </p>
                )}
              </>
            )}
            {tab === "history" && (
              <Card className="gap-3 p-6 shadow-none">
                <h2 className="text-sm font-semibold">
                  Cronologia della scheda
                </h2>
                <p className="text-xs leading-6 text-muted-foreground">
                  Modifiche e attività della scheda, in ordine cronologico.
                </p>
                <ol className="divide-y">
                  {(student.history ?? [])
                    .slice()
                    .reverse()
                    .map((h) => (
                      <li className="space-y-1 py-4" key={h.id}>
                        <p className="text-sm">{h.text}</p>
                        <time
                          className="text-xs text-muted-foreground"
                          dateTime={h.createdAt}
                        >
                          {timestamp(h.createdAt)}
                          {h.actorName ? ` · ${h.actorName}` : ""}
                        </time>
                      </li>
                    ))}
                </ol>
                {!student.history?.length && (
                  <p className="text-xs text-muted-foreground">
                    Nessuna modifica registrata.
                  </p>
                )}
              </Card>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <Card className="gap-4 p-6 shadow-none">
            <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
              Tier assegnato
            </p>
            <h2 className="text-xl font-semibold">
              {tier?.name || "Nessun tier"}
            </h2>
            {tier?.archived && (
              <span className="text-xs text-amber-800">Tier archiviato</span>
            )}
            <p className="text-xs leading-6 text-muted-foreground">
              {tier?.description}
            </p>
            <Button
              variant="outline"
              disabled={student.archived}
              onClick={() => setEditing(true)}
            >
              Cambia tier
            </Button>
          </Card>
          <Card className="gap-4 p-6 shadow-none">
            <h2 className="text-sm font-semibold">Gestione scheda</h2>
            <p className="text-xs leading-6 text-muted-foreground">
              {student.archived
                ? "Il ripristino riporta lo studente nelle viste normali."
                : "Archivia uno studente per rimuoverlo dalle viste operative mantenendo scheda, proprietà e note."}
            </p>
            {student.archived && tier?.archived && (
              <Field label="Tier per il ripristino">
                <SelectControl
                  className={control}
                  value={restoreTier}
                  onChange={(e) => setRestoreTier(e.target.value)}
                >
                  <option value="">Seleziona un tier…</option>
                  {state.tiers
                    .filter((t) => !t.archived)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </SelectControl>
              </Field>
            )}
            <Button variant="outline" onClick={() => setConfirm(true)}>
              {student.archived ? "Ripristina studente" : "Archivia studente"}
            </Button>
            <Link
              href="/admin/impostazioni/proprieta"
              className="text-xs underline"
            >
              Gestisci proprietà CRM
            </Link>
          </Card>
        </aside>
      </div>
      {assigning && (
        <AssignmentEditor studentId={id} close={() => setAssigning(false)} />
      )}
      {editing && (
        <StudentEditor student={student} close={() => setEditing(false)} />
      )}
      <ConfirmDialog
        open={confirm}
        title={
          student.archived
            ? "Ripristinare lo studente?"
            : "Archiviare lo studente?"
        }
        description={
          student.archived
            ? "La scheda tornerà disponibile nelle viste operative."
            : "La scheda viene conservata. Le iscrizioni alle lezioni saranno annullate e potranno essere ricreate dopo il ripristino."
        }
        confirmLabel={student.archived ? "Ripristina" : "Archivia"}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          run(async () => {
            await updateCrm((s) => ({
              ...s,
              students: s.students.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      archived: !x.archived,
                      tierId:
                        x.archived && tier?.archived ? restoreTier : x.tierId,
                    }
                  : x,
              ),
            }));
            setConfirm(false);
          })
        }
      />
    </>
  );
}
