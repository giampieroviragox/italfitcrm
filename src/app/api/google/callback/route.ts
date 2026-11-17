import { type NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/supabase/config";
import { requireAccess } from "@/modules/crm/server/auth";
import { saveConnection } from "@/modules/crm/server/calendar-store";
import { scheduleCalendarSync } from "@/modules/crm/server/calendar-sync";
import {
  encryptToken,
  exchangeCode,
  readState,
} from "@/modules/crm/server/google";

/** Google redirects here after consent; the member must be the one who started. */
export async function GET(request: NextRequest) {
  const back = (result: string) => {
    const response = NextResponse.redirect(
      `${appUrl().replace(/\/$/, "")}/admin/impostazioni/google?esito=${result}`,
    );
    response.cookies.delete({
      name: "italfit_google_nonce",
      path: "/api/google",
    });
    return response;
  };
  try {
    const { access } = await requireAccess(true);
    const params = request.nextUrl.searchParams;
    if (params.get("error")) return back("annullato");
    const adminId = readState(
      params.get("state") ?? "",
      request.cookies.get("italfit_google_nonce")?.value,
    );
    const code = params.get("code");
    if (!code || adminId !== access.record_id) return back("non-valido");
    const { refreshToken, email } = await exchangeCode(code);
    await saveConnection(adminId, {
      googleEmail: email,
      refreshToken: encryptToken(refreshToken),
    });
    scheduleCalendarSync();
    return back("collegato");
  } catch (error) {
    console.error("Google OAuth callback failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return back("errore");
  }
}
