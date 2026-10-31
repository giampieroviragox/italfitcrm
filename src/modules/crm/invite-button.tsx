"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Editor, EditorCancel, Field, control, FormError } from "./ui";
import { activeRemoteStore } from "./remote-store";
import { useRemoteMode } from "./store";
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
    [copied, setCopied] = useState(false);
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
        }}
      >
        Invita {kind === "student" ? "studente" : "amministratore"}
      </Button>
      {open && (
        <Editor
          title="Prepara un invito"
          description="Genera un link personale da condividere con il destinatario. Nessuna email viene inviata automaticamente."
          close={() => {
            if (!pending) setOpen(false);
          }}
        >
          {link ? (
            <div className="crm-editor-form">
              <p role="status" className="text-sm leading-6">
                Accesso preparato per <strong>{email}</strong>.
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
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      const response = await fetch("/api/inviti", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id, kind }),
                      });
                      const data = await response.json();
                      if (!response.ok)
                        throw new Error(data.error ?? "Invito non riuscito.");
                      setLink(data.link);
                      setEmail(data.email);
                      await activeRemoteStore?.refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {pending ? "Preparazione…" : "Genera link"}
                </Button>
              </div>
            </div>
          )}
        </Editor>
      )}
    </>
  );
}
