"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Editor, EditorCancel, Field, control, FormError } from "./ui";
import { activeRemoteStore } from "./remote-store";
import { useRemoteMode } from "./store";
import { requestJson } from "@/lib/request-json";
export function InviteButton({
  id,
  kind,
  disabled = false,
}: {
  id: string;
  kind: "student" | "admin";
  disabled?: boolean;
}) {
  const remote = useRemoteMode();
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [link, setLink] = useState(""),
    [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [emailSent, setEmailSent] = useState(false),
    [emailConfig, setEmailConfig] = useState<{
      enabled: boolean;
      reason: string;
    } | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void requestJson("/api/inviti")
      .then((value) => {
        if (!active) return;
        if (
          !value ||
          typeof value !== "object" ||
          !("enabled" in value) ||
          typeof value.enabled !== "boolean" ||
          !("reason" in value) ||
          typeof value.reason !== "string"
        )
          throw new Error("Configurazione email non disponibile.");
        setEmailConfig({ enabled: value.enabled, reason: value.reason });
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [open]);
  const prepare = async (delivery: "link" | "email") => {
    setPending(true);
    setError("");
    try {
      const data = await requestJson("/api/inviti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, kind, delivery }),
      });
      if (
        !data ||
        typeof data !== "object" ||
        !("link" in data) ||
        typeof data.link !== "string" ||
        !("email" in data) ||
        typeof data.email !== "string"
      )
        throw new Error(
          "Invito non verificato. Aggiorna i dati prima di generarlo di nuovo.",
        );
      setLink(data.link);
      setEmail(data.email);
      setEmailSent("emailSent" in data && data.emailSent === true);
      if ("emailError" in data && typeof data.emailError === "string")
        setError(data.emailError);
      await activeRemoteStore?.refresh().catch(() => {});
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  };
  if (!remote) return null;
  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          setLink("");
          setError("");
          setCopied(false);
          setEmailSent(false);
          setEmailConfig(null);
        }}
      >
        Invita {kind === "student" ? "studente" : "amministratore"}
      </Button>
      {open && (
        <Editor
          title="Invita con un accesso personale"
          description={
            emailConfig?.enabled
              ? "Invia l’invito via email o prepara un link da condividere direttamente con il destinatario."
              : "Prepara un link personale da condividere direttamente con il destinatario."
          }
          close={() => {
            if (!pending) setOpen(false);
          }}
        >
          {link ? (
            <div className="crm-editor-form">
              <p role="status" className="text-sm leading-6">
                {emailSent
                  ? "Invito inviato via email a"
                  : "Link di accesso preparato per"}{" "}
                <strong>{email}</strong>.
              </p>
              <Field
                label="Link di accesso"
                hint="Il link è personale, temporaneo e utilizzabile una sola volta. Condividilo solo con il destinatario."
              >
                <textarea readOnly rows={4} className={control} value={link} />
              </Field>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setError("Copia il link selezionando il campo.");
                  }
                }}
              >
                {copied ? "Link copiato" : "Copia link"}
              </Button>
              <FormError message={error} />
              <div className="crm-form-actions">
                <Button onClick={() => setOpen(false)}>Chiudi</Button>
              </div>
            </div>
          ) : (
            <div className="crm-editor-form">
              <p className="text-sm leading-6 text-muted-foreground">
                Il destinatario potrà scegliere la propria password. Generare un
                nuovo link per un account esistente apre il recupero
                dell’accesso.
              </p>
              <FormError message={error} />
              <div className="crm-form-actions">
                <EditorCancel />
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => void prepare("link")}
                >
                  {pending ? "Preparazione…" : "Genera link"}
                </Button>
                {emailConfig?.enabled && (
                  <Button
                    disabled={pending}
                    onClick={() => void prepare("email")}
                  >
                    {pending ? "Preparazione…" : "Invia invito via email"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Editor>
      )}
    </>
  );
}
