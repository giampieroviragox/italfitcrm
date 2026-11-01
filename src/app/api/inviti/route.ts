import {
  requireAccess,
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
} from "@/modules/crm/server/auth";
import { readCrm } from "@/modules/crm/server/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { signInvite } from "@/modules/auth/invite-context";
import { appUrl } from "@/lib/supabase/config";
import {
  emailConfiguration,
  emailStatus,
} from "@/modules/crm/server/email-config";
import { sendAccessEmail } from "@/modules/crm/server/access-email";
export async function GET() {
  try {
    await requireAccess(true);
    return Response.json(emailStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess(true);
    const input = await readJsonInput(request);
    if (
      (input.kind !== "student" && input.kind !== "admin") ||
      typeof input.id !== "string" ||
      (input.delivery !== undefined &&
        input.delivery !== "link" &&
        input.delivery !== "email")
    )
      throw new HttpError(400, "Invito non valido.");
    if (input.delivery === "email" && !emailStatus().enabled)
      throw new HttpError(503, emailStatus().reason);
    if (input.kind === "admin" && access.role !== "owner")
      throw new HttpError(
        403,
        "Solo il proprietario può invitare amministratori.",
      );
    const current = await readCrm(user.id);
    const person =
      input.kind === "student"
        ? current.state.students.find((s) => s.id === input.id && !s.archived)
        : current.state.admins.find(
            (a) => a.id === input.id && a.role !== "owner",
          );
    if (!person) throw new HttpError(404, "Scheda non trovata o archiviata.");
    if ("accessDisabled" in person && person.accessDisabled)
      throw new HttpError(
        409,
        "Riattiva l’accesso dalla scheda prima di generare un nuovo link.",
      );
    const admin = createAdminClient();
    let generated = await admin.auth.admin.generateLink({
      type: person.access ? "recovery" : "invite",
      email: person.email,
    });
    if (generated.error && !person.access) {
      generated = await admin.auth.admin.generateLink({
        type: "recovery",
        email: person.email,
      });
    }
    if (
      generated.error ||
      !generated.data.user ||
      !generated.data.properties?.hashed_token
    )
      throw new HttpError(
        503,
        "Impossibile preparare il link di accesso. Riprova tra poco.",
      );
    const targetUser = generated.data.user.id;
    const { error } = await admin.rpc("crm_link_access", {
      p_actor: user.id,
      p_user: targetUser,
      p_role: input.kind,
      p_record: person.id,
      p_email: person.email,
    });
    if (error)
      throw new HttpError(
        409,
        "L’account è già collegato oppure la scheda è cambiata. Ricarica e verifica l’email.",
      );
    const type =
      generated.data.properties.verification_type === "invite"
        ? "invite"
        : "recovery";
    const link = new URL("/invito", appUrl());
    link.searchParams.set(
      "access",
      signInvite(
        {
          email: generated.data.user.email ?? person.email,
          token_hash: generated.data.properties.hashed_token,
          type,
        },
        process.env.SUPABASE_SECRET_KEY ?? "",
      ),
    );
    let emailSent = false,
      emailError = "";
    if (input.delivery === "email") {
      try {
        await sendAccessEmail(
          emailConfiguration(),
          person.email,
          "firstName" in person ? person.firstName : person.name,
          link.toString(),
        );
        emailSent = true;
      } catch {
        emailError =
          "Il servizio non ha confermato l’invio dell’email. Condividi il link personale qui sotto; evita di inviare nuovi inviti finché non hai verificato l’esito.";
      }
    }
    return Response.json(
      { link: link.toString(), email: person.email, emailSent, emailError },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
