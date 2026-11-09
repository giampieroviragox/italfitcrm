"use server";
import { redirect } from "next/navigation";
import { requireAccess } from "@/modules/crm/server/auth";
import { allowedOAuthRedirect, validAuthorizationId } from "./oauth-consent";

const development = process.env.NODE_ENV !== "production";

export async function decideAuthorization(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const authorizationId = form.get("authorization_id");
  const decision = form.get("decision");
  if (
    !validAuthorizationId(authorizationId) ||
    (decision !== "approve" && decision !== "deny")
  )
    return { error: "Richiesta di autorizzazione non valida." };
  let session;
  try {
    ({ session } = await requireAccess(true));
  } catch {
    return {
      error: "Solo gli amministratori attivi possono autorizzare Claude.",
    };
  }
  const oauth = session.auth.oauth;
  if (decision === "approve") {
    // Re-check the client on the server: the form could be replayed.
    const { data: details, error } =
      await oauth.getAuthorizationDetails(authorizationId);
    if (error || !details)
      return { error: "La richiesta è scaduta. Riavvia il collegamento." };
    if (
      "authorization_id" in details &&
      !allowedOAuthRedirect(details.redirect_uri, development)
    )
      return { error: "Questa applicazione non è autorizzata." };
  }
  const { data, error } =
    decision === "approve"
      ? await oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        });
  if (error || !data?.redirect_url)
    return { error: "La richiesta è scaduta. Riavvia il collegamento." };
  redirect(data.redirect_url);
}
