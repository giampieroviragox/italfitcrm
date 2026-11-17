const copy = {
  invite: {
    subject: "Il tuo invito a Team Italfit",
    eyebrow: "BENVENUTO NEL TEAM",
    title: "Il tuo accesso è pronto",
    intro:
      "Il team ha preparato il tuo accesso al portale. Scegli una password per entrare con questo indirizzo email.",
    button: "Attiva il tuo accesso",
    security: "Se non ti aspettavi questo invito, ignora questa email.",
  },
  reinvite: {
    subject: "Il tuo nuovo link di accesso a Team Italfit",
    eyebrow: "AREA TEAM ITALFIT",
    title: "Torna nel tuo account",
    intro:
      "Il team ti ha inviato un nuovo link di accesso. Aprilo per scegliere una password e tornare nel portale.",
    button: "Imposta la password",
    security: "Se non ti aspettavi questo nuovo link, ignora questa email.",
  },
  recovery: {
    subject: "Reimposta la password di Team Italfit",
    eyebrow: "SICUREZZA ACCOUNT",
    title: "Scegli una nuova password",
    intro:
      "Abbiamo ricevuto una richiesta di recupero per il tuo account. Apri il link e conferma per scegliere una nuova password.",
    button: "Reimposta la password",
    security:
      "Se non hai chiesto tu il recupero, ignora questa email. La tua password resterà la stessa.",
  },
} as const;

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const expiry = "Il link è personale, scade e si può usare una sola volta.";

function buildEmail(kind: keyof typeof copy, link: string, name?: string) {
  const { subject, eyebrow, title, intro, button, security } = copy[kind];
  const greeting = name?.trim() ? `Ciao ${name.trim()},` : "Ciao,";
  const href = escapeHtml(link);
  return {
    subject,
    text: `${greeting}\n\n${intro}\n\n${button}: ${link}\n\n${expiry}\n${security}\n\nTeam Italfit`,
    html: `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;background-color:#f4f4f5;color:#18181b;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${intro}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;background-color:#ffffff">
<tr><td style="padding:22px 26px;background-color:#18181b;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:-0.7px">
Team Italfit<span style="color:#ff6161">.</span>
</td></tr>
<tr><td style="padding:28px 26px 26px">
<p style="margin:0 0 10px;color:#a31620;font-size:12px;font-weight:bold;letter-spacing:1px">${eyebrow}</p>
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.2">${title}</h1>
<p style="margin:0 0 9px;font-size:16px;line-height:1.6">${escapeHtml(greeting)}</p>
<p style="margin:0 0 22px;font-size:16px;line-height:1.6">${intro}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:8px;background-color:#a31620"><a href="${href}" style="display:inline-block;padding:14px 20px;border-radius:8px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">${button}</a></td></tr></table>
<p style="margin:20px 0 8px;color:#52525b;font-size:13px;line-height:1.6">${expiry}</p>
<p style="margin:0;color:#52525b;font-size:13px;line-height:1.6">Se il pulsante non funziona, copia questo link nel browser:</p>
<p style="margin:6px 0 0;overflow-wrap:anywhere;word-break:break-all;font-size:12px;line-height:1.6">${href}</p>
</td></tr>
<tr><td style="padding:16px 26px;border-top:1px solid #e4e4e7;color:#52525b;font-size:13px;line-height:1.6">${security}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  };
}
export function accessEmail(
  name: string,
  link: string,
  kind: "invite" | "reinvite" = "invite",
) {
  return buildEmail(kind, link, name);
}
export function recoveryEmailTemplate() {
  return buildEmail(
    "recovery",
    "{{ .SiteURL }}/invito?token_hash={{ .TokenHash }}&type=recovery",
  );
}
