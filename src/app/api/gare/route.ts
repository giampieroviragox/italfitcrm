import { studentCommand, parsed } from "@/modules/crm/server/commands";
import { todayRome } from "@/modules/crm/fitness-logic";
import { applyRaceCommand, raceCommand } from "@/modules/crm/cycle-feedback";

/** Students add, edit and remove their own races. */
export function POST(request: Request) {
  return studentCommand(request, (state, studentId, input) =>
    applyRaceCommand(
      state,
      studentId,
      parsed(
        raceCommand.safeParse(input.command),
        "Controlla nome, data e luogo della gara.",
      ),
      todayRome(),
    ),
  );
}
