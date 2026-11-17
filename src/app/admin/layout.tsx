import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { supabaseConfigured } from "@/lib/supabase/config";
import { requireAccess, HttpError } from "@/modules/crm/server/auth";
import { readCrm } from "@/modules/crm/server/repository";
import { RemoteCrmProvider } from "@/modules/crm/remote-store";
import { allPermissions, staffScope } from "@/modules/crm/permissions";
import { visibleEnvelope } from "@/modules/crm/server/commands";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigured) return <AdminShell>{children}</AdminShell>;
  let identity;
  try {
    identity = await requireAccess(true, readCrm);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login");
    if (e instanceof HttpError && e.status === 403) redirect("/area-studente");
    throw e;
  }
  const saved = identity.preloaded;
  const scope = staffScope(saved.state, identity.access.record_id);
  return (
    <RemoteCrmProvider
      initial={visibleEnvelope(saved, scope)}
      viewer={{
        role: identity.access.role,
        recordId: identity.access.record_id,
        permissions: allPermissions.filter(scope.can),
      }}
    >
      <AdminShell>{children}</AdminShell>
    </RemoteCrmProvider>
  );
}
