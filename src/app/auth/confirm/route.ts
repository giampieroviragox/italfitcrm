import { createSessionClient } from "@/lib/supabase/server";
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
