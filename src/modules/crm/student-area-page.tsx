import { redirect } from "next/navigation";
import { StudentPreview } from "@/modules/crm/student-preview";
import { StudentPortal } from "@/modules/crm/student-portal";
import { supabaseConfigured } from "@/lib/supabase/config";
import { requireAccess, HttpError } from "@/modules/crm/server/auth";
import { readCrm } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";
import { RemoteCrmProvider } from "@/modules/crm/remote-store";
import type { StudentView } from "./student-home";
export async function StudentAreaPage({
  view = "home",
  studentId,
}: {
  view?: StudentView;
  studentId?: string;
}) {
  if (!supabaseConfigured)
    return <StudentPreview view={view} initialStudentId={studentId} />;
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
        <StudentPreview view={view} initialStudentId={studentId} />
      </RemoteCrmProvider>
    );
  return (
    <StudentPortal
      view={view}
      initial={studentProjection(initial.state, identity.access.record_id)}
    />
  );
}
