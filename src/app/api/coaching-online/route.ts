import {
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
  requireAccess,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import {
  applyCoachingCommand,
  coachingCommand,
} from "@/modules/crm/online-coaching";
import { prepareTransition } from "@/modules/crm/transition";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess(true);
    const input = await readJsonInput(request, 20_000);
    const command = coachingCommand.safeParse(input.command);
    if (!command.success || !Number.isSafeInteger(input.revision))
      throw new HttpError(400, "Controlla i dati dell’abbonamento.");
    const current = await readCrm(user.id);
    if (input.revision !== current.revision)
      throw new HttpError(409, "Il CRM è cambiato. Verifica i dati e riprova.");
    let next;
    try {
      next = prepareTransition(
        current.state,
        applyCoachingCommand(current.state, command.data),
        {
          id: access.record_id,
          name:
            current.state.admins.find((admin) => admin.id === access.record_id)
              ?.name ?? "Amministratore",
        },
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
