"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { readInvite } from "./invite-context";
import { requireAccess } from "@/modules/crm/server/auth";

export async function savePassword(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8)
    return { error: "Scegli una password di almeno 8 caratteri." };
  if (password !== form.get("confirm"))
    return { error: "Le password non coincidono." };
  let destination: string;
  try {
    const encodedInvite = form.get("invite");
    let invitedEmail: string | undefined;
    if (encodedInvite !== null) {
      const invite =
        typeof encodedInvite === "string"
          ? readInvite(encodedInvite, process.env.SUPABASE_SECRET_KEY ?? "")
          : null;
      if (!invite)
        return {
          error: "Link di accesso non valido. Chiedi al team un nuovo invito.",
        };
      invitedEmail = invite.email;
      const client = await createSessionClient();
      const { data: current } = await client.auth.getUser();
      // A successful verification may already have established the session on
      // an earlier submission (e.g. the provider rejected a weak password).
      if (current.user?.email !== invite.email) {
        const { data, error } = await client.auth.verifyOtp({
          token_hash: invite.token_hash,
          type: invite.type,
        });
        if (error || data.user?.email !== invite.email)
          return {
            error:
              "Il link è scaduto o è già stato usato. Chiedi al team un nuovo invito.",
          };
      }
    }
    const { session, access, user } = await requireAccess();
    if (invitedEmail && user.email !== invitedEmail)
      return {
        error:
          "La sessione non corrisponde all’account invitato. Riapri il link ricevuto dal team.",
      };
    const { error } = await session.auth.updateUser({ password });
    if (error) {
      if (error.code === "same_password")
        return {
          error: "Questa password è già impostata. Scegline una diversa.",
        };
      if (error.code === "weak_password")
        return {
          error: "La password è troppo debole. Scegline una più sicura.",
        };
      return {
        error:
          "Password non salvata. Riprova; se il problema continua, chiedi al team un nuovo link di accesso.",
      };
    }
    destination = access.role === "student" ? "/area-studente" : "/admin";
  } catch {
    return {
      error:
        "La sessione di attivazione è scaduta o non è valida. Chiedi al team un nuovo link e aprilo nello stesso browser.",
    };
  }
  redirect(destination);
}
