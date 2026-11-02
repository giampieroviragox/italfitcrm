"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  pageTabActive,
  pageTabIdle,
  pageTabItem,
  pageTabList,
} from "@/components/ui/page-tabs";
import { cn } from "@/lib/utils";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import { validPropertyValue } from "./model";
import { useCrm, useHydrated, addStudentComment } from "./store";
import { LocalNotice, FormError, Field, control } from "./ui";
import { useNavigationRequest } from "./use-unsaved-changes";
import { StudentEditor } from "./student-editor";
import { AssignmentEditor } from "./plan-editor";
import { AssignedPlan } from "./plans-workspace";
import { lessonDate } from "./lessons-workspace";
import { StudentAccessControl } from "./student-access-control";
import { studentAccessEnabled, studentAccessLabel } from "./student-access";
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
export function StudentProfile({
  id,
  embedded = false,
}: {
  id: string;
  embedded?: boolean;
}) {
  const state = useCrm(),
    hydrated = useHydrated();
  const request = useNavigationRequest();
  const [editorVersion, setEditorVersion] = useState(0);
  const [savedMessage, setSavedMessage] = useState("");
  const commentLock = useRef(false);
  const commentList = useRef<HTMLOListElement>(null);
  const [commentPending, setCommentPending] = useState(false);
  const [commentResult, setCommentResult] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [tab, setTab] = useState("properties"),
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
      <LocalNotice />
      <div
        className={`mb-6 flex flex-wrap items-center justify-between gap-4 ${embedded ? "pr-10" : ""}`}
      >
        <StudentIdentity student={student} large />
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${studentAccessEnabled(student) ? "bg-emerald-500/100" : "bg-neutral-300"}`}
            />
            {studentAccessLabel(student)}
          </span>
          <StudentAccessControl student={student} />
        </div>
      </div>
      <FormError message={error} />
      {missing.length > 0 && (
        <p className="mb-5 rounded-[10px] border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-900 dark:text-amber-200">
          Da compilare: {missing.map((p) => p.name).join(", ")}.
        </p>
      )}
      <div className="grid items-start gap-6">
        <div className="min-w-0 space-y-6">
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
                const target =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  )[next];
                request(() => {
                  setTab(ids[next]!);
                  target?.focus();
                });
              }
            }}
            className={pageTabList}
          >
            {[
              { id: "properties", label: "Proprietà" },
              { id: "plans", label: "Piani e lezioni" },
              {
                id: "notes",
                label: (
                  <>
                    Commenti
                    {student.notes?.length ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {student.notes.length}
                      </span>
                    ) : null}
                  </>
                ),
              },
              { id: "history", label: "Cronologia" },
            ].map((t) => (
              <button
                type="button"
                key={t.id}
                role="tab"
                tabIndex={tab === t.id ? 0 : -1}
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                className={cn(
                  pageTabItem,
                  tab === t.id ? pageTabActive : pageTabIdle,
                )}
                onClick={() => request(() => setTab(t.id))}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "properties" ? (
            <>
              {savedMessage && (
                <p
                  role="status"
                  className="rounded-[10px] bg-emerald-500/10 px-3 py-2.5 text-[13px] text-emerald-800 dark:text-emerald-300"
                >
                  {savedMessage}
                </p>
              )}
              <StudentEditor
                key={`${id}:${editorVersion}`}
                student={student}
                close={() => {
                  setEditorVersion((v) => v + 1);
                  setSavedMessage("");
                }}
                saved={() => {
                  setEditorVersion((v) => v + 1);
                  setSavedMessage("Modifiche salvate.");
                }}
              />
            </>
          ) : null}
          <section
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className="space-y-5"
          >
            {tab === "properties" && (
              <>
                {!properties.length && (
                  <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    Nessuna proprietà personalizzata. Configura i campi in{" "}
                    <Link
                      href="/admin/impostazioni/proprieta"
                      className="text-foreground underline underline-offset-4"
                    >
                      Impostazioni
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
            {tab === "plans" && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Piani mensili
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
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
                  <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    Nessun piano assegnato.
                  </p>
                )}
                <section className="pt-4">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Lezioni prenotate
                  </h2>
                  <div className="mt-2 divide-y rounded-xl border px-4 empty:hidden">
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
                    <p className="mt-2 rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                      Nessuna prenotazione.
                    </p>
                  )}
                </section>
              </>
            )}
            {tab === "notes" && (
              <div className="space-y-6">
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
                    hint="Visibile solo agli amministratori. I commenti pubblicati non si possono modificare."
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
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Più recenti
                  </h3>
                  {student.notes?.length ? (
                    <ol
                      ref={commentList}
                      aria-label="Commenti salvati"
                      tabIndex={0}
                      className="max-h-[32rem] divide-y overflow-y-auto overscroll-contain rounded-xl border focus-visible:outline-2 focus-visible:outline-primary"
                      style={{ scrollbarGutter: "stable" }}
                    >
                      {student.notes
                        .toSorted(
                          (a, b) =>
                            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
                            b.id.localeCompare(a.id),
                        )
                        .map((n) => (
                          <li className="space-y-1.5 px-4 py-3.5" key={n.id}>
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
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {n.text}
                            </p>
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                      Nessun commento ancora presente.
                    </p>
                  )}
                </div>
              </div>
            )}
            {tab === "history" && (
              <div>
                <ol
                  aria-label="Attività della scheda"
                  tabIndex={0}
                  className="max-h-[40rem] divide-y overflow-y-auto empty:hidden overscroll-contain rounded-xl border px-4 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {(student.history ?? [])
                    .toSorted(
                      (a, b) =>
                        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
                        b.id.localeCompare(a.id),
                    )
                    .map((h) => (
                      <li className="space-y-1 py-3.5" key={h.id}>
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
                  <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    Nessuna modifica registrata.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      {assigning && (
        <AssignmentEditor studentId={id} close={() => setAssigning(false)} />
      )}
    </>
  );
}
