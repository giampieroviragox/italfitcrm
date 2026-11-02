import { PasswordForm } from "@/modules/auth/password-form";
import { readInvite } from "@/modules/auth/invite-context";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Attiva il tuo accesso",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{
    access?: string;
    token_hash?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;
  const invite = params.access
    ? readInvite(params.access, process.env.SUPABASE_SECRET_KEY ?? "")
    : null;
  if (params.access) {
    if (!invite) redirect("/login?link=scaduto");
    return (
      <AuthLayout
        title="Imposta la password"
        description="Il tuo account è pronto. Scegli una password di almeno 8 caratteri per accedere."
      >
        <PasswordForm ready email={invite.email} invite={params.access} />
      </AuthLayout>
    );
  }
  if (
    !params.token_hash ||
    !/^[a-zA-Z0-9_-]{32,256}$/.test(params.token_hash) ||
    !["invite", "recovery"].includes(params.type ?? "")
  )
    redirect("/login?link=scaduto");
  return (
    <AuthLayout
      title="Il tuo accesso a Team Italfit"
      description="Conferma per continuare e scegliere la tua password. Il link è personale e utilizzabile una sola volta."
    >
      <form method="POST" action="/auth/confirm" className="mt-8">
        <input type="hidden" name="token_hash" value={params.token_hash} />
        <input type="hidden" name="type" value={params.type} />
        <Button type="submit" size="lg" className="w-full">
          Continua e imposta la password
        </Button>
      </form>
    </AuthLayout>
  );
}
