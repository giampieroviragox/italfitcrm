import { type NextRequest } from "next/server";
import {
  errorResponse,
  HttpError,
  requireAccess,
} from "@/modules/crm/server/auth";
import {
  listConnections,
  listEvents,
} from "@/modules/crm/server/calendar-store";
import {
  accessToken,
  busyTimes,
  decryptToken,
  googleConfigured,
} from "@/modules/crm/server/google";
import { readCrm } from "@/modules/crm/server/repository";
import { staffScope } from "@/modules/crm/permissions";
import { validDate } from "@/modules/crm/model";
import { busyFromCrm } from "@/modules/crm/agenda-busy";
import { romeToIso } from "@/modules/crm/fitness-logic";

/**
 * Busy times of team members on a day: CRM lessons and appointments, plus
 * their Google calendar when connected. Only times, never event details.
 */
export async function GET(request: NextRequest) {
  try {
    const {
      access,
      preloaded: { state },
    } = await requireAccess(true, readCrm);
    if (!staffScope(state, access.record_id).can("agenda"))
      throw new HttpError(403, "Il tuo ruolo non include l’agenda del team.");
    const day = request.nextUrl.searchParams.get("date") ?? "";
    const members = (request.nextUrl.searchParams.get("members") ?? "")
      .split(",")
      .filter((id) => state.admins.some((a) => a.id === id))
      .slice(0, 30);
    if (!validDate(day) || !members.length)
      throw new HttpError(400, "Indica un giorno e almeno un membro del team.");
    const from = romeToIso(`${day}T00:00`),
      to = new Date(Date.parse(from) + 86_400_000).toISOString();
    const events = await listEvents();
    const connections = googleConfigured() ? await listConnections() : [];
    const result = await Promise.all(
      members.map(async (adminId) => {
        const crm = busyFromCrm(state, events, adminId, from, to);
        const connection = connections.find((c) => c.adminId === adminId);
        let google: { start: string; end: string }[] = [];
        let googleError = false;
        if (connection)
          google = await accessToken(decryptToken(connection.refreshToken))
            .then((token) => busyTimes(token, connection.calendarId, from, to))
            .catch(() => {
              googleError = true;
              return [];
            });
        return {
          adminId,
          connected: Boolean(connection),
          googleError,
          busy: [
            ...crm,
            ...google.map((b) => ({ ...b, source: "google" as const })),
          ].toSorted((a, b) => a.start.localeCompare(b.start)),
        };
      }),
    );
    return Response.json(
      { date: day, members: result },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
