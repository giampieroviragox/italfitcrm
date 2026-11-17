import { redirect } from "next/navigation";
import { StudentPortal } from "@/modules/crm/student-portal";
import { supabaseConfigured } from "@/lib/supabase/config";
import { requireAccess, HttpError } from "@/modules/crm/server/auth";
import { readCrm } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";

/**
 * The student area loads once here: switching tabs only swaps the view on
 * the client, without re-reading the CRM.
 */
export default async function StudentAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The student area exists only for signed-in students; staff use the CRM.
  if (!supabaseConfigured) redirect("/admin");
  let identity;
  try {
    identity = await requireAccess(false, readCrm);
  } catch (e) {
    if (e instanceof HttpError) redirect("/login");
    throw e;
  }
  if (identity.access.role !== "student") redirect("/admin");
  return (
    <>
      <StudentPortal
        initial={studentProjection(
          identity.preloaded.state,
          identity.access.record_id,
        )}
      />
      {children}
    </>
  );
}
