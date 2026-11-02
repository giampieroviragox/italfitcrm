import { redirect } from "next/navigation";
import { StudentPortal } from "@/modules/crm/student-portal";
import { supabaseConfigured } from "@/lib/supabase/config";
import { requireAccess, HttpError } from "@/modules/crm/server/auth";
import { readCrm } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";
import type { StudentView } from "./student-home";
export async function StudentAreaPage({
  view = "home",
}: {
  view?: StudentView;
}) {
  // The student area exists only for signed-in students; staff use the CRM.
  if (!supabaseConfigured) redirect("/admin");
  let identity;
  try {
    identity = await requireAccess();
  } catch (e) {
    if (e instanceof HttpError) redirect("/login");
    throw e;
  }
  if (identity.access.role !== "student") redirect("/admin");
  const initial = await readCrm(identity.user.id);
  return (
    <StudentPortal
      view={view}
      initial={studentProjection(initial.state, identity.access.record_id)}
    />
  );
}
