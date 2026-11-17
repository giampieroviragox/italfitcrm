import {
  requireAccess,
  checkOrigin,
  errorResponse,
  HttpError,
  readJsonInput,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { studentProjection } from "@/modules/crm/student-portal-model";
import { todayRome } from "@/modules/crm/fitness-logic";
import { prepareTransition } from "@/modules/crm/transition";
import { studentAccess } from "@/modules/crm/tier-access";
import { applyMaxCommand, maxCommand } from "@/modules/crm/workout-log";

/** Students record and remove their own maxes (1RM, 3RM, 5RM). */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess();
    if (access.role !== "student")
      throw new HttpError(
        403,
        "I massimali vengono registrati dall’account studente.",
      );
    const command = maxCommand.safeParse(
      (await readJsonInput(request)).command,
    );
    if (!command.success)
      throw new HttpError(400, "Controlla esercizio, carico e data.");
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await readCrm(user.id);
      const student = current.state.students.find(
        (s) => s.id === access.record_id,
      );
      let next;
      try {
        if (!student || !studentAccess(current.state, student).plans)
          throw new Error("Il tuo accesso non include i piani.");
        next = prepareTransition(
          current.state,
          applyMaxCommand(
            current.state,
            access.record_id,
            command.data,
            todayRome(),
          ),
          { id: student.id, name: `${student.firstName} ${student.lastName}` },
        );
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
      }
      try {
        const saved = await writeCrm(user.id, current.revision, next);
        return Response.json(studentProjection(saved.state, access.record_id), {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (e) {
        if (e instanceof HttpError && e.status === 409 && attempt < 2) continue;
        throw e;
      }
    }
    throw new HttpError(409, "Dati aggiornati altrove. Riprova.");
  } catch (e) {
    return errorResponse(e);
  }
}
