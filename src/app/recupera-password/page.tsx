"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, control } from "@/modules/crm/ui";
import { requestReset } from "./actions";
export default function Page() {
  const [state, action, pending] = useActionState(requestReset, {
    done: false,
  });
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Brand />
      <h1 className="mt-9 text-2xl font-medium">Recupera la password</h1>
      {state.done ? (
        <p
          role="status"
          className="mt-5 text-sm leading-6 text-muted-foreground"
        >
          Se l’indirizzo è associato a un account, riceverai un link per
          impostare una nuova password.
        </p>
      ) : (
        <form action={action} className="mt-7 space-y-5">
          <Field label="Email">
            <input
              className={control}
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Invio…" : "Invia link di recupero"}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 text-xs underline underline-offset-4">
        Torna all’accesso
      </Link>
    </main>
  );
}
