import {
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
  requireAccess,
} from "@/modules/crm/server/auth";
import { readCrm } from "@/modules/crm/server/repository";
import { listEvents, saveEvent } from "@/modules/crm/server/calendar-store";
import { scheduleCalendarSync } from "@/modules/crm/server/calendar-sync";
import { agendaCommand, applyAgendaCommand } from "@/modules/crm/agenda";
import { staffScope } from "@/modules/crm/permissions";

const noStore = { headers: { "Cache-Control": "no-store" } };
async function agendaAccess() {
  const {
    access,
    preloaded: { state },
  } = await requireAccess(true, readCrm);
  const scope = staffScope(state, access.record_id);
  if (!scope.can("agenda"))
    throw new HttpError(403, "Il tuo ruolo non include l’agenda del team.");
  return { state, scope };
}

/** The shared team agenda, from 60 days ago onwards. */
export async function GET() {
  try {
    await agendaAccess();
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const events = (await listEvents())
      .filter((e) => e.startsAt >= since)
      .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
    return Response.json({ events }, noStore);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Creates, updates or cancels an appointment, then syncs Google calendars. */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { state, scope } = await agendaAccess();
    const command = agendaCommand.safeParse(
      (await readJsonInput(request, 10_000)).command,
    );
    if (!command.success)
      throw new HttpError(
        400,
        "Controlla titolo, orario, durata e partecipanti.",
      );
    let event;
    try {
      event = applyAgendaCommand(state, await listEvents(), command.data, {
        id: scope.adminId,
        owner: scope.owner,
      });
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    await saveEvent(event);
    scheduleCalendarSync(state);
    return Response.json({ event }, noStore);
  } catch (e) {
    return errorResponse(e);
  }
}
