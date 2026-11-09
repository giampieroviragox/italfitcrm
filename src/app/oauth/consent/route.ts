import { consentPath } from "@/modules/auth/oauth-consent";

// Supabase's default authorization path; the consent page itself is Italian.
// A relative Location keeps the host the browser used.
export function GET(request: Request) {
  const { search } = new URL(request.url);
  return new Response(null, {
    status: 307,
    headers: {
      Location: `${consentPath}${search}`,
      "Cache-Control": "no-store",
    },
  });
}
