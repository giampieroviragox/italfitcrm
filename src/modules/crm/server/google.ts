import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { appUrl } from "@/lib/supabase/config";
import { calendarTimeZone, type CalendarItem } from "../calendar-sync";
import { HttpError } from "./errors";

/** Google OAuth and Calendar API, called directly over HTTPS. */
export const googleScopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.freebusy",
];
export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.SUPABASE_SECRET_KEY,
  );
}
export const googleRedirectUri = () =>
  `${appUrl().replace(/\/$/, "")}/api/google/callback`;
const credentials = () => {
  const id = process.env.GOOGLE_CLIENT_ID,
    secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret)
    throw new HttpError(503, "Google Calendar non è ancora configurato.");
  return { id, secret };
};

/** Keys derived from the server secret: rotating it requires reconnecting. */
const key = (purpose: string) =>
  Buffer.from(
    hkdfSync(
      "sha256",
      process.env.SUPABASE_SECRET_KEY ?? "",
      "italfit-google",
      purpose,
      32,
    ),
  );
export function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("token"), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decryptToken(value: string) {
  const [iv, tag, data] = value
    .split(".")
    .map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("Token non valido.");
  const decipher = createDecipheriv("aes-256-gcm", key("token"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/** Signed OAuth state bound to the member and a browser nonce (10 minutes). */
export function signState(adminId: string, nonce: string) {
  const body = Buffer.from(
    JSON.stringify({ a: adminId, n: nonce, e: Date.now() + 600_000 }),
  ).toString("base64url");
  const sig = createHmac("sha256", key("state"))
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}
export function readState(state: string, nonce: string | undefined) {
  const [body, sig] = state.split(".");
  if (!body || !sig || !nonce) return undefined;
  const expected = createHmac("sha256", key("state")).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return undefined;
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as {
    a: string;
    n: string;
    e: number;
  };
  return data.n === nonce && data.e > Date.now() ? data.a : undefined;
}

export function authUrl(state: string) {
  const params = new URLSearchParams({
    client_id: credentials().id,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: googleScopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const { id, secret } = credentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      ...body,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    string
  >;
  if (!response.ok)
    throw new GoogleError(response.status, data.error ?? "token_error");
  return data;
}
export async function exchangeCode(code: string) {
  const data = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: googleRedirectUri(),
  });
  if (!data.refresh_token || !data.id_token)
    throw new GoogleError(400, "missing_refresh_token");
  // The ID token comes straight from Google's token endpoint over TLS.
  const claims = JSON.parse(
    Buffer.from(data.id_token.split(".")[1] ?? "", "base64url").toString(),
  ) as { email?: string };
  return { refreshToken: data.refresh_token, email: claims.email ?? "" };
}
export async function accessToken(refreshToken: string) {
  return (
    await tokenRequest({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    })
  ).access_token!;
}
export async function revokeToken(token: string) {
  await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  ).catch(() => {});
}

export class GoogleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Google ${status}: ${code}`);
  }
}
async function api<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  );
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; status?: string };
  };
  if (!response.ok)
    throw new GoogleError(response.status, data.error?.status ?? "api_error");
  return data;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}
export async function writableCalendars(token: string) {
  const data = await api<{
    items?: (GoogleCalendar & { accessRole: string })[];
  }>(token, "/users/me/calendarList?minAccessRole=writer&maxResults=250");
  return (data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    ...(c.primary ? { primary: true } : {}),
  }));
}

const body = (item: CalendarItem, id?: string) =>
  JSON.stringify({
    ...(id ? { id } : {}),
    summary: item.summary,
    description: item.description,
    ...(item.location ? { location: item.location } : {}),
    start: {
      ...item.start,
      ...("dateTime" in item.start ? { timeZone: calendarTimeZone } : {}),
    },
    end: {
      ...item.end,
      ...("dateTime" in item.end ? { timeZone: calendarTimeZone } : {}),
    },
    status: "confirmed",
    reminders: { useDefault: true },
    source: { title: "Team Italfit CRM", url: appUrl() },
  });
const calendarPath = (calendarId: string) =>
  `/calendars/${encodeURIComponent(calendarId)}/events`;

/** Writes an item with a fixed event ID: repeating it never duplicates events. */
export async function putEvent(
  token: string,
  calendarId: string,
  eventId: string,
  item: CalendarItem,
) {
  try {
    await api(token, calendarPath(calendarId), {
      method: "POST",
      body: body(item, eventId),
    });
  } catch (error) {
    // Already there (maybe deleted earlier): update and restore it.
    if (!(error instanceof GoogleError) || error.status !== 409) throw error;
    await api(token, `${calendarPath(calendarId)}/${eventId}`, {
      method: "PUT",
      body: body(item),
    });
  }
}
export async function deleteEvent(
  token: string,
  calendarId: string,
  eventId: string,
) {
  try {
    await api(token, `${calendarPath(calendarId)}/${eventId}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (!(error instanceof GoogleError) || ![404, 410].includes(error.status))
      throw error;
  }
}
export async function busyTimes(
  token: string,
  calendarId: string,
  from: string,
  to: string,
) {
  const data = await api<{
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  }>(token, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: from,
      timeMax: to,
      timeZone: calendarTimeZone,
      items: [{ id: calendarId }],
    }),
  });
  return data.calendars?.[calendarId]?.busy ?? [];
}
