import { createHash } from "node:crypto";

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
export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function accessEmail(name: string, link: string) {
  const intro = `Ciao ${name}, il team ha preparato il tuo accesso a Team Italfit.`;
  const explanation =
    "Apri il link e scegli la tua password per l’email già indicata. Il link è personale, temporaneo e utilizzabile una sola volta.";
  return {
    subject: "Il tuo accesso a Team Italfit",
    text: `${intro}\n\n${explanation}\n\n${link}\n\nSe non ti aspettavi questo invito, ignora questa email.`,
    html: `<!doctype html><html lang="it"><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#171719"><main style="max-width:520px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e8e8e9;border-radius:16px"><p style="font-size:18px;font-weight:700">Team Italfit<span style="color:#e53030">.</span></p><h1 style="font-size:24px;line-height:1.3;margin-top:32px">Il tuo accesso è pronto</h1><p style="font-size:15px;line-height:1.7">${escapeHtml(intro)}</p><p style="font-size:15px;line-height:1.7">${explanation}</p><a href="${escapeHtml(link)}" style="display:inline-block;margin:12px 0 24px;padding:14px 20px;border-radius:8px;background:#202022;color:#fff;text-decoration:none">Attiva il tuo accesso</a><p style="font-size:13px;line-height:1.6;color:#69696c">Se il pulsante non funziona, copia questo indirizzo nel browser:</p><p style="font-size:12px;line-height:1.6;word-break:break-all">${escapeHtml(link)}</p><p style="font-size:12px;line-height:1.6;color:#69696c">Se non ti aspettavi questo invito, ignora questa email.</p></main></body></html>`,
  };
}
export async function sendAccessEmail(
  config: EmailConfiguration,
  to: string,
  name: string,
  link: string,
  fetcher: typeof fetch = fetch,
) {
  const problem = emailReadiness(config);
  if (problem) throw new Error(problem);
  if (!email.test(to) || new URL(link).origin !== new URL(config.appUrl).origin)
    throw new Error("Destinatario o link di accesso non valido.");
  const message = accessEmail(name, link);
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
