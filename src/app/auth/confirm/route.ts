import { createSessionClient } from "@/lib/supabase/server";
import { checkOrigin } from "@/modules/crm/server/auth";
function redirectTo(path: string) {
  // Relative redirects preserve the browser origin behind a local/reverse proxy.
  return new Response(null, {
    status: 303,
    headers: {
      Location: path,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  if (
    token_hash &&
    (type === "invite" || type === "recovery" || type === "email")
  ) {
    const client = await createSessionClient();
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    if (!error) return redirectTo("/imposta-password");
  }
  return redirectTo("/login?link=scaduto");
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const text = await request.text();
    if (text.length > 4096) return redirectTo("/login?link=scaduto");
    const form = new URLSearchParams(text);
    const token_hash = form.get("token_hash"),
      type = form.get("type");
    if (
      token_hash &&
      /^[a-zA-Z0-9_-]{32,256}$/.test(token_hash) &&
      (type === "invite" || type === "recovery")
    ) {
      const client = await createSessionClient();
      const { error } = await client.auth.verifyOtp({ token_hash, type });
      if (!error) return redirectTo("/imposta-password");
    }
  } catch {
    /* Invalid or expired links return a generic access screen. */
  }
  return redirectTo("/login?link=scaduto");
}
