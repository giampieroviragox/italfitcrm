"use client";

import { useRef, useState, type FormEvent } from "react";
import { FileText, Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time-picker";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { todayRome } from "./fitness-logic";
import {
  maxReceiptBytes,
  paymentMethods,
  receiptFileTypes,
  receiptStatusLabels,
  type Receipt,
} from "./lesson-wallet";
import { euro } from "./money";
import type { CrmStudent } from "./model";
import { coachingOutstanding } from "./online-coaching";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import Link from "next/link";
import { updateLessonWallet, updateOnlineCoaching } from "./store";
import { Field, FormError, control } from "./ui";

const statusTone: Record<Receipt["status"], string> = {
  pending: "bg-amber-500/10 text-amber-900 dark:text-amber-200",
  approved: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  rejected: "bg-muted text-muted-foreground",
};
export function ReceiptStatus({ status }: { status: Receipt["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        statusTone[status],
      )}
    >
      {receiptStatusLabels[status]}
    </span>
  );
}
const toCents = (value: string) => {
  const n = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

/** Phone photos are resized to JPEG so they fit the upload limit. */
async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || file.size <= 1_500_000) return file;
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    return blob
      ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
          type: "image/jpeg",
        })
      : file;
  } catch {
    return file;
  }
}

/** Student form: amount, method, date, receipt and an optional note. */
export function ReceiptForm({
  outstanding,
  onSubmit,
}: {
  outstanding: number;
  /** Returns an error message, or "" when sent. */
  onSubmit: (form: FormData) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<keyof typeof paymentMethods>("paypal");
  const [paidOn, setPaidOn] = useState(todayRome());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const reset = () => {
    setOpen(false);
    setAmount("");
    setNote("");
    setFile(null);
    setError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cents = toCents(amount);
    if (!Number.isInteger(cents) || cents <= 0)
      return setError("Inserisci l’importo pagato.");
    if (cents > outstanding)
      return setError(
        `L’importo supera quanto da saldare (${euro(outstanding)}).`,
      );
    if (method !== "contanti" && !file)
      return setError("Allega la ricevuta o lo screenshot del pagamento.");
    setPending(true);
    setError("");
    try {
      const ready = file ? await prepareFile(file) : null;
      if (ready && ready.size > maxReceiptBytes)
        return setError("Il file è troppo grande: massimo 4 MB.");
      const form = new FormData();
      form.set("amount", String(cents));
      form.set("method", method);
      form.set("paidOn", paidOn);
      form.set("note", note);
      if (ready) form.set("file", ready);
      const failure = await onSubmit(form);
      if (failure) setError(failure);
      else {
        setSent(`Pagamento di ${euro(cents)} inviato: il team lo verificherà.`);
        reset();
      }
    } finally {
      setPending(false);
    }
  };
  if (!open)
    return (
      <div className="space-y-2">
        {sent && (
          <p
            role="status"
            className="rounded-[10px] bg-emerald-500/10 px-3 py-2.5 text-[13px] text-emerald-900 dark:text-emerald-300"
          >
            {sent}
          </p>
        )}
        <Button
          variant="outline"
          className="w-full rounded-full sm:w-auto"
          disabled={!outstanding}
          onClick={() => {
            setSent("");
            setOpen(true);
          }}
        >
          <Upload className="size-4" />
          Ho fatto un pagamento
        </Button>
      </div>
    );
  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border bg-card p-4"
      aria-busy={pending}
    >
      <div>
        <h3 className="font-semibold">Registra un pagamento</h3>
        <p className="text-sm text-muted-foreground">
          Da saldare: {euro(outstanding)}. Il team verifica la ricevuta e
          aggiorna il saldo.
        </p>
      </div>
      <fieldset disabled={pending} className="space-y-4">
        <div
          role="radiogroup"
          aria-label="Metodo di pagamento"
          className="grid grid-cols-3 gap-2"
        >
          {(Object.keys(paymentMethods) as (keyof typeof paymentMethods)[]).map(
            (m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  method === m
                    ? "border-primary bg-primary/15"
                    : "hover:bg-muted",
                )}
              >
                {paymentMethods[m]}
              </button>
            ),
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Importo (€)">
            <input
              required
              inputMode="decimal"
              className={`${control} text-base tabular-nums sm:text-sm`}
              placeholder={String(outstanding / 100).replace(".", ",")}
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^\d.,]/g, ""))
              }
            />
          </Field>
          <Field label="Data del pagamento">
            <DatePicker
              required
              max={todayRome()}
              value={paidOn}
              onChange={setPaidOn}
            />
          </Field>
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">
            Ricevuta o screenshot{method === "contanti" ? " (facoltativa)" : ""}
          </span>
          <input
            ref={input}
            type="file"
            accept={Object.keys(receiptFileTypes).join(",")}
            className="sr-only"
            aria-label="Allega ricevuta"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed px-4 text-left text-sm transition-colors hover:bg-muted"
          >
            <Paperclip
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="min-w-0 truncate">
              {file ? file.name : "Scegli una foto, uno screenshot o un PDF"}
            </span>
          </button>
        </div>
        <Field label="Nota (facoltativa)">
          <input
            maxLength={500}
            className={`${control} text-base sm:text-sm`}
            placeholder="Es. seconda tranche di novembre"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="submit" className="rounded-full">
            {pending ? "Invio…" : "Invia al team"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={reset}
          >
            Annulla
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function ReviewActions({
  studentId,
  receipt,
  outstanding,
  kind,
}: {
  studentId: string;
  receipt: Receipt;
  outstanding: number;
  kind: "lessons" | "coaching";
}) {
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [amount, setAmount] = useState(
    String(Math.min(receipt.amount, outstanding) / 100).replace(".", ","),
  );
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    const cents = toCents(amount);
    if (mode === "approve" && (!Number.isInteger(cents) || cents <= 0))
      return setError("Inserisci l’importo ricevuto.");
    setPending(true);
    setError("");
    try {
      const review = {
        action: "review" as const,
        studentId,
        receiptId: receipt.id,
        decision:
          mode === "approve" ? ("approve" as const) : ("reject" as const),
        ...(mode === "approve" ? { amount: cents } : {}),
        ...(mode === "reject" && reason.trim()
          ? { reason: reason.trim() }
          : {}),
      };
      await (kind === "coaching"
        ? updateOnlineCoaching(review)
        : updateLessonWallet(review));
      setMode(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  if (!mode)
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setMode("approve")}>
          Approva
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode("reject")}>
          Rifiuta
        </Button>
      </div>
    );
  return (
    <div className="w-full space-y-2 rounded-xl bg-muted p-3">
      {mode === "approve" ? (
        <Field
          label="Importo ricevuto (€)"
          hint={`Dichiarato ${euro(receipt.amount)} · da saldare ${euro(outstanding)}. Viene applicato alle voci aperte, dalla più vecchia.`}
        >
          <input
            inputMode="decimal"
            className={`${control} tabular-nums`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          />
        </Field>
      ) : (
        <Field label="Motivo (facoltativo, visibile allo studente)">
          <input
            maxLength={500}
            className={control}
            placeholder="Es. importo non leggibile, invia di nuovo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      )}
      <FormError message={error} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => void run()}>
          {pending
            ? "Salvataggio…"
            : mode === "approve"
              ? "Conferma incasso"
              : "Conferma rifiuto"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setMode(null)}
        >
          Annulla
        </Button>
      </div>
    </div>
  );
}

/** Declared payments; staff can open receipts and approve or reject. */
export function ReceiptList({
  receipts,
  staff,
}: {
  receipts: Receipt[];
  staff?: {
    studentId: string;
    outstanding: number;
    /** Lesson wallet receipts (default) or online coaching ones. */
    kind?: "lessons" | "coaching";
  };
}) {
  const sorted = receipts.toSorted(
    (a, b) =>
      Number(b.status === "pending") - Number(a.status === "pending") ||
      b.submittedAt.localeCompare(a.submittedAt),
  );
  if (!sorted.length) return null;
  return (
    <ul className="divide-y rounded-xl border">
      {sorted.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="flex flex-wrap items-center gap-2 font-medium tabular-nums">
              {euro(r.amount)} · {paymentMethods[r.method]}
              <ReceiptStatus status={r.status} />
            </p>
            <p className="text-muted-foreground">
              Pagato il {formatDate(r.paidOn)} · inviato il{" "}
              {formatDate(r.submittedAt.slice(0, 10))}
            </p>
            {r.note && <p className="text-muted-foreground">“{r.note}”</p>}
            {r.status === "approved" && r.approvedAmount !== r.amount && (
              <p className="text-muted-foreground">
                Importo approvato: {euro(r.approvedAmount ?? 0)}
              </p>
            )}
            {r.status === "rejected" && r.rejectionReason && (
              <p className="text-muted-foreground">
                Motivo: {r.rejectionReason}
              </p>
            )}
            {r.reviewedBy && (
              <p className="text-xs text-muted-foreground">
                Verificato da {r.reviewedBy}
              </p>
            )}
            {r.file && (
              <a
                href={`/api/ricevute/${encodeURIComponent(r.id)}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
              >
                <FileText className="size-3.5" aria-hidden />
                Apri la ricevuta
              </a>
            )}
          </div>
          {staff && r.status === "pending" && (
            <ReviewActions
              studentId={staff.studentId}
              receipt={r}
              outstanding={staff.outstanding}
              kind={staff.kind ?? "lessons"}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Online coaching receipts waiting for review, grouped by student. */
export function OnlineReceiptsQueue({
  students,
  title = "Coaching online · da verificare",
}: {
  students: CrmStudent[];
  title?: string;
}) {
  const waiting = students.filter((s) =>
    s.onlineReceipts?.some((r) => r.status === "pending"),
  );
  if (!waiting.length) return null;
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {waiting.map((student) => (
        <div
          key={student.id}
          className="space-y-2 rounded-2xl border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StudentIdentity student={student} />
            <Link
              href={`/admin/studenti/${encodeURIComponent(student.id)}?tab=coaching`}
              className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Da saldare {euro(coachingOutstanding(student))} · apri la scheda
            </Link>
          </div>
          <ReceiptList
            receipts={(student.onlineReceipts ?? []).filter(
              (r) => r.status === "pending",
            )}
            staff={{
              studentId: student.id,
              outstanding: coachingOutstanding(student),
              kind: "coaching",
            }}
          />
        </div>
      ))}
    </section>
  );
}
