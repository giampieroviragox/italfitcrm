"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Receipt as ReceiptIcon, X } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { PageTabs } from "@/components/ui/page-tabs";
import { SelectControl } from "@/components/ui/select-control";
import { formatDate, formatMonth } from "@/lib/format";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import {
  emptyWallet,
  outstandingAmount,
  paymentMethods,
} from "./lesson-wallet";
import { euro } from "./money";
import type { CrmStudent } from "./model";
import {
  balances as balanceRows,
  balancesCsv,
  collectedTotal,
  filterPayments,
  paymentHistory,
  paymentKindLabels,
  paymentMonths,
  paymentsCsv,
  type PaymentFilters,
  type PaymentRow,
} from "./payment-history";
import { ReceiptList, ReceiptStatus } from "./receipts-view";
import { useCrm, useHydrated } from "./store";
import { LocalNotice, control } from "./ui";

export function pendingReceipts(students: CrmStudent[]) {
  return students.flatMap((s) =>
    (s.lessonWallet?.receipts ?? [])
      .filter((r) => r.status === "pending")
      .map((receipt) => ({ student: s, receipt })),
  );
}

export function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(iso),
  );

/** Collected payments and reviewed receipts; used on the page and the profile. */
export function PaymentHistoryList({
  rows,
  showStudent = true,
}: {
  rows: PaymentRow[];
  showStudent?: boolean;
}) {
  if (!rows.length)
    return (
      <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Nessun pagamento con questi filtri.
      </p>
    );
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {rows.map((r) => (
        <li
          key={r.key}
          className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium">
              {showStudent && (
                <>
                  <Link
                    href={`/admin/studenti/${encodeURIComponent(r.studentId)}?tab=payments`}
                    className="hover:underline"
                  >
                    {r.studentName}
                  </Link>{" "}
                  ·{" "}
                </>
              )}
              <span className={showStudent ? "text-muted-foreground" : ""}>
                {r.kind === "registered"
                  ? paymentKindLabels.registered
                  : `${paymentMethods[r.method!]} · pagato il ${formatDate(r.paidOn!)}`}
              </span>
            </p>
            {r.details.map((d) => (
              <p key={d} className="text-muted-foreground">
                {d}
              </p>
            ))}
            {r.receiptId && r.hasFile && (
              <a
                href={`/api/ricevute/${encodeURIComponent(r.receiptId)}`}
                target="_blank"
                rel="noopener"
                className="underline underline-offset-4"
              >
                Apri la ricevuta
              </a>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`font-semibold tabular-nums ${r.kind === "rejected" ? "text-muted-foreground line-through" : ""}`}
            >
              {euro(r.amount)}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.kind !== "registered" && <ReceiptStatus status={r.kind} />}
              {formatDate(dayOf(r.date))}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Receipts to review, payment history and student balances, with filters. */
export function PaymentsWorkspace() {
  const state = useCrm();
  const hydrated = useHydrated();
  const [tab, setTab] = useState("pending");
  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState("");
  const [method, setMethod] = useState("");
  const [month, setMonth] = useState("");
  const [onlyOpen, setOnlyOpen] = useState("open");
  if (!hydrated)
    return (
      <p role="status" className="py-12 text-sm text-muted-foreground">
        Caricamento…
      </p>
    );
  const withWallet = state.students
    .filter((s) => s.lessonWallet)
    .toSorted((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
        "it",
      ),
    );
  const selected = state.students.filter(
    (s) => !studentId || s.id === studentId,
  );
  const pending = pendingReceipts(selected);
  const allPending = pendingReceipts(state.students).length;
  const history = paymentHistory(state.students);
  const filters: PaymentFilters = {
    ...(studentId ? { studentId } : {}),
    ...(kind ? { kind: kind as PaymentRow["kind"] } : {}),
    ...(method ? { method: method as keyof typeof paymentMethods } : {}),
    ...(month ? { month } : {}),
  };
  const rows = filterPayments(history, filters);
  const balances = balanceRows(selected).filter(
    (b) => onlyOpen === "all" || b.open > 0,
  );
  const byStudent = new Map<string, typeof pending>();
  for (const item of pending)
    byStudent.set(item.student.id, [
      ...(byStudent.get(item.student.id) ?? []),
      item,
    ]);
  const historyFiltered = Boolean(kind || method || month);
  return (
    <>
      <PageHeading
        title="Pagamenti"
        description="Verifica i pagamenti dichiarati dagli studenti, consulta lo storico e controlla quanto resta da saldare."
      />
      <LocalNotice />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PageTabs
          label="Sezioni dei pagamenti"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "pending", label: "Da verificare", count: allPending },
            { value: "history", label: "Storico", count: history.length },
            { value: "balances", label: "Saldi studenti" },
          ]}
        />
        <div className="flex w-full items-center gap-2 sm:w-72">
          <SelectControl
            aria-label="Filtra per studente"
            className={`${control} rounded-xl`}
            value={studentId || "all"}
            onChange={(e) =>
              setStudentId(e.target.value === "all" ? "" : e.target.value)
            }
          >
            <option value="all">Tutti gli studenti</option>
            {withWallet.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </SelectControl>
          {studentId && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mostra tutti gli studenti"
              onClick={() => setStudentId("")}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {tab === "pending" && (
        <section aria-label="Pagamenti da verificare" className="space-y-4">
          {pending.length ? (
            [...byStudent.values()].map((items) => {
              const student = items[0]!.student;
              const open = outstandingAmount(
                student.lessonWallet ?? emptyWallet,
              );
              return (
                <div
                  key={student.id}
                  className="space-y-2 rounded-2xl border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <StudentIdentity student={student} />
                    <Link
                      href={`/admin/studenti/${encodeURIComponent(student.id)}?tab=payments`}
                      className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      Da saldare {euro(open)} · apri la scheda
                    </Link>
                  </div>
                  <ReceiptList
                    receipts={items.map((i) => i.receipt)}
                    staff={{ studentId: student.id, outstanding: open }}
                  />
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border bg-card px-6 py-10 text-center">
              <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-[var(--workspace-accent)]">
                <ReceiptIcon className="size-5" strokeWidth={1.75} />
              </span>
              <p className="text-sm text-muted-foreground">
                {studentId
                  ? "Nessun pagamento da verificare per questo studente."
                  : "Nessun pagamento da verificare."}
              </p>
            </div>
          )}
        </section>
      )}

      {tab === "history" && (
        <section aria-labelledby="history-title" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="history-title" className="text-lg font-semibold">
                Storico pagamenti
              </h2>
              <p className="text-sm text-muted-foreground">
                {rows.length} {rows.length === 1 ? "movimento" : "movimenti"} ·
                incassato {euro(collectedTotal(rows))}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!rows.length}
              onClick={() =>
                downloadCsv(
                  `pagamenti-${month || "tutti"}.csv`,
                  paymentsCsv(rows),
                )
              }
            >
              <Download className="size-4" /> Esporta CSV
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <SelectControl
              aria-label="Filtra per tipo"
              className={`${control} rounded-xl`}
              value={kind || "all"}
              onChange={(e) =>
                setKind(e.target.value === "all" ? "" : e.target.value)
              }
            >
              <option value="all">Tutti i tipi</option>
              {Object.entries(paymentKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              aria-label="Filtra per metodo"
              className={`${control} rounded-xl`}
              value={method || "all"}
              onChange={(e) =>
                setMethod(e.target.value === "all" ? "" : e.target.value)
              }
            >
              <option value="all">Tutti i metodi</option>
              {Object.entries(paymentMethods).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              aria-label="Filtra per mese"
              className={`${control} rounded-xl`}
              value={month || "all"}
              onChange={(e) =>
                setMonth(e.target.value === "all" ? "" : e.target.value)
              }
            >
              <option value="all">Tutti i mesi</option>
              {paymentMonths(history).map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </SelectControl>
          </div>
          {historyFiltered && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                setKind("");
                setMethod("");
                setMonth("");
              }}
            >
              Azzera i filtri
            </button>
          )}
          <PaymentHistoryList rows={rows} showStudent={!studentId} />
        </section>
      )}

      {tab === "balances" && (
        <section aria-labelledby="balances-title" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="balances-title" className="text-lg font-semibold">
                Saldi studenti
              </h2>
              <p className="text-sm text-muted-foreground">
                Lezioni e pacchetti del wallet. Da saldare:{" "}
                {euro(balances.reduce((sum, b) => sum + b.open, 0))}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PageTabs
                label="Saldi da mostrare"
                value={onlyOpen}
                onChange={setOnlyOpen}
                tabs={[
                  { value: "open", label: "Da saldare" },
                  { value: "all", label: "Tutti" },
                ]}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!balances.length}
                onClick={() => downloadCsv("saldi.csv", balancesCsv(balances))}
              >
                <Download className="size-4" /> Esporta CSV
              </Button>
            </div>
          </div>
          {balances.length ? (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b bg-subtle text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Studente
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium"
                    >
                      Dovuto
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium"
                    >
                      Pagato
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium"
                    >
                      Da saldare
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium"
                    >
                      In verifica
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {balances.map((b) => (
                    <tr key={b.studentId} className="hover:bg-subtle">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/studenti/${encodeURIComponent(b.studentId)}?tab=payments`}
                          className="font-medium hover:underline"
                        >
                          {b.studentName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {euro(b.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {euro(b.paid)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${b.open ? "text-[var(--workspace-accent)]" : ""}`}
                      >
                        {euro(b.open)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {b.waiting ? euro(b.waiting) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {onlyOpen === "open"
                ? "Nessun saldo aperto."
                : "Nessun wallet registrato."}
            </p>
          )}
        </section>
      )}
    </>
  );
}
