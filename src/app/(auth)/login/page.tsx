import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
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
    <main className="flex min-h-dvh flex-col bg-white">
      <header className="px-6 py-6">
        <Brand />
      </header>
      <section className="mx-auto flex w-full max-w-[410px] flex-1 flex-col justify-center px-6 pb-20">
        <h1 className="text-2xl font-medium tracking-tight">
          Accedi a Team Italfit
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Usa le credenziali del tuo account. Gli accessi sono gestiti dal team.
        </p>
        {params.link === "scaduto" && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-destructive/5 p-4 text-sm text-destructive"
          >
            Il link di accesso è scaduto o è già stato usato. Chiedi al team un
            nuovo link per impostare la password: il solo invito non crea una
            password per accedere.
          </p>
        )}
        <LoginForm enabled={supabaseConfigured} />
        {!supabaseConfigured ? (
          <>
            <p className="mt-5 text-xs leading-6 text-muted-foreground">
              Accesso non attivo nella demo.
            </p>
            <Button asChild variant="outline" className="mt-7">
              <Link href="/admin">Apri la demo admin</Link>
            </Button>
          </>
        ) : (
          <Link
            href="/recupera-password"
            className="mt-5 text-center text-xs text-muted-foreground underline underline-offset-4"
          >
            Password dimenticata?
          </Link>
        )}
      </section>
    </main>
  );
}
