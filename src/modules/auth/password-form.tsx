"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSessionClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, control, FormError } from "@/modules/crm/ui";
export function PasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const client = createBrowserSessionClient();
    void client.auth.getUser().then(({ data }) => setReady(Boolean(data.user)));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) =>
      setReady(Boolean(session)),
    );
    return () => subscription.unsubscribe();
  }, []);
  return (
    <form
      className="mt-7 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget),
          password = String(data.get("password"));
        if (password !== data.get("confirm")) {
          setError("Le password non coincidono.");
          return;
        }
        setPending(true);
        const { error } = await createBrowserSessionClient().auth.updateUser({
          password,
        });
        if (error) {
          setError(
            "Impossibile impostare la password. Verifica il link e scegli almeno 8 caratteri.",
          );
          setPending(false);
        } else {
          router.replace("/login");
          router.refresh();
        }
      }}
    >
      <Field label="Nuova password">
        <input
          className={control}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={!ready || pending}
        />
      </Field>
      <Field label="Conferma password">
        <input
          className={control}
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={!ready || pending}
        />
      </Field>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={!ready || pending}>
        {pending ? "Salvataggio…" : "Salva password"}
      </Button>
      {!ready && (
        <p className="text-xs leading-6 text-muted-foreground">
          Apri questa pagina dal link di invito o recupero ricevuto via email.
        </p>
      )}
    </form>
  );
}
