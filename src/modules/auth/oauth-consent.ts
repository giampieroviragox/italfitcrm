// Rules for the OAuth consent page used by the Claude connector.

export const consentPath = "/oauth/consenso";

/** Redirect URIs of the hosted Claude apps (web, desktop, mobile). */
const claudeCallbacks = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]);

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Only Claude's callbacks may receive an authorization code. Loopback
 * redirects are accepted during local development for manual tests.
 */
export function allowedOAuthRedirect(uri: string, development: boolean) {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  const base = `${url.origin}${url.pathname}`;
  if (claudeCallbacks.has(base)) return true;
  return (
    development && url.protocol === "http:" && loopbackHosts.has(url.hostname)
  );
}

export function validAuthorizationId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{8,200}$/.test(value);
}

export function consentHref(authorizationId: string) {
  return `${consentPath}?authorization_id=${encodeURIComponent(authorizationId)}`;
}

/** Post-login destination: only the consent page, never an arbitrary URL. */
export function safeLoginNext(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(`${consentPath}?`))
    return null;
  const url = new URL(value, "http://italfit.invalid");
  const id = url.searchParams.get("authorization_id");
  return url.origin === "http://italfit.invalid" &&
    url.pathname === consentPath &&
    validAuthorizationId(id)
    ? consentHref(id)
    : null;
}
