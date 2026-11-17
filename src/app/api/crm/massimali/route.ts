import {
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
  requireAccess,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { todayRome } from "@/modules/crm/fitness-logic";
import { prepareTransition } from "@/modules/crm/transition";
import { applyMaxCommand, maxCommand } from "@/modules/crm/workout-log";

/** Staff record or remove a student's maxes (1RM, 3RM, 5RM). */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess(true);
    const input = await readJsonInput(request, 5_000);
    const command = maxCommand.safeParse(input.command);
    if (
      !command.success ||
      typeof input.studentId !== "string" ||
      !Number.isSafeInteger(input.revision)
    )
      throw new HttpError(400, "Controlla esercizio, carico e data.");
    const current = await readCrm(user.id);
    if (input.revision !== current.revision)
      throw new HttpError(409, "Il CRM è cambiato. Verifica i dati e riprova.");
    const actor = {
      id: access.record_id,
      name:
        current.state.admins.find((admin) => admin.id === access.record_id)
          ?.name ?? "Amministratore",
    };
    let next;
    try {
      next = prepareTransition(
        current.state,
        applyMaxCommand(
          current.state,
          input.studentId,
          command.data,
          todayRome(),
          new Date(),
          actor.name,
        ),
        actor,
      );
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }
    const saved = await writeCrm(user.id, current.revision, next);
    return Response.json(saved, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
