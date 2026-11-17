import "server-only";
import { after } from "next/server";
import { appUrl } from "@/lib/supabase/config";
import type { TeamEvent } from "../agenda";
import {
  desiredItems,
  googleEventId,
  itemStart,
  planSync,
  type CalendarLink,
} from "../calendar-sync";
import type { CrmState } from "../model";
import { romeToIso, todayRome } from "../fitness-logic";
import {
  deleteLinks,
  getConnection,
  listConnections,
  listEvents,
  listLinks,
  saveLinks,
  updateConnection,
} from "./calendar-store";
import {
  GoogleError,
  accessToken,
  decryptToken,
  deleteEvent,
  googleConfigured,
  putEvent,
} from "./google";
import { readCrm } from "./repository";

/** Background reads do not belong to a user: no preferences are needed. */
const systemActor = "00000000-0000-0000-0000-000000000000";
/** Past events are kept; up to a year ahead is written. */
const syncWindow = (fromToday = false) => {
  const now = Date.now();
  return {
    // A full resync never touches the past: from the start of today (Rome).
    from: fromToday
      ? romeToIso(`${todayRome()}T00:00`)
      : new Date(now - 30 * 86_400_000).toISOString(),
    to: new Date(now + 365 * 86_400_000).toISOString(),
  };
};
const maxWritesPerRun = 150;

const friendlyError = (error: unknown) =>
  error instanceof GoogleError
    ? error.code === "invalid_grant"
      ? "Il collegamento è scaduto o è stato revocato: ricollega Google Calendar."
      : error.status === 403
        ? "Google ha rifiutato l’accesso al calendario scelto."
        : error.status === 404
          ? "Il calendario scelto non esiste più: scegline un altro."
          : `Google non ha risposto correttamente (${error.status}).`
    : "Sincronizzazione non riuscita. Riprova più tardi.";

/** Brings one member's Google calendar in line with the CRM. */
export async function syncCalendar(
  adminId: string,
  state?: CrmState,
  events?: TeamEvent[],
  /** Rewrites every event from today on, restoring edits made on Google. */
  force = false,
) {
  const connection = await getConnection(adminId);
  if (!connection) return { written: 0, removed: 0 };
  try {
    const crm = state ?? (await readCrm(systemActor)).state;
    const agenda = events ?? (await listEvents());
    const token = await accessToken(decryptToken(connection.refreshToken));
    const plan = planSync(
      desiredItems(crm, agenda, adminId, appUrl().replace(/\/$/, "")),
      await listLinks(adminId),
      syncWindow(force),
      force,
    );
    const now = new Date().toISOString();
    const written: CalendarLink[] = [];
    const batch = plan.write.slice(0, maxWritesPerRun);
    // A few calls at a time: fast, and well within Google's rate limits.
    for (let i = 0; i < batch.length; i += 5)
      written.push(
        ...(await Promise.all(
          batch
            .slice(i, i + 5)
            .map(async ({ item, hash, googleEventId: known }) => {
              const id = known ?? (await googleEventId(adminId, item.ref));
              // Guests are emailed by Google only for lessons still to come.
              await putEvent(
                token,
                connection.calendarId,
                id,
                item,
                itemStart(item) > now,
              );
              return { ref: item.ref, googleEventId: id, hash };
            }),
        )),
      );
    await saveLinks(adminId, written);
    for (let i = 0; i < plan.remove.length; i += 5)
      await Promise.all(
        plan.remove
          .slice(i, i + 5)
          .map((link) =>
            deleteEvent(token, connection.calendarId, link.googleEventId, true),
          ),
      );
    await deleteLinks(
      adminId,
      plan.remove.map((l) => l.ref),
    );
    await updateConnection(adminId, {
      last_sync_at: new Date().toISOString(),
      last_error:
        plan.write.length > maxWritesPerRun
          ? "Sincronizzazione parziale: riprova per completarla."
          : null,
    });
    return { written: written.length, removed: plan.remove.length };
  } catch (error) {
    console.error("Google Calendar sync failed", {
      adminId,
      error: error instanceof Error ? error.message : "unknown",
    });
    await updateConnection(adminId, { last_error: friendlyError(error) }).catch(
      () => {},
    );
    throw error;
  }
}

/**
 * Syncs every connected member in parallel, reading the CRM and agenda once.
 * A state just saved can be passed in to skip reading it again.
 */
export async function syncAllCalendars(saved?: CrmState) {
  const connections = await listConnections();
  if (!connections.length) return;
  const [state, events] = await Promise.all([
    saved ?? readCrm(systemActor).then((e) => e.state),
    listEvents(),
  ]);
  await Promise.all(
    connections.map((c) =>
      syncCalendar(c.adminId, state, events).catch(() => {}),
    ),
  );
}

/** Runs the sync after the response, so saving in the CRM never waits for Google. */
export function scheduleCalendarSync(saved?: CrmState) {
  if (!googleConfigured()) return;
  after(() => syncAllCalendars(saved).catch(() => {}));
}
