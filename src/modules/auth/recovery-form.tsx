"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, control } from "@/modules/crm/ui";
import { requestReset } from "@/app/recupera-password/actions";
export function RecoveryForm() {
  const [state, action, pending] = useActionState(requestReset, {
    done: false,
  });
  return state.done ? (
    <p role="status" className="mt-2 text-sm leading-6 text-muted-foreground">
      Se l’indirizzo è associato a un account, riceverai un link per impostare
      una nuova password.
    </p>
  ) : (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Email">
        <input
          className={control}
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="mt-2 w-full"
      >
        {pending ? "Invio…" : "Invia link di recupero"}
      </Button>
    </form>
  );
}
