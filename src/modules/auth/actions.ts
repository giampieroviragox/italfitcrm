"use server";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { requireAccess } from "@/modules/crm/server/auth";
export async function signIn(_previous: { error: string }, form: FormData) {
  const email = String(form.get("email") ?? "").trim(),
    password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Inserisci email e password." };
  const client = await createSessionClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error)
    return {
      error: "Email o password non corrette, oppure accesso non disponibile.",
    };
  let destination = "/admin";
  try {
    const { access } = await requireAccess();
    destination = access.role === "student" ? "/area-studente" : "/admin";
  } catch {
    await client.auth.signOut();
    return {
      error: "Questo account non ha accesso a Italfit. Contatta il team.",
    };
  }
  redirect(destination);
}

export async function signOut() {
  const client = await createSessionClient();
  await client.auth.signOut();
  redirect("/login");
}
