import {
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
  requireAccess,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { applyWalletCommand, walletCommand } from "@/modules/crm/lesson-wallet";
import { prepareTransition } from "@/modules/crm/transition";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess(true);
    const input = await readJsonInput(request, 100_000);
    const command = walletCommand.safeParse(input.command);
    if (!command.success || !Number.isSafeInteger(input.revision))
      throw new HttpError(400, "Controlla i dati del wallet.");
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
        applyWalletCommand(current.state, command.data, new Date(), actor.name),
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
