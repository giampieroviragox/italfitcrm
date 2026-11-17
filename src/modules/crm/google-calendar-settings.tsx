"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectControl } from "@/components/ui/select-control";
import { requestJson } from "@/lib/request-json";
import { ConfirmDialog } from "./confirm-dialog";
import { useCrm, useIsOwner, useRemoteMode } from "./store";
import { Field, FormError, control } from "./ui";
import { SettingsRow, SettingsSection } from "./users-manager";

interface Status {
  configured: boolean;
  redirectUri: string;
  connection?: {
    googleEmail: string;
    calendarId: string;
    calendarName: string | null;
    connectedAt: string;
    lastSyncAt: string | null;
    lastError: string | null;
  } | null;
  calendars?: { id: string; summary: string; primary?: boolean }[];
  team?: { adminId: string; googleEmail: string }[];
}
const outcomes: Record<string, string> = {
  collegato: "Google Calendar collegato. La prima sincronizzazione è partita.",
  annullato: "Collegamento annullato.",
  "non-valido": "Il collegamento non è valido o è scaduto. Riprova.",
  errore: "Google non ha completato il collegamento. Riprova tra poco.",
};
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));

/** Each team member connects their own Google Calendar. */
export function GoogleCalendarSettings() {
  const remote = useRemoteMode();
  const owner = useIsOwner();
  const state = useCrm();
  const outcome = useSearchParams().get("esito");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    outcome ? (outcomes[outcome] ?? "") : "",
  );
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(async () => {
    try {
      setStatus((await requestJson("/api/google")) as Status);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (!remote) return;
    let live = true;
    requestJson("/api/google")
      .then((data) => live && setStatus(data as Status))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [remote]);
  const act = async (body: Record<string, string>, done: string) => {
    setPending(true);
    setError("");
    try {
      const result = (await requestJson("/api/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })) as { written?: number; removed?: number };
      setMessage(
        typeof result.written === "number"
          ? `${done} ${result.written} eventi scritti, ${result.removed ?? 0} rimossi.`
          : done,
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
      setConfirming(false);
    }
  };
  if (!remote)
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Google Calendar si collega dal CRM online, con il tuo account.
      </p>
    );
  const connection = status?.connection;
  return (
    <div className="space-y-8">
      {message && (
        <p
          role="status"
          className="rounded-[10px] bg-emerald-500/10 px-3 py-2.5 text-[13px] text-emerald-800 dark:text-emerald-300"
        >
          {message}
        </p>
      )}
      <FormError message={error} />
      <SettingsSection
        title="Il tuo Google Calendar"
        description="Il CRM scrive nel calendario che scegli le lezioni di cui sei coach, le call dell’agenda a cui partecipi e le gare dei tuoi studenti. Modifiche e annullamenti si aggiornano da soli."
      >
        {!status ? (
          <SettingsRow title="Caricamento…" />
        ) : !status.configured ? (
          <SettingsRow
            title="Google Calendar non è ancora configurato"
            description={
              owner
                ? `Servono le credenziali OAuth di Google (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET) con questo URI di reindirizzamento: ${status.redirectUri}`
                : "Chiedi al super admin di completare la configurazione."
            }
          />
        ) : !connection ? (
          <SettingsRow
            title="Non collegato"
            description="Accedi con il tuo account Google e autorizza il CRM a gestire gli eventi del calendario."
          >
            <Button asChild size="sm">
              <a href="/api/google/connect">
                <CalendarCheck className="size-4" /> Collega Google Calendar
              </a>
            </Button>
          </SettingsRow>
        ) : (
          <>
            <SettingsRow
              title={`Collegato come ${connection.googleEmail}`}
              description={
                connection.lastSyncAt
                  ? `Ultima sincronizzazione: ${dateTime(connection.lastSyncAt)}`
                  : "Sincronizzazione in corso…"
              }
            >
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void act({ action: "sync" }, "Sincronizzato:")}
              >
                <RefreshCw className="size-4" /> Sincronizza ora
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setConfirming(true)}
              >
                <Unplug className="size-4" /> Scollega
              </Button>
            </SettingsRow>
            {connection.lastError && (
              <p className="rounded-[10px] border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-900 dark:text-amber-200">
                {connection.lastError}
              </p>
            )}
            <div className="max-w-md py-4">
              <Field
                label="Calendario di destinazione"
                hint="Cambiando calendario, gli eventi del CRM vengono spostati nel nuovo."
              >
                <SelectControl
                  className={control}
                  value={connection.calendarId}
                  disabled={pending || !status.calendars?.length}
                  onChange={(e) =>
                    void act(
                      { action: "calendar", calendarId: e.target.value },
                      "Calendario aggiornato:",
                    )
                  }
                >
                  {!status.calendars?.some(
                    (c) => c.id === connection.calendarId,
                  ) && (
                    <option value={connection.calendarId}>
                      {connection.calendarName ?? "Calendario principale"}
                    </option>
                  )}
                  {(status.calendars ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                      {c.primary ? " (principale)" : ""}
                    </option>
                  ))}
                </SelectControl>
              </Field>
            </div>
          </>
        )}
      </SettingsSection>
      {status?.configured && (
        <SettingsSection
          title="Team"
          description="Chi ha collegato il proprio calendario. L’agenda usa questi calendari per mostrare gli orari occupati."
        >
          {state.admins.map((a) => {
            const linked = status.team?.find((t) => t.adminId === a.id);
            return (
              <SettingsRow
                key={a.id}
                title={a.name}
                description={
                  linked ? `Collegato · ${linked.googleEmail}` : "Non collegato"
                }
              />
            );
          })}
        </SettingsSection>
      )}
      <ConfirmDialog
        open={confirming}
        title="Scollegare Google Calendar?"
        description="Gli eventi scritti dal CRM vengono rimossi dal tuo calendario e il CRM perde l’accesso. Puoi ricollegarlo quando vuoi."
        confirmLabel="Scollega"
        busy={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          void act({ action: "disconnect" }, "Google Calendar scollegato.")
        }
      />
    </div>
  );
}
