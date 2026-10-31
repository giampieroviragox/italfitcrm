import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CrmState } from "../model";
import { isCrmEnvelope, type CrmEnvelope } from "../envelope";
import type { Json } from "@/lib/supabase/database.types";
export type { CrmEnvelope } from "../envelope";
import { HttpError } from "./auth";
export async function readCrm(actor: string): Promise<CrmEnvelope> {
  const { data, error } = await createAdminClient()
    .rpc("crm_read", {
      p_actor: actor,
    })
    .retry(false);
  if (error || !isCrmEnvelope(data))
    throw new HttpError(503, "Impossibile caricare il CRM. Riprova.");
  return data;
}
export async function writeCrm(
  actor: string,
  revision: number,
  state: CrmState,
): Promise<CrmEnvelope> {
  const { data, error } = await createAdminClient()
    .rpc("crm_write", {
      p_actor: actor,
      p_expected: revision,
      p_state: state as unknown as Json,
    })
    .retry(false);
  if (error) {
    if (["40001", "PT409"].includes(error.code))
      throw new HttpError(
        409,
        "Il CRM è stato aggiornato da un altro utente. Ricarica e riprova.",
      );
    if (error.code === "23505")
      throw new HttpError(
        409,
        "Esiste già un record con questi dati. Ricarica e riprova.",
      );
    console.error("CRM transaction failed", {
      code: error.code,
      message: error.message,
    });
    throw new HttpError(
      503,
      "Il database non ha salvato le modifiche. Riprova.",
    );
  }
  if (!isCrmEnvelope(data))
    throw new HttpError(
      503,
      "Risposta database non valida. Ricarica prima di riprovare.",
    );
  return data;
}
