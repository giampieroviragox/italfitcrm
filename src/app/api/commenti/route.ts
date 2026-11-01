import {
  requireAccess,
  checkOrigin,
  readJsonInput,
  errorResponse,
  HttpError,
} from "@/modules/crm/server/auth";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { validateStaffUpdate } from "@/modules/crm/server/validation";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user, access } = await requireAccess(true);
    const input = await readJsonInput(request, 40_000);
    if (
      typeof input.studentId !== "string" ||
      typeof input.text !== "string" ||
      !input.text.trim() ||
      input.text.trim().length > 5000
    )
      throw new HttpError(400, "Inserisci un commento tra 1 e 5000 caratteri.");
    const text = input.text.trim();
    // Append to the latest saved state, so concurrent comments never overwrite each other.
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await readCrm(user.id);
      if (!current.state.students.some((s) => s.id === input.studentId))
        throw new HttpError(404, "Studente non trovato.");
      const next = validateStaffUpdate(
        current.state,
        {
          ...current.state,
          students: current.state.students.map((s) =>
            s.id === input.studentId
              ? {
                  ...s,
                  notes: [
                    ...(s.notes ?? []),
                    {
                      id: crypto.randomUUID(),
                      text,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : s,
          ),
        },
        access,
      );
      try {
        const saved = await writeCrm(user.id, current.revision, next);
        return Response.json(saved, {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (error) {
        if (error instanceof HttpError && error.status === 409 && attempt < 2)
          continue;
        throw error;
      }
    }
    throw new HttpError(409, "La scheda è cambiata. Riprova.");
  } catch (error) {
    return errorResponse(error);
  }
}
