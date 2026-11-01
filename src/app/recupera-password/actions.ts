"use server";
import { createSessionClient } from "@/lib/supabase/server";
import { authEmailEnabled } from "@/modules/crm/server/email-config";
import { appUrl } from "@/lib/supabase/config";
export async function requestReset(_state: { done: boolean }, form: FormData) {
  if (!authEmailEnabled()) return { done: true };
  const email = String(form.get("email") ?? "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const client = await createSessionClient();
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl() + "/imposta-password",
    });
  }
  return { done: true };
}
