import { staffCommand, parsed } from "@/modules/crm/server/commands";
import { HttpError } from "@/modules/crm/server/errors";
import { applyWalletCommand, walletCommand } from "@/modules/crm/lesson-wallet";
import { requirePermission, requireStudent } from "@/modules/crm/permissions";

/** Lesson wallet: packs, payments, receipts, recorded lessons and settlements. */
export function POST(request: Request) {
  return staffCommand(
    request,
    (state, input, actorName, scope) => {
      const command = parsed(
        walletCommand.safeParse(input.command),
        "Controlla i dati del wallet.",
      );
      try {
        // Closing a lesson belongs to the calendar; the rest is money.
        requirePermission(
          scope,
          command.action === "settle" ? "lessons" : "payments",
        );
        if (command.action !== "settle")
          requireStudent(scope, command.studentId);
      } catch (e) {
        throw new HttpError(403, (e as Error).message);
      }
      return applyWalletCommand(state, command, new Date(), actorName);
    },
    { maxLength: 100_000 },
  );
}
