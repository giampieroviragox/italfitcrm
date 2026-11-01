"use client";
import Link from "next/link";
import { useRef, useState } from "react";
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
import { useCrm, useHydrated, addStudentComment } from "./store";
import { LocalNotice, FormError, Field, control } from "./ui";
import { StudentEditor } from "./student-editor";
import { AssignmentEditor } from "./plan-editor";
import { AssignedPlan } from "./plans-workspace";
import { lessonDate } from "./lessons-workspace";
import { StudentAccessControl } from "./student-access-control";
import { studentAccessLabel } from "./student-access";
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
export function StudentProfile({
  id,
  embedded = false,
}: {
  id: string;
  embedded?: boolean;
}) {
  const state = useCrm(),
    hydrated = useHydrated();
  const commentLock = useRef(false);
  const commentList = useRef<HTMLOListElement>(null);
  const [commentPending, setCommentPending] = useState(false);
  const [commentResult, setCommentResult] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false),
    [tab, setTab] = useState("properties"),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
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
      {!embedded && (
        <Link
          className="mb-6 inline-block text-xs text-muted-foreground"
          href="/admin/studenti"
        >
          ← Tutti gli studenti
        </Link>
      )}
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
          <StudentAccessControl student={student} />
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
      <div
        className={`grid items-start gap-6 ${embedded ? "" : "xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]"}`}
      >
        <div className="min-w-0 space-y-5">
          <Card className="gap-4 p-6 shadow-none">
            <h1 className="text-lg font-semibold">Scheda studente</h1>
            <dl className="divide-y">
              {[
                ["Email", student.email],
                ["Telefono", student.phone || "Non compilato"],
                ["Accesso", studentAccessLabel(student)],
                ["Coach", student.coach || "Non assegnato"],
                ["Aggiunto il", formatDate(student.joinedAt)],
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
              {
                id: "notes",
                label: `Commenti (${student.notes?.length ?? 0})`,
              },
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
              <Card className="gap-5 p-5 shadow-none sm:p-6">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Commenti interni</h2>
                  <p className="text-xs leading-6 text-muted-foreground">
                    Ogni commento conserva autore, data e testo originale. I
                    commenti pubblicati non possono essere modificati o
                    eliminati.
                  </p>
                </div>
                <form
                  className="space-y-4"
                  aria-busy={commentPending}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (commentLock.current) return;
                    commentLock.current = true;
                    setCommentPending(true);
                    setCommentResult("");
                    try {
                      await run(async () => {
                        const text = note.trim();
                        if (!text || text.length > 5000)
                          throw new Error(
                            "Inserisci un commento tra 1 e 5000 caratteri.",
                          );
                        await addStudentComment(id, text);
                        commentList.current?.scrollTo({ top: 0 });
                        setNote("");
                        setCommentResult(
                          "Commento pubblicato e salvato nella cronologia.",
                        );
                      });
                    } finally {
                      commentLock.current = false;
                      setCommentPending(false);
                    }
                  }}
                >
                  <Field
                    label="Nuovo commento"
                    hint="Massimo 5000 caratteri. Visibile solo agli amministratori."
                  >
                    <textarea
                      className={control}
                      rows={3}
                      required
                      maxLength={5000}
                      value={note}
                      disabled={commentPending}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Field>
                  <Button
                    type="submit"
                    disabled={commentPending || !note.trim()}
                  >
                    {commentPending ? "Pubblicazione…" : "Pubblica commento"}
                  </Button>
                  <p role="status" className="text-xs text-muted-foreground">
                    {commentResult}
                  </p>
                </form>
                <div className="border-t pt-5">
                  <h3 className="mb-3 text-xs font-medium">
                    Commenti ({student.notes?.length ?? 0}) · Più recenti prima
                  </h3>
                  {student.notes?.length ? (
                    <ol
                      ref={commentList}
                      aria-label="Commenti salvati"
                      tabIndex={0}
                      className="max-h-[32rem] space-y-4 overflow-y-auto overscroll-contain rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-primary"
                      style={{ scrollbarGutter: "stable" }}
                    >
                      {student.notes
                        .toSorted(
                          (a, b) =>
                            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
                            b.id.localeCompare(a.id),
                        )
                        .map((n) => (
                          <li
                            className="space-y-3 rounded-lg border bg-muted/20 p-4"
                            key={n.id}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                              <p className="break-words text-sm font-medium">
                                {n.actorName || "Autore non disponibile"}
                              </p>
                              <time
                                className="text-xs text-muted-foreground"
                                dateTime={n.createdAt}
                              >
                                {timestamp(n.createdAt)}
                              </time>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm leading-7">
                              {n.text}
                            </p>
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p className="py-3 text-xs text-muted-foreground">
                      Nessun commento ancora presente.
                    </p>
                  )}
                </div>
              </Card>
            )}
            {tab === "history" && (
              <Card className="gap-3 p-6 shadow-none">
                <h2 className="text-sm font-semibold">
                  Cronologia della scheda
                </h2>
                <p className="text-xs leading-6 text-muted-foreground">
                  Modifiche e attività della scheda con autore e data. Le più
                  recenti sono in alto.
                </p>
                <ol
                  aria-label="Attività della scheda"
                  tabIndex={0}
                  className="max-h-[40rem] divide-y overflow-y-auto overscroll-contain rounded focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {(student.history ?? [])
                    .toSorted(
                      (a, b) =>
                        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
                        b.id.localeCompare(a.id),
                    )
                    .map((h) => (
                      <li className="space-y-1 py-4" key={h.id}>
                        <p className="text-sm font-medium">{h.text}</p>
                        {h.details && h.details.length > 0 && (
                          <ul className="space-y-1 text-xs leading-6 text-muted-foreground">
                            {h.details.map((detail, index) => (
                              <li
                                className="whitespace-pre-wrap break-words"
                                key={index}
                              >
                                {detail}
                              </li>
                            ))}
                          </ul>
                        )}
                        <time
                          className="text-xs text-muted-foreground"
                          dateTime={h.createdAt}
                        >
                          {timestamp(h.createdAt)}
                          {` · ${h.actorName || "Autore non disponibile"}`}
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
        </aside>
      </div>
      {assigning && (
        <AssignmentEditor studentId={id} close={() => setAssigning(false)} />
      )}
      {editing && (
        <StudentEditor student={student} close={() => setEditing(false)} />
      )}
    </>
  );
}
