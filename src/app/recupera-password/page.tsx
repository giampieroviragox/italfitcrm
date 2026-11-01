import Link from "next/link";
import { RecoveryForm } from "@/modules/auth/recovery-form";
import { authEmailEnabled } from "@/modules/crm/server/email-config";
import { Brand } from "@/components/brand";
export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Brand />
      <h1 className="mt-9 text-2xl font-medium">Recupera la password</h1>
      {authEmailEnabled() ? (
        <RecoveryForm />
      ) : (
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Contatta il team per ricevere un nuovo link personale. Dal link potrai
          impostare una nuova password e riprendere l’accesso al tuo account.
        </p>
      )}
      <Link href="/login" className="mt-6 text-xs underline underline-offset-4">
        Torna all’accesso
      </Link>
    </main>
  );
}
