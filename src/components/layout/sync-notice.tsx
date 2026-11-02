"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaving, useSyncStatus } from "@/modules/crm/store";
import { activeRemoteStore } from "@/modules/crm/remote-store";

export function SyncNotice() {
  const status = useSyncStatus();
  const saving = useSaving();
  const [pending, setPending] = useState(false);
  if (!status || (status.online && !status.error && !status.requiresRefresh))
    return null;
  const Icon = status.online ? AlertCircle : WifiOff;
  return (
    <section
      role="status"
      aria-label="Stato del workspace"
      className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-200"
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-sm leading-6">
        <p className="font-medium">
          {!status.online
            ? "Connessione assente"
            : status.authRequired
              ? "Accesso da rinnovare"
              : "Operazione da verificare"}
        </p>
        <p className="mt-1 break-words">
          {!status.online
            ? "Stai visualizzando gli ultimi dati caricati. Le modifiche nel form restano disponibili: riconnettiti prima di salvarle."
            : status.error ||
              "Aggiorna i dati per verificare l’esito dell’ultima operazione."}
        </p>
      </div>
      {status.authRequired ? (
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Accedi di nuovo</Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={!status.online || saving || pending || status.refreshing}
          onClick={async () => {
            setPending(true);
            try {
              await activeRemoteStore?.refresh();
            } catch {
              /* The store displays the failure. */
            } finally {
              setPending(false);
            }
          }}
        >
          <RefreshCw
            className={status.refreshing ? "size-3.5 animate-spin" : "size-3.5"}
          />
          {status.refreshing ? "Aggiornamento…" : "Aggiorna dati"}
        </Button>
      )}
    </section>
  );
}
