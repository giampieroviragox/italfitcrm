import { createSessionClient } from "@/lib/supabase/server";
import { checkOrigin, errorResponse } from "@/modules/crm/server/auth";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const client = await createSessionClient();
    await client.auth.signOut();
    return new Response(null, {
      status: 303,
      headers: { Location: "/login", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
