import { createSessionClient } from "@/lib/supabase/server";
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
    if (!error)
      return Response.redirect(new URL("/imposta-password", url), 303);
  }
  return Response.redirect(new URL("/login?link=scaduto", url), 303);
}
