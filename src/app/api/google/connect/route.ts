import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  errorResponse,
  HttpError,
  requireAccess,
} from "@/modules/crm/server/auth";
import {
  authUrl,
  googleConfigured,
  signState,
} from "@/modules/crm/server/google";

/** Starts the Google OAuth flow for the signed-in team member. */
export async function GET() {
  try {
    const { access } = await requireAccess(true);
    if (!googleConfigured())
      throw new HttpError(503, "Google Calendar non è ancora configurato.");
    const nonce = randomBytes(16).toString("base64url");
    const response = NextResponse.redirect(
      authUrl(signState(access.record_id, nonce)),
    );
    response.cookies.set("italfit_google_nonce", nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/google",
      maxAge: 600,
    });
    return response;
  } catch (e) {
    return errorResponse(e);
  }
}
