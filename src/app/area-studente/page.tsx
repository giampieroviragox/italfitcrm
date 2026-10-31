import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudentPreview } from "@/modules/crm/student-preview";
import { StudentPortal } from "@/modules/crm/student-portal";
import { supabaseConfigured } from "@/lib/supabase/config";
import { requireAccess, HttpError } from "@/modules/crm/server/auth";
import { readCrm } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";
import { RemoteCrmProvider } from "@/modules/crm/remote-store";
export const metadata: Metadata = { title: "Area studente" };
export default async function StudentAreaPage() {
  if (!supabaseConfigured) return <StudentPreview />;
  let identity;
  try {
    identity = await requireAccess();
  } catch (e) {
    if (e instanceof HttpError) redirect("/login");
    throw e;
  }
  const initial = await readCrm(identity.user.id);
  if (identity.access.role !== "student")
    return (
      <RemoteCrmProvider
        initial={initial}
        viewer={{
          role: identity.access.role,
          recordId: identity.access.record_id,
        }}
      >
        <StudentPreview />
      </RemoteCrmProvider>
    );
  return (
    <StudentPortal
      initial={studentProjection(initial.state, identity.access.record_id)}
    />
  );
}
