import { PasswordForm } from "@/modules/auth/password-form";
import { readInvite } from "@/modules/auth/invite-context";
import { Brand } from "@/components/brand";
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
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
        <Brand />
        <h1 className="mt-9 text-2xl font-medium">Imposta la password</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Il tuo account è già pronto. Scegli una password di almeno 8 caratteri
          e confermala per accedere a Team Italfit.
        </p>
        <PasswordForm ready email={invite.email} invite={params.access} />
      </main>
    );
  }
  if (
    !params.token_hash ||
    !/^[a-zA-Z0-9_-]{32,256}$/.test(params.token_hash) ||
    !["invite", "recovery"].includes(params.type ?? "")
  )
    redirect("/login?link=scaduto");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Brand />
      <h1 className="mt-9 text-2xl font-medium">
        Il tuo accesso a Team Italfit
      </h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Conferma per continuare e scegliere la tua password. Il link è personale
        e utilizzabile una sola volta.
      </p>
      <form method="POST" action="/auth/confirm" className="mt-7">
        <input type="hidden" name="token_hash" value={params.token_hash} />
        <input type="hidden" name="type" value={params.type} />
        <Button type="submit" className="w-full">
          Continua e imposta la password
        </Button>
      </form>
    </main>
  );
}
