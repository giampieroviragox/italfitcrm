import { staffCommand, parsed } from "@/modules/crm/server/commands";
import { HttpError } from "@/modules/crm/server/errors";
import { todayRome } from "@/modules/crm/fitness-logic";
import { applyMaxCommand, maxCommand } from "@/modules/crm/workout-log";
import { seesStudent } from "@/modules/crm/permissions";

/** Staff record or remove a student's maxes (1RM, 3RM, 5RM). */
export function POST(request: Request) {
  return staffCommand(request, (state, input, actorName, scope) => {
    if (typeof input.studentId !== "string")
      throw new HttpError(400, "Studente non valido.");
    if (!seesStudent(scope, input.studentId))
      throw new HttpError(403, "Non segui questo studente.");
    return applyMaxCommand(
      state,
      input.studentId,
      parsed(
        maxCommand.safeParse(input.command),
        "Controlla esercizio, carico e data.",
      ),
      todayRome(),
      new Date(),
      actorName,
    );
  });
}
