"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, MapPin, Pencil, Plus, X } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { SelectControl } from "@/components/ui/select-control";
import { requestJson } from "@/lib/request-json";
import { eventEnd, type AgendaCommand, type TeamEvent } from "./agenda";
import type { BusySlot } from "./agenda-busy";
import { ConfirmDialog } from "./confirm-dialog";
import { romeLocal, romeToIso, todayRome } from "./fitness-logic";
import {
  useCrm,
  useHydrated,
  useIsOwner,
  useRemoteMode,
  useViewer,
} from "./store";
import { useClock } from "./use-clock";
import {
  Editor,
  EditorCancel,
  Field,
  FormError,
  LocalNotice,
  control,
} from "./ui";

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
const time = (iso: string) => romeLocal(iso).slice(11, 16);
const isUrl = (v: string) => /^https?:\/\//i.test(v);

interface Entry {
  key: string;
  kind: "event" | "lesson";
  title: string;
  start: string;
  end: string;
  people: string;
  location?: string;
  notes?: string;
  href?: string;
  event?: TeamEvent;
}

/** Shared team agenda: calls and appointments, plus the member's lessons. */
export function AgendaWorkspace() {
  const state = useCrm();
  const hydrated = useHydrated();
  const remote = useRemoteMode();
  const viewer = useViewer();
  const owner = useIsOwner();
  const now = useClock();
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<TeamEvent | "new" | null>(null);
  const [cancelling, setCancelling] = useState<TeamEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = (await requestJson("/api/agenda")) as {
        events: TeamEvent[];
      };
      setEvents(data.events);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!remote) return;
    let live = true;
    requestJson("/api/agenda")
      .then((data) => {
        if (!live) return;
        setEvents((data as { events: TeamEvent[] }).events);
        setLoaded(true);
      })
      .catch((e: Error) => {
        if (!live) return;
        setError(e.message);
        setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [remote]);
  const send = async (command: AgendaCommand) => {
    await requestJson("/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    await load();
  };
  if (!hydrated) return null;
  const me = viewer?.recordId ?? "owner-demo";
  const name = (id: string) =>
    state.admins.find((a) => a.id === id)?.name ?? "Membro del team";
  const student = (id?: string) => {
    const s = state.students.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : undefined;
  };
  const entries: Entry[] = [
    ...events
      .filter((e) => !e.cancelled)
      .map((e) => ({
        key: `event:${e.id}`,
        kind: "event" as const,
        title: e.title,
        start: e.startsAt,
        end: eventEnd(e),
        people: [
          e.participants.map(name).join(", "),
          ...(e.studentId ? [`studente ${student(e.studentId) ?? ""}`] : []),
        ].join(" · "),
        ...(e.location ? { location: e.location } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
        event: e,
      })),
    ...(state.lessons ?? [])
      .filter((l) => !l.cancelled)
      .map((l) => ({
        key: `lesson:${l.id}`,
        kind: "lesson" as const,
        title: `Lezione · ${l.title}`,
        start: l.startsAt,
        end: new Date(
          Date.parse(l.startsAt) + l.durationMinutes * 60_000,
        ).toISOString(),
        people: l.coach,
        ...(l.location ? { location: l.location } : {}),
        href: `/admin/lezioni/${encodeURIComponent(l.id)}`,
      })),
  ]
    .filter((e) => (showPast ? true : Date.parse(e.end) >= now - 3_600_000))
    .toSorted((a, b) => a.start.localeCompare(b.start));
  const days = [
    ...new Set(entries.map((e) => romeLocal(e.start).slice(0, 10))),
  ];
  return (
    <>
      <PageHeading
        title="Agenda"
        description="Call e appuntamenti del team, con le lezioni in calendario. Gli eventi arrivano anche nei Google Calendar collegati."
        action={
          remote ? (
            <Button
              size="lg"
              className="rounded-full"
              onClick={() => setEditing("new")}
            >
              <Plus className="size-4" /> Nuovo appuntamento
            </Button>
          ) : undefined
        }
      />
      <LocalNotice />
      {!remote && (
        <p className="mb-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          L’agenda del team è disponibile nel CRM online.
        </p>
      )}
      <FormError message={error} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {remote && !loaded ? "Caricamento…" : `${entries.length} impegni`}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <CheckboxControl
            checked={showPast}
            onChange={(e) => setShowPast(e.target.checked)}
          />
          Mostra anche i passati
        </label>
      </div>
      {days.length ? (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day} aria-label={dayLabel(day)}>
              <h2 className="mb-2 text-sm font-semibold first-letter:uppercase">
                {dayLabel(day)}
                {day === todayRome() ? " · oggi" : ""}
              </h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {entries
                  .filter((e) => romeLocal(e.start).startsWith(day))
                  .map((e) => (
                    <li
                      key={e.key}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="flex min-w-0 gap-3">
                        <span className="w-24 shrink-0 font-semibold tabular-nums">
                          {time(e.start)}–{time(e.end)}
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium break-words">
                            {e.href ? (
                              <Link href={e.href} className="hover:underline">
                                {e.title}
                              </Link>
                            ) : (
                              e.title
                            )}
                          </p>
                          <p className="text-muted-foreground">{e.people}</p>
                          {e.location && (
                            <p className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="size-3.5" aria-hidden />
                              {isUrl(e.location) ? (
                                <a
                                  href={e.location}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline underline-offset-4"
                                >
                                  Link della call
                                </a>
                              ) : (
                                e.location
                              )}
                            </p>
                          )}
                          {e.notes && (
                            <p className="whitespace-pre-line text-muted-foreground">
                              {e.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      {e.event && (e.event.createdBy === me || owner) && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Modifica ${e.title}`}
                            onClick={() => setEditing(e.event!)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Annulla ${e.title}`}
                            onClick={() => setCancelling(e.event!)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border bg-card px-6 py-10 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-[var(--workspace-accent)]">
            <CalendarClock className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-muted-foreground">
            Nessun impegno in programma.
          </p>
        </div>
      )}
      {editing && (
        <EventEditor
          event={editing === "new" ? undefined : editing}
          me={me}
          close={() => setEditing(null)}
          save={send}
        />
      )}
      <ConfirmDialog
        open={cancelling !== null}
        title="Annullare l’appuntamento?"
        description="Viene tolto dall’agenda e dai Google Calendar dei partecipanti."
        confirmLabel="Annulla appuntamento"
        busy={pending}
        onCancel={() => setCancelling(null)}
        onConfirm={async () => {
          if (!cancelling) return;
          setPending(true);
          try {
            await send({ action: "cancel", id: cancelling.id });
            setCancelling(null);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}

function EventEditor({
  event,
  me,
  close,
  save,
}: {
  event?: TeamEvent;
  me: string;
  close: () => void;
  save: (command: AgendaCommand) => Promise<void>;
}) {
  const state = useCrm();
  const local = event ? romeLocal(event.startsAt) : "";
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(local.slice(0, 10) || todayRome());
  const [start, setStart] = useState(local.slice(11, 16));
  const [duration, setDuration] = useState(event?.durationMinutes ?? 30);
  const [participants, setParticipants] = useState<string[]>(
    event?.participants ?? [me],
  );
  const [studentId, setStudentId] = useState(event?.studentId ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [busy, setBusy] = useState<
    { adminId: string; connected: boolean; busy: BusySlot[] }[] | null
  >(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!date || !participants.length) return;
    let live = true;
    requestJson(
      `/api/google/freebusy?date=${date}&members=${participants.join(",")}`,
    )
      .then((data) => {
        if (live)
          setBusy(
            (
              data as {
                members: {
                  adminId: string;
                  connected: boolean;
                  busy: BusySlot[];
                }[];
              }
            ).members,
          );
      })
      .catch(() => live && setBusy(null));
    return () => {
      live = false;
    };
  }, [date, participants]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!start) return setError("Indica l’orario.");
    let startsAt;
    try {
      startsAt = romeToIso(`${date}T${start}`);
    } catch (err) {
      return setError((err as Error).message);
    }
    const input = {
      title,
      startsAt,
      durationMinutes: duration,
      participants,
      ...(studentId ? { studentId } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    setPending(true);
    setError("");
    try {
      await save(
        event
          ? { action: "update", id: event.id, event: input }
          : { action: "create", event: input },
      );
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <Editor
      title={event ? "Modifica appuntamento" : "Nuovo appuntamento"}
      description="Una call o un appuntamento del team. Compare nell’agenda e nei Google Calendar collegati dei partecipanti."
      close={close}
    >
      <form className="crm-editor-form" onSubmit={submit}>
        <Field label="Titolo *">
          <input
            required
            maxLength={120}
            className={control}
            placeholder="Es. Call di allineamento con Marta"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Giorno *">
            <DatePicker required value={date} onChange={setDate} />
          </Field>
          <Field label="Ora *">
            <TimePicker required value={start} onChange={setStart} />
          </Field>
          <Field label="Durata">
            <SelectControl
              className={control}
              value={String(duration)}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? " 30" : ""}`}
                </option>
              ))}
            </SelectControl>
          </Field>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-medium">Partecipanti *</legend>
          {state.admins.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <CheckboxControl
                checked={participants.includes(a.id)}
                onChange={(e) =>
                  setParticipants((list) =>
                    e.target.checked
                      ? [...list, a.id]
                      : list.filter((id) => id !== a.id),
                  )
                }
              />
              {a.name}
            </label>
          ))}
        </fieldset>
        {busy && (
          <div className="space-y-2 rounded-xl bg-muted p-3 text-sm">
            <p className="font-medium">Già occupati in questo giorno</p>
            {busy.map((m) => (
              <div key={m.adminId}>
                <p className="text-xs font-semibold">
                  {state.admins.find((a) => a.id === m.adminId)?.name}
                  {!m.connected && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · Google Calendar non collegato
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {m.busy.length
                    ? m.busy
                        .map(
                          (b) =>
                            `${time(b.start)}–${time(b.end)}${b.label ? ` ${b.label}` : ""}`,
                        )
                        .join(" · ")
                    : "Libero tutto il giorno"}
                </p>
              </div>
            ))}
          </div>
        )}
        <Field label="Studente (facoltativo)">
          <SelectControl
            className={control}
            value={studentId || "none"}
            onChange={(e) =>
              setStudentId(e.target.value === "none" ? "" : e.target.value)
            }
          >
            <option value="none">Nessuno</option>
            {state.students
              .filter((s) => !s.archived)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
          </SelectControl>
        </Field>
        <Field label="Luogo o link della call">
          <input
            maxLength={300}
            className={control}
            placeholder="Es. https://meet.google.com/… oppure Sede Milano"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>
        <Field label="Note">
          <textarea
            rows={3}
            maxLength={3000}
            className={control}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit" disabled={pending || !participants.length}>
            {pending ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </form>
    </Editor>
  );
}
