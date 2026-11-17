import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { teamEvent, type TeamEvent } from "../agenda";
import type { CalendarLink } from "../calendar-sync";
import { HttpError } from "./errors";

/** Storage for Google connections, synced event links and the team agenda. */
const db = () => createAdminClient();
const fail = (message: string) => {
  throw new HttpError(503, message);
};

export interface GoogleConnection {
  adminId: string;
  googleEmail: string;
  calendarId: string;
  calendarName: string | null;
  refreshToken: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
}
type Row = {
  admin_id: string;
  google_email: string;
  calendar_id: string;
  calendar_name: string | null;
  refresh_token: string;
  connected_at: string;
  last_sync_at: string | null;
  last_error: string | null;
};
const connection = (r: Row): GoogleConnection => ({
  adminId: r.admin_id,
  googleEmail: r.google_email,
  calendarId: r.calendar_id,
  calendarName: r.calendar_name,
  refreshToken: r.refresh_token,
  connectedAt: r.connected_at,
  lastSyncAt: r.last_sync_at,
  lastError: r.last_error,
});

export async function listConnections(): Promise<GoogleConnection[]> {
  const { data, error } = await db().from("crm_google_connections").select("*");
  if (error) fail("Impossibile leggere i collegamenti Google.");
  return (data ?? []).map(connection);
}
export async function getConnection(adminId: string) {
  const { data, error } = await db()
    .from("crm_google_connections")
    .select("*")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (error) fail("Impossibile leggere il collegamento Google.");
  return data ? connection(data) : undefined;
}
export async function saveConnection(
  adminId: string,
  values: {
    googleEmail: string;
    refreshToken: string;
    calendarId?: string;
    calendarName?: string | null;
  },
) {
  const { error } = await db()
    .from("crm_google_connections")
    .upsert({
      admin_id: adminId,
      google_email: values.googleEmail,
      refresh_token: values.refreshToken,
      calendar_id: values.calendarId ?? "primary",
      calendar_name: values.calendarName ?? null,
      connected_at: new Date().toISOString(),
      last_error: null,
    });
  if (error) fail("Impossibile salvare il collegamento Google.");
}
export async function updateConnection(
  adminId: string,
  patch: Partial<
    Pick<Row, "calendar_id" | "calendar_name" | "last_sync_at" | "last_error">
  >,
) {
  const { error } = await db()
    .from("crm_google_connections")
    .update(patch)
    .eq("admin_id", adminId);
  if (error) fail("Impossibile aggiornare il collegamento Google.");
}
/** Removing the connection also removes its links (cascade). */
export async function deleteConnection(adminId: string) {
  const { error } = await db()
    .from("crm_google_connections")
    .delete()
    .eq("admin_id", adminId);
  if (error) fail("Impossibile scollegare Google Calendar.");
}

export async function listLinks(adminId: string): Promise<CalendarLink[]> {
  const { data, error } = await db()
    .from("crm_google_links")
    .select("ref, google_event_id, hash")
    .eq("admin_id", adminId);
  if (error) fail("Impossibile leggere gli eventi sincronizzati.");
  return (data ?? []).map((l) => ({
    ref: l.ref,
    googleEventId: l.google_event_id,
    hash: l.hash,
  }));
}
export async function saveLinks(adminId: string, links: CalendarLink[]) {
  if (!links.length) return;
  const { error } = await db()
    .from("crm_google_links")
    .upsert(
      links.map((l) => ({
        admin_id: adminId,
        ref: l.ref,
        google_event_id: l.googleEventId,
        hash: l.hash,
      })),
    );
  if (error) fail("Impossibile salvare gli eventi sincronizzati.");
}
export async function deleteLinks(adminId: string, refs: string[]) {
  if (!refs.length) return;
  const { error } = await db()
    .from("crm_google_links")
    .delete()
    .eq("admin_id", adminId)
    .in("ref", refs);
  if (error) fail("Impossibile aggiornare gli eventi sincronizzati.");
}

export async function listEvents(): Promise<TeamEvent[]> {
  const { data, error } = await db().from("crm_events").select("payload");
  if (error) fail("Impossibile leggere l’agenda.");
  return (data ?? []).flatMap((r) => {
    const parsed = teamEvent.safeParse(r.payload);
    return parsed.success ? [parsed.data] : [];
  });
}
export async function saveEvent(event: TeamEvent) {
  const { error } = await db()
    .from("crm_events")
    .upsert({ id: event.id, payload: event });
  if (error) fail("Impossibile salvare l’appuntamento.");
}
