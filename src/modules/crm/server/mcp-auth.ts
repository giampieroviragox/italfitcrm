import "server-only";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { supabaseFetch } from "@/lib/supabase/fetch";
import type { Access } from "./auth";

export interface McpPrincipal {
  userId: string;
  role: "owner" | "admin";
}

export function supabaseIssuer() {
  return `${supabasePublicConfig().url.replace(/\/$/, "")}/auth/v1`;
}

// Plain session tokens are accepted only during local development, so the
// endpoint can be tested before the Supabase OAuth server is enabled.
const allowSessionTokens = () => process.env.NODE_ENV !== "production";

/**
 * Verifies a bearer token issued by Supabase Auth for the MCP connector.
 * Returns undefined (401) for anything that is not an active owner/admin:
 * roles always come from crm_access, never from token metadata.
 */
export async function verifyMcpToken(
  bearer: string | undefined,
): Promise<AuthInfo | undefined> {
  if (!bearer || bearer.length > 8192) return undefined;
  const { url, key } = supabasePublicConfig();
  const auth = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch },
  }).auth;
  const { data: verified, error } = await auth.getClaims(bearer);
  const claims = verified?.claims;
  if (error || !claims) return undefined;
  const clientId =
    typeof claims.client_id === "string" ? claims.client_id : undefined;
  if (
    claims.iss !== supabaseIssuer() ||
    claims.aud !== "authenticated" ||
    claims.role !== "authenticated" ||
    typeof claims.sub !== "string" ||
    (!clientId && !allowSessionTokens())
  )
    return undefined;
  // Confirms with Auth that the session still exists (revoked grants fail).
  const { data: live, error: liveError } = await auth.getUser(bearer);
  if (liveError || live.user?.id !== claims.sub) return undefined;
  const { data, error: accessError } = await createAdminClient()
    .from("crm_access")
    .select("*")
    .eq("user_id", claims.sub)
    .maybeSingle();
  const access = data as Access | null;
  if (
    accessError ||
    !access?.active ||
    !access.accepted_at ||
    (access.role !== "owner" && access.role !== "admin")
  )
    return undefined;
  const principal: McpPrincipal = { userId: claims.sub, role: access.role };
  return {
    token: bearer,
    clientId: clientId ?? "session",
    scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
    expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
    extra: { principal },
  };
}

export function mcpPrincipal(authInfo: AuthInfo | undefined): McpPrincipal {
  const principal = authInfo?.extra?.principal as McpPrincipal | undefined;
  if (!principal) throw new Error("Accesso non autorizzato.");
  return principal;
}
