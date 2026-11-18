import { requireAccess, errorResponse } from "@/modules/crm/server/auth";
import { readCrm, readRecentActivity } from "@/modules/crm/server/repository";
import { seesStudent, staffScope } from "@/modules/crm/permissions";

/** The latest events across the students the member may see (home page). */
export async function GET() {
  try {
    const { user, access } = await requireAccess(true);
    const rows = await readRecentActivity(60);
    let events = rows;
    if (access.role !== "owner") {
      const { state } = await readCrm(user.id);
      const scope = staffScope(state, access.record_id);
      events = rows.filter((row) => seesStudent(scope, row.student));
    }
    return Response.json(
      { events: events.slice(0, 30) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
