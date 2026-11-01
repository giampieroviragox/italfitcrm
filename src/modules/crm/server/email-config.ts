import "server-only";
import { appUrl } from "@/lib/supabase/config";
import { emailReadiness } from "./access-email";
export function emailConfiguration() {
  return {
    apiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.RESEND_FROM_EMAIL ?? "",
    appUrl: appUrl(),
  };
}
export function emailStatus() {
  const config = emailConfiguration();
  const reason = emailReadiness(config);
  return { enabled: !reason, sender: config.from, reason };
}

export function authEmailEnabled() {
  return process.env.AUTH_EMAIL_ENABLED === "true";
}
