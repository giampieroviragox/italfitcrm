import Link from "next/link";
import { RecoveryForm } from "@/modules/auth/recovery-form";
import { authEmailEnabled } from "@/modules/crm/server/email-config";
import { AuthLayout } from "@/components/layout/auth-layout";
export default function Page() {
  return (
    <AuthLayout
      title="Recupera la password"
      footer={
        <Link href="/login" className="hover:text-foreground hover:underline">
          Torna all’accesso
        </Link>
      }
    >
      {authEmailEnabled() ? (
        <RecoveryForm />
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Contatta il team per ricevere un nuovo link personale. Dal link potrai
          impostare una nuova password e riprendere l’accesso al tuo account.
        </p>
      )}
    </AuthLayout>
  );
}
