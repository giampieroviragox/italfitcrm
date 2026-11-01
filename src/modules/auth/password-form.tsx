"use client";
import { useActionState } from "react";
import { savePassword } from "./password-actions";
import { Button } from "@/components/ui/button";
import { Field, control, FormError } from "@/modules/crm/ui";
export function PasswordForm({
  ready,
  email = "",
  invite,
}: {
  ready: boolean;
  email?: string;
  invite?: string;
}) {
  const [state, action, pending] = useActionState(savePassword, { error: "" });
  return (
    <form action={action} className="mt-7 space-y-5">
      {invite && <input type="hidden" name="invite" value={invite} />}
      {email && (
        <Field label="Email">
          <input
            className={control}
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            readOnly
          />
        </Field>
      )}
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
      <FormError message={state.error} />
      <Button type="submit" className="w-full" disabled={!ready || pending}>
        {pending ? "Salvataggio…" : "Salva password e accedi"}
      </Button>
      {!ready && (
        <p role="alert" className="text-sm leading-6 text-destructive">
          Sessione di attivazione assente o scaduta. Apri il link personale
          ricevuto dal team e premi “Continua e imposta la password”. Se il link
          è già stato usato, chiedi al team di generarne uno nuovo.
        </p>
      )}
    </form>
  );
}
