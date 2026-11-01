import "server-only";
import { appUrl } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export type Access = {
  user_id: string;
  role: "owner" | "admin" | "student";
  record_id: string;
  active: boolean;
  accepted_at: string | null;
};
import { HttpError } from "./errors.ts";
export { HttpError } from "./errors.ts";
export async function requireAccess(staff = false) {
  const session = await createSessionClient();
  const {
    data: { user },
    error,
  } = await session.auth.getUser();
  if (error || !user) throw new HttpError(401, "Accedi per continuare.");
  const { data, error: accessError } = await session
    .from("crm_access")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const access = data as Access | null;
  if (accessError || !access?.active)
    throw new HttpError(403, "Questo account non ha accesso al workspace.");
  if (staff && access.role === "student")
    throw new HttpError(403, "Accesso riservato agli amministratori.");
  if (!access.accepted_at) {
    const { error: acceptError } = await createAdminClient()
      .rpc("crm_accept_access", { p_actor: user.id })
      .retry(false);
    if (acceptError)
      throw new HttpError(503, "Impossibile verificare l’account.");
  }
  return { user, access, session };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const canonical = new URL(appUrl());
  const allowed = new Set([canonical.origin]);
  if (["127.0.0.1", "localhost"].includes(canonical.hostname)) {
    const alternate = new URL(canonical);
    alternate.hostname =
      canonical.hostname === "localhost" ? "127.0.0.1" : "localhost";
    allowed.add(alternate.origin);
  }
  if (!origin || !allowed.has(origin))
    throw new HttpError(403, "Richiesta non consentita.");
}
export function errorResponse(error: unknown) {
  const status = error instanceof HttpError ? error.status : 500;
  return Response.json(
    {
      error:
        status === 500
          ? "Salvataggio non riuscito. Riprova tra poco."
          : (error as Error).message,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function readJsonInput(
  request: Request,
  maxLength = 12000,
): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > maxLength)
    throw new HttpError(413, "Richiesta troppo grande.");
  try {
    const input: unknown = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error();
    return input as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Richiesta non valida.");
  }
}
