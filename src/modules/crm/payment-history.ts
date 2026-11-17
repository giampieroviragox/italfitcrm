import { csvCell } from "./csv.ts";
import {
  emptyWallet,
  outstandingAmount,
  paidAmount,
  paymentMethods,
} from "./lesson-wallet.ts";
import type { CrmStudent } from "./model.ts";

/** One collected payment or reviewed receipt, as shown in the payment history. */
export interface PaymentRow {
  key: string;
  /** When it was collected or reviewed (ISO). */
  date: string;
  studentId: string;
  studentName: string;
  amount: number;
  kind: "registered" | "approved" | "rejected";
  method?: keyof typeof paymentMethods;
  paidOn?: string;
  /** Items paid, or the rejection reason. */
  details: string[];
  receiptId?: string;
  hasFile: boolean;
}
export const paymentKindLabels = {
  registered: "Registrato dal team",
  approved: "Ricevuta approvata",
  rejected: "Ricevuta rifiutata",
} as const;

const romeDay = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(iso),
  );
const shortDate = (day: string) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    useGrouping: "always",
  }).format(cents / 100);

/** Every collected payment and reviewed receipt, newest first. */
export function paymentHistory(students: CrmStudent[]): PaymentRow[] {
  return students
    .flatMap((student) => {
      const wallet = student.lessonWallet;
      if (!wallet) return [];
      const studentName = `${student.firstName} ${student.lastName}`.trim();
      const items = [
        ...wallet.credits.map((c) => ({ name: c.name, payments: c.payments })),
        ...wallet.lessons.map((l) => ({
          name: `${l.title} · ${shortDate(romeDay(l.startsAt))}`,
          payments: l.payments,
        })),
      ];
      const registered: PaymentRow[] = items.flatMap((item) =>
        item.payments
          .filter((p) => !p.receiptId)
          .map((p, i) => ({
            key: `${student.id}:${item.name}:${p.date}:${i}`,
            date: p.date,
            studentId: student.id,
            studentName,
            amount: p.amount,
            kind: "registered" as const,
            details: [item.name],
            hasFile: false,
          })),
      );
      const reviewed: PaymentRow[] = (wallet.receipts ?? [])
        .filter((r) => r.status !== "pending")
        .map((r) => ({
          key: r.id,
          date: r.reviewedAt ?? r.submittedAt,
          studentId: student.id,
          studentName,
          amount:
            r.status === "approved" ? (r.approvedAmount ?? r.amount) : r.amount,
          kind: r.status === "approved" ? "approved" : "rejected",
          method: r.method,
          paidOn: r.paidOn,
          details:
            r.status === "approved"
              ? items.flatMap((item) =>
                  item.payments
                    .filter((p) => p.receiptId === r.id)
                    .map((p) => `${item.name}: ${euro(p.amount)}`),
                )
              : r.rejectionReason
                ? [`Motivo: ${r.rejectionReason}`]
                : [],
          receiptId: r.id,
          hasFile: Boolean(r.file),
        }));
      return [...registered, ...reviewed];
    })
    .toSorted((a, b) => b.date.localeCompare(a.date));
}

export interface PaymentFilters {
  studentId?: string;
  kind?: PaymentRow["kind"];
  method?: keyof typeof paymentMethods;
  /** "AAAA-MM", on the collection or review date in Europe/Rome. */
  month?: string;
}
export function filterPayments(rows: PaymentRow[], f: PaymentFilters) {
  return rows.filter(
    (r) =>
      (!f.studentId || r.studentId === f.studentId) &&
      (!f.kind || r.kind === f.kind) &&
      (!f.method || r.method === f.method) &&
      (!f.month || romeDay(r.date).startsWith(f.month)),
  );
}
export const paymentMonths = (rows: PaymentRow[]) =>
  [...new Set(rows.map((r) => romeDay(r.date).slice(0, 7)))].toSorted((a, b) =>
    b.localeCompare(a),
  );
/** Collected total: registered payments and approved receipts. */
export const collectedTotal = (rows: PaymentRow[]) =>
  rows.filter((r) => r.kind !== "rejected").reduce((s, r) => s + r.amount, 0);

export interface BalanceRow {
  studentId: string;
  studentName: string;
  total: number;
  paid: number;
  open: number;
  waiting: number;
}
export function balances(students: CrmStudent[]): BalanceRow[] {
  return students
    .filter(
      (s) =>
        s.lessonWallet &&
        (!s.archived || outstandingAmount(s.lessonWallet) > 0),
    )
    .map((student) => {
      const wallet = student.lessonWallet ?? emptyWallet;
      const items = [...wallet.credits, ...wallet.lessons];
      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        total: items.reduce((sum, i) => sum + i.price, 0),
        paid: items.reduce((sum, i) => sum + paidAmount(i), 0),
        open: outstandingAmount(wallet),
        waiting: (wallet.receipts ?? [])
          .filter((r) => r.status === "pending")
          .reduce((sum, r) => sum + r.amount, 0),
      };
    })
    .toSorted((a, b) => b.open - a.open);
}

const amount = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const table = (rows: (string | number)[][]) =>
  "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
export function paymentsCsv(rows: PaymentRow[]) {
  return table([
    [
      "Data",
      "Studente",
      "Tipo",
      "Metodo",
      "Pagato il",
      "Importo (€)",
      "Dettagli",
    ],
    ...rows.map((r) => [
      romeDay(r.date),
      r.studentName,
      paymentKindLabels[r.kind],
      r.method ? paymentMethods[r.method] : "",
      r.paidOn ?? "",
      amount(r.amount),
      r.details.join(" | "),
    ]),
  ]);
}
export function balancesCsv(rows: BalanceRow[]) {
  return table([
    [
      "Studente",
      "Dovuto (€)",
      "Pagato (€)",
      "Da saldare (€)",
      "In verifica (€)",
    ],
    ...rows.map((r) => [
      r.studentName,
      amount(r.total),
      amount(r.paid),
      amount(r.open),
      amount(r.waiting),
    ]),
  ]);
}
