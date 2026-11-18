import {
  requireAccess,
  errorResponse,
  HttpError,
} from "@/modules/crm/server/auth";
import { readCrm, readStudentDetail } from "@/modules/crm/server/repository";
import { seesStudent, staffScope } from "@/modules/crm/permissions";

/**
 * Workout logs, notes and history of one student: loaded when the profile
 * opens instead of travelling with every student in the list.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user, access } = await requireAccess(true);
    // Everyone but the owner sees only some students: check against the whole state.
    if (access.role !== "owner") {
      const { state } = await readCrm(user.id);
      if (!seesStudent(staffScope(state, access.record_id), id))
        throw new HttpError(403, "Non segui questo studente.");
    }
    const found = await readStudentDetail(id);
    if (!found) throw new HttpError(404, "Studente non trovato.");
    const { workoutEntries, notes, history } = found.student;
    return Response.json(
      { detail: { workoutEntries, notes, history } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
