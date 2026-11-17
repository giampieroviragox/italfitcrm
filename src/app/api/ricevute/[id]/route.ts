import {
  errorResponse,
  HttpError,
  requireAccess,
} from "@/modules/crm/server/auth";
import { readCrm } from "@/modules/crm/server/repository";
import { downloadReceipt } from "@/modules/crm/server/receipt-storage";
import { staffScope } from "@/modules/crm/permissions";

/** Serves a receipt to its student or to staff; never through a public URL. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/ricevute/[id]">,
) {
  try {
    const { id } = await ctx.params;
    const {
      access,
      preloaded: { state },
    } = await requireAccess(false, readCrm);
    const students =
      access.role === "student"
        ? state.students.filter((s) => s.id === access.record_id)
        : state.students;
    const lesson = students
      .flatMap((s) => s.lessonWallet?.receipts ?? [])
      .find((r) => r.id === id);
    const online = students
      .flatMap((s) => s.onlineReceipts ?? [])
      .find((r) => r.id === id);
    const receipt = lesson ?? online;
    if (access.role !== "student") {
      const scope = staffScope(state, access.record_id);
      const allowed = lesson
        ? scope.can("payments")
        : scope.can("coaching") || scope.can("accounting.online");
      if (receipt && !allowed)
        throw new HttpError(403, "Il tuo ruolo non include questi pagamenti.");
    }
    if (!receipt?.file) throw new HttpError(404, "Ricevuta non disponibile.");
    const data = await downloadReceipt(receipt.file.path);
    return new Response(data, {
      headers: {
        "Content-Type": receipt.file.type,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(receipt.file.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
