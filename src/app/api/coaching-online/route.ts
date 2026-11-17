import { staffCommand, parsed } from "@/modules/crm/server/commands";
import { HttpError } from "@/modules/crm/server/errors";
import {
  applyCoachingCommand,
  coachingCommand,
} from "@/modules/crm/online-coaching";
import { requirePermission, requireStudent } from "@/modules/crm/permissions";

/** Online coaching subscriptions and their payments. */
export function POST(request: Request) {
  return staffCommand(request, (state, input, actorName, scope) => {
    const command = parsed(
      coachingCommand.safeParse(input.command),
      "Controlla i dati dell’abbonamento.",
    );
    try {
      requirePermission(
        scope,
        (command.action === "payment" || command.action === "review") &&
          !scope.can("coaching")
          ? "accounting.online"
          : "coaching",
      );
      requireStudent(scope, command.studentId);
    } catch (e) {
      throw new HttpError(403, (e as Error).message);
    }
    return applyCoachingCommand(state, command, new Date(), actorName);
  });
}
