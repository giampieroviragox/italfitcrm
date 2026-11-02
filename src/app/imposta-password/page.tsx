import Link from "next/link";
import { AuthLayout } from "@/components/layout/auth-layout";
import { PasswordForm } from "@/modules/auth/password-form";
import { createSessionClient } from "@/lib/supabase/server";
export default async function Page() {
  const client = await createSessionClient();
  const { data, error } = await client.auth.getUser();
  return (
    <AuthLayout
      title="Imposta la password"
      description="Scegli una password di almeno 8 caratteri per il tuo account."
      footer={
        <Link href="/login" className="hover:text-foreground hover:underline">
          Torna all’accesso
        </Link>
      }
    >
      <PasswordForm
        ready={!error && Boolean(data.user)}
        email={data.user?.email}
      />
    </AuthLayout>
  );
}
