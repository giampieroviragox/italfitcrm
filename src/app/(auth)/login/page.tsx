import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/layout/auth-layout";
import { LoginForm } from "@/modules/auth/login-form";
import { supabaseConfigured } from "@/lib/supabase/config";
import { requireAccess } from "@/modules/crm/server/auth";
export const metadata: Metadata = { title: "Accedi" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const params = await searchParams;
  let destination: string | null = null;
  if (supabaseConfigured) {
    try {
      const { access } = await requireAccess();
      destination = access.role === "student" ? "/area-studente" : "/admin";
    } catch {
      /* An unauthenticated user needs the form. */
    }
  }
  if (destination) redirect(destination);
  return (
    <AuthLayout
      title="Accedi a Team Italfit"
      description="Usa le credenziali del tuo account. Gli accessi sono gestiti dal team."
      footer={
        supabaseConfigured ? (
          <Link
            href="/recupera-password"
            className="hover:text-foreground hover:underline"
          >
            Password dimenticata?
          </Link>
        ) : (
          <>
            Accesso non attivo nella demo.{" "}
            <Link
              href="/admin"
              className="text-foreground underline underline-offset-4"
            >
              Apri la demo admin
            </Link>
          </>
        )
      }
    >
      {params.link === "scaduto" && (
        <p
          role="alert"
          className="mt-5 rounded-[10px] bg-red-500/10 px-3 py-2.5 text-[13px] leading-5 text-red-700 dark:text-red-400"
        >
          Il link di accesso è scaduto o è già stato usato. Chiedi al team un
          nuovo link per impostare la password: il solo invito non crea una
          password per accedere.
        </p>
      )}
      <LoginForm enabled={supabaseConfigured} />
    </AuthLayout>
  );
}
