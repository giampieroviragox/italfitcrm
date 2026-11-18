import {
  checkOrigin,
  errorResponse,
  HttpError,
  requireAccess,
} from "@/modules/crm/server/auth";
import {
  readStudentScopeForUser,
  writeCrm,
} from "@/modules/crm/server/repository";
import { adjustOccupancy } from "@/modules/crm/sync";
import {
  receiptType,
  removeReceipt,
  uploadReceipt,
} from "@/modules/crm/server/receipt-storage";
import { studentProjection } from "@/modules/crm/student-portal-model";
import { todayRome } from "@/modules/crm/fitness-logic";
import { prepareTransition } from "@/modules/crm/transition";
import { submitOnlineReceipt } from "@/modules/crm/online-coaching";
import {
  receiptFileTypes,
  receiptInput,
  submitReceipt,
  type Receipt,
} from "@/modules/crm/lesson-wallet";

/** A student declares a payment made outside the CRM, with its receipt. */
export async function POST(request: Request) {
  let uploaded: string | undefined;
  try {
    checkOrigin(request);
    const { user, access, preloaded } = await requireAccess(
      false,
      readStudentScopeForUser,
    );
    if (access.role !== "student" || !preloaded)
      throw new HttpError(
        403,
        "I pagamenti vengono dichiarati dallo studente.",
      );
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "Richiesta non valida.");
    }
    const input = receiptInput.safeParse({
      amount: Number(form.get("amount")),
      method: form.get("method"),
      paidOn: form.get("paidOn"),
      note: String(form.get("note") ?? ""),
    });
    if (!input.success)
      throw new HttpError(
        400,
        "Controlla importo, metodo e data del pagamento.",
      );
    // "coaching" for online coaching subscriptions, otherwise lessons.
    const coaching = form.get("scope") === "coaching";
    const upload = form.get("file");
    const file = upload instanceof File && upload.size > 0 ? upload : undefined;
    const id = crypto.randomUUID();
    let meta: Receipt["file"];
    if (file) {
      const type = await receiptType(file);
      meta = {
        path: `${access.record_id}/${id}.${receiptFileTypes[type]}`,
        name: file.name.slice(0, 200) || `ricevuta.${receiptFileTypes[type]}`,
        type,
        size: file.size,
      };
    }
    const apply = (state: Parameters<typeof submitReceipt>[0]) => {
      const student = state.students.find((s) => s.id === access.record_id);
      if (!student) throw new Error("Studente non disponibile.");
      return prepareTransition(
        state,
        (coaching ? submitOnlineReceipt : submitReceipt)(
          state,
          student.id,
          input.data,
          meta,
          todayRome(),
          new Date(),
          id,
        ),
        { id: student.id, name: `${student.firstName} ${student.lastName}` },
      );
    };
    // Validate before storing the file, so rejected requests leave nothing behind.
    try {
      apply(preloaded.state);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    if (file && meta) {
      await uploadReceipt(meta.path, file, meta.type);
      uploaded = meta.path;
    }
    let current = preloaded;
    for (let attempt = 0; attempt < 3; attempt++) {
      let next;
      try {
        next = apply(current.state);
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
      }
      try {
        const saved = await writeCrm(user.id, current, next);
        uploaded = undefined;
        return Response.json(
          studentProjection(
            saved.state,
            access.record_id,
            adjustOccupancy(
              current.occupancy,
              current.state,
              saved.state,
              access.record_id,
            ),
          ),
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch (e) {
        if (e instanceof HttpError && e.status === 409 && attempt < 2) {
          const fresh = await readStudentScopeForUser(user.id);
          if (fresh) current = fresh;
          continue;
        }
        throw e;
      }
    }
    throw new HttpError(409, "Dati aggiornati altrove. Riprova.");
  } catch (e) {
    if (uploaded) await removeReceipt(uploaded).catch(() => {});
    return errorResponse(e);
  }
}
