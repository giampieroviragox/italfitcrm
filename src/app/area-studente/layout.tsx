import { redirect } from "next/navigation";
import { StudentPortal } from "@/modules/crm/student-portal";
import { supabaseConfigured } from "@/lib/supabase/config";
import { requireAccess, HttpError } from "@/modules/crm/server/auth";
import { readStudentScopeForUser } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";

/**
 * The student area loads once here: switching tabs only swaps the view on
 * the client, without re-reading anything. Only this student's slice of the
 * CRM is read, never the other students.
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
    identity = await requireAccess(false, readStudentScopeForUser);
  } catch (e) {
    if (e instanceof HttpError) redirect("/login");
    throw e;
  }
  if (identity.access.role !== "student" || !identity.preloaded)
    redirect("/admin");
  const scope = identity.preloaded;
  return (
    <>
      <StudentPortal
        initial={studentProjection(
          scope.state,
          identity.access.record_id,
          scope.occupancy,
        )}
      />
      {children}
    </>
  );
}
