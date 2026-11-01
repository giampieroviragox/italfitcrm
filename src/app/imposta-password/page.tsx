import Link from "next/link";
import { Brand } from "@/components/brand";
import { PasswordForm } from "@/modules/auth/password-form";
import { createSessionClient } from "@/lib/supabase/server";
export default async function Page() {
  const client = await createSessionClient();
  const { data, error } = await client.auth.getUser();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Brand />
      <h1 className="mt-9 text-2xl font-medium tracking-tight">
        Imposta la password
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Scegli una password di almeno 8 caratteri per il tuo account.
      </p>
      <PasswordForm
        ready={!error && Boolean(data.user)}
        email={data.user?.email}
      />
      <Link href="/login" className="mt-6 text-xs underline underline-offset-4">
        Torna all’accesso
      </Link>
    </main>
  );
}
