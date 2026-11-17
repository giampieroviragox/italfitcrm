import { studentCommand, parsed } from "@/modules/crm/server/commands";
import { todayRome } from "@/modules/crm/fitness-logic";
import { applyFeedback, feedbackCommand } from "@/modules/crm/cycle-feedback";

/** End-of-plan questionnaire, saved together with race changes. */
export function POST(request: Request) {
  return studentCommand(request, (state, studentId, input) =>
    applyFeedback(
      state,
      studentId,
      parsed(
        feedbackCommand.safeParse(input.command),
        "Controlla le risposte del questionario.",
      ),
      todayRome(),
    ),
  );
}
