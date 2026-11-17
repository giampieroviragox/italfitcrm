import {
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
  requireAccess,
} from "@/modules/crm/server/auth";
import {
  deleteConnection,
  deleteLinks,
  getConnection,
  listLinks,
  listConnections,
  updateConnection,
} from "@/modules/crm/server/calendar-store";
import { syncCalendar } from "@/modules/crm/server/calendar-sync";
import {
  accessToken,
  decryptToken,
  deleteEvent,
  googleConfigured,
  googleRedirectUri,
  revokeToken,
  writableCalendars,
} from "@/modules/crm/server/google";

const noStore = { headers: { "Cache-Control": "no-store" } };

/** The member's connection, their writable calendars and who in the team is connected. */
export async function GET() {
  try {
    const { access } = await requireAccess(true);
    if (!googleConfigured())
      return Response.json(
        { configured: false, redirectUri: googleRedirectUri() },
        noStore,
      );
    const all = await listConnections();
    const own = all.find((c) => c.adminId === access.record_id);
    let calendars: { id: string; summary: string; primary?: boolean }[] = [];
    if (own)
      calendars = await accessToken(decryptToken(own.refreshToken))
        .then(writableCalendars)
        .catch(() => []);
    return Response.json(
      {
        configured: true,
        redirectUri: googleRedirectUri(),
        connection: own
          ? {
              googleEmail: own.googleEmail,
              calendarId: own.calendarId,
              calendarName: own.calendarName,
              connectedAt: own.connectedAt,
              lastSyncAt: own.lastSyncAt,
              lastError: own.lastError,
            }
          : null,
        calendars,
        team: all.map((c) => ({
          adminId: c.adminId,
          googleEmail: c.googleEmail,
        })),
      },
      noStore,
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/** Choose the calendar, sync now or disconnect: always the member's own connection. */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { access } = await requireAccess(true);
    const input = await readJsonInput(request, 2_000);
    const own = await getConnection(access.record_id);
    if (!own) throw new HttpError(404, "Google Calendar non è collegato.");
    if (input.action === "calendar") {
      if (typeof input.calendarId !== "string")
        throw new HttpError(400, "Calendario non valido.");
      const calendars = await writableCalendars(
        await accessToken(decryptToken(own.refreshToken)),
      );
      const chosen = calendars.find((c) => c.id === input.calendarId);
      if (!chosen)
        throw new HttpError(400, "Scegli un calendario in cui puoi scrivere.");
      if (chosen.id !== own.calendarId)
        await clearCalendar(access.record_id, own);
      await updateConnection(access.record_id, {
        calendar_id: chosen.id,
        calendar_name: chosen.summary,
      });
      return Response.json(await syncCalendar(access.record_id), noStore);
    }
    // Always a full rewrite: what was changed or deleted on Google comes back.
    if (input.action === "sync")
      return Response.json(
        await syncCalendar(access.record_id, undefined, undefined, true),
        noStore,
      );
    if (input.action === "disconnect") {
      // Events written by the CRM would no longer be updated: remove them.
      await clearCalendar(access.record_id, own).catch(() => {});
      await revokeToken(decryptToken(own.refreshToken));
      await deleteConnection(access.record_id);
      return Response.json({ disconnected: true }, noStore);
    }
    throw new HttpError(400, "Azione non valida.");
  } catch (e) {
    return errorResponse(e);
  }
}

/** Removes the CRM events from the old calendar before switching. */
async function clearCalendar(
  adminId: string,
  own: { refreshToken: string; calendarId: string },
) {
  const token = await accessToken(decryptToken(own.refreshToken));
  const links = await listLinks(adminId);
  for (const link of links)
    await deleteEvent(token, own.calendarId, link.googleEventId).catch(
      () => {},
    );
  await deleteLinks(
    adminId,
    links.map((l) => l.ref),
  );
}
