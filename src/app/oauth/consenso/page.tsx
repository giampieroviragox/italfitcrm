import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/layout/auth-layout";
import { OAuthConsentForm } from "@/modules/auth/oauth-consent-form";
import {
  allowedOAuthRedirect,
  consentHref,
  validAuthorizationId,
} from "@/modules/auth/oauth-consent";
import { supabaseConfigured } from "@/lib/supabase/config";
import { HttpError, requireAccess } from "@/modules/crm/server/auth";

export const metadata: Metadata = { title: "Collega Claude" };

const development = process.env.NODE_ENV !== "production";

function Notice({ title, children }: { title: string; children: string }) {
  return (
    <AuthLayout
      title={title}
      description={children}
      footer={
        <Link href="/login" className="hover:text-foreground hover:underline">
          Torna all’accesso
        </Link>
      }
    >
      {null}
    </AuthLayout>
  );
}

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string | string[] }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!supabaseConfigured || !validAuthorizationId(authorizationId))
    return (
      <Notice title="Richiesta non valida">
        Il link di collegamento non è valido. Riavvia il collegamento da Claude.
      </Notice>
    );
  let session;
  try {
    ({ session } = await requireAccess(true));
  } catch (error) {
    if (error instanceof HttpError && error.status === 401)
      redirect(
        `/login?next=${encodeURIComponent(consentHref(authorizationId))}`,
      );
    return (
      <Notice title="Accesso riservato">
        Solo gli amministratori del team possono collegare Claude al CRM.
      </Notice>
    );
  }
  const { data: details, error } =
    await session.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details)
    return (
      <Notice title="Richiesta scaduta">
        La richiesta di collegamento è scaduta o è già stata usata. Riavvia il
        collegamento da Claude.
      </Notice>
    );
  // Already authorized earlier: Supabase returns the final redirect directly.
  if (!("authorization_id" in details)) redirect(details.redirect_url);
  const allowed = allowedOAuthRedirect(details.redirect_uri, development);
  const host = new URL(details.redirect_uri).host;
  return (
    <AuthLayout
      title={`Collegare ${details.client.name || "l’applicazione"} al CRM?`}
      description={
        <>
          Accesso come <strong>{details.user.email}</strong>. Il collegamento
          vale finché non lo revochi.
        </>
      }
    >
      {allowed ? (
        <ul className="mt-6 space-y-2 rounded-xl bg-muted px-4 py-3.5 text-[13px] leading-5 text-muted-foreground">
          <li>Potrà cercare gli studenti e leggere i loro piani.</li>
          <li>Non vedrà contatti, note interne o proprietà CRM.</li>
          <li>Non potrà pubblicare piani agli studenti.</li>
          <li>
            Ritorno a <span className="text-foreground">{host}</span>
          </li>
        </ul>
      ) : (
        <p
          role="alert"
          className="mt-6 rounded-[10px] bg-red-500/10 px-3 py-2.5 text-[13px] leading-5 text-red-700 dark:text-red-400"
        >
          Questa applicazione ({host}) non è autorizzata a collegarsi al CRM.
          Puoi solo rifiutare la richiesta.
        </p>
      )}
      <OAuthConsentForm
        authorizationId={details.authorization_id}
        canApprove={allowed}
      />
    </AuthLayout>
  );
}
