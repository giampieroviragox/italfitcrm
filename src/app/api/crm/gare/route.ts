import { staffCommand, parsed } from "@/modules/crm/server/commands";
import { HttpError } from "@/modules/crm/server/errors";
import { todayRome } from "@/modules/crm/fitness-logic";
import { applyRaceCommand, raceCommand } from "@/modules/crm/cycle-feedback";

/** Staff manage a student's races from the profile. */
export function POST(request: Request) {
  return staffCommand(request, (state, input, actorName) => {
    if (typeof input.studentId !== "string")
      throw new HttpError(400, "Studente non valido.");
    return applyRaceCommand(
      state,
      input.studentId,
      parsed(
        raceCommand.safeParse(input.command),
        "Controlla nome, data e luogo della gara.",
      ),
      todayRome(),
      new Date(),
      actorName,
    );
  });
}
