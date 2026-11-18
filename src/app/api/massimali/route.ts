import { studentCommand, parsed } from "@/modules/crm/server/commands";
import { todayRome } from "@/modules/crm/fitness-logic";
import { applyMaxCommand, maxCommand } from "@/modules/crm/workout-log";

/** Students record and remove their own maxes (1RM, 3RM, 5RM). */
export function POST(request: Request) {
  return studentCommand(request, (state, studentId, input) =>
    applyMaxCommand(
      state,
      studentId,
      parsed(
        maxCommand.safeParse(input.command),
        "Controlla esercizio, carico e data.",
      ),
      todayRome(),
    ),
  );
}
