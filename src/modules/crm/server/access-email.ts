import { createHash } from "node:crypto";
import { accessEmail } from "../../auth/email-template.ts";

export interface EmailConfiguration {
  apiKey: string;
  from: string;
  appUrl: string;
}
const email = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
export function emailReadiness(config: EmailConfiguration) {
  if (!config.apiKey) return "Servizio email non configurato.";
  if (!email.test(config.from))
    return "Configura un indirizzo mittente su un dominio verificato in Resend.";
  try {
    const url = new URL(config.appUrl);
    if (
      url.protocol !== "https:" ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return "Gli inviti via email richiedono l’indirizzo pubblico HTTPS del gestionale.";
  } catch {
    return "Indirizzo pubblico del gestionale non valido.";
  }
  return "";
}
export { accessEmail };
export async function sendAccessEmail(
  config: EmailConfiguration,
  to: string,
  name: string,
  link: string,
  fetcher: typeof fetch = fetch,
  kind: "invite" | "reinvite" = "invite",
) {
  const problem = emailReadiness(config);
  if (problem) throw new Error(problem);
  if (!email.test(to) || new URL(link).origin !== new URL(config.appUrl).origin)
    throw new Error("Destinatario o link di accesso non valido.");
  const message = accessEmail(name, link, kind);
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `italfit-access/${createHash("sha256").update(link).digest("hex")}`,
    },
    body: JSON.stringify({
      from: `Team Italfit <${config.from}>`,
      to: [to],
      ...message,
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (
    !response.ok ||
    !data ||
    typeof data !== "object" ||
    !("id" in data) ||
    typeof data.id !== "string"
  )
    throw new Error(
      "Il servizio email non ha confermato l’invio. Puoi condividere il link personale o generare un nuovo invito.",
    );
  return data.id;
}
