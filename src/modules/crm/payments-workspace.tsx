"use client";

import Link from "next/link";
import { useState } from "react";
import { Receipt as ReceiptIcon } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { PageTabs } from "@/components/ui/page-tabs";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import {
  emptyWallet,
  outstandingAmount,
  paidAmount,
  paymentMethods,
} from "./lesson-wallet";
import { formatDate } from "@/lib/format";
import { normalize } from "./model";
import { control } from "./ui";
import { ReceiptStatus } from "./receipts-view";
import { euro } from "./money";
import { ReceiptList } from "./receipts-view";
import { useCrm, useHydrated } from "./store";
import { LocalNotice } from "./ui";
import type { CrmStudent } from "./model";

export function pendingReceipts(students: CrmStudent[]) {
  return students.flatMap((s) =>
    (s.lessonWallet?.receipts ?? [])
      .filter((r) => r.status === "pending")
      .map((receipt) => ({ student: s, receipt })),
  );
}

/** Receipts waiting for review and each student's balance. */
export function PaymentsWorkspace() {
  const state = useCrm();
  const hydrated = useHydrated();
  const [onlyOpen, setOnlyOpen] = useState("open");
  const [tab, setTab] = useState("pending");
  if (!hydrated)
    return (
      <p role="status" className="py-12 text-sm text-muted-foreground">
        Caricamento…
      </p>
    );
  const pending = pendingReceipts(state.students);
  const byStudent = new Map<string, typeof pending>();
  for (const item of pending)
    byStudent.set(item.student.id, [
      ...(byStudent.get(item.student.id) ?? []),
      item,
    ]);
  const balances = state.students
    .filter(
      (s) =>
        s.lessonWallet &&
        (!s.archived || outstandingAmount(s.lessonWallet) > 0),
    )
    .map((student) => {
      const wallet = student.lessonWallet ?? emptyWallet;
      const items = [...wallet.credits, ...wallet.lessons];
      return {
        student,
        total: items.reduce((sum, i) => sum + i.price, 0),
        paid: items.reduce((sum, i) => sum + paidAmount(i), 0),
        open: outstandingAmount(wallet),
        waiting: (wallet.receipts ?? [])
          .filter((r) => r.status === "pending")
          .reduce((sum, r) => sum + r.amount, 0),
      };
    })
    .filter((b) => onlyOpen === "all" || b.open > 0)
    .toSorted((a, b) => b.open - a.open);
  const totalOpen = balances.reduce((sum, b) => sum + b.open, 0);
  return (
    <>
      <PageHeading
        title="Pagamenti"
        description="Verifica i pagamenti dichiarati dagli studenti e controlla quanto resta da saldare."
      />
      <LocalNotice />
      <PageTabs
        label="Sezioni dei pagamenti"
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pending", label: "Da verificare", count: pending.length },
          { value: "history", label: "Storico" },
          { value: "balances", label: "Saldi studenti" },
        ]}
      />
      {tab === "pending" && (
        <section aria-labelledby="pending-title" className="space-y-3">
          <h2 id="pending-title" className="text-lg font-semibold">
            Da verificare{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {pending.length}
            </span>
          </h2>
          {pending.length ? (
            <div className="space-y-4">
              {[...byStudent.values()].map((items) => {
                const student = items[0]!.student;
                return (
                  <div
                    key={student.id}
                    className="space-y-2 rounded-2xl border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <StudentIdentity student={student} />
                      <Link
                        href={`/admin/studenti/${encodeURIComponent(student.id)}?tab=wallet`}
                        className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                      >
                        Da saldare{" "}
                        {euro(
                          outstandingAmount(
                            student.lessonWallet ?? emptyWallet,
                          ),
                        )}{" "}
                        · apri wallet
                      </Link>
                    </div>
                    <ReceiptList
                      receipts={items.map((i) => i.receipt)}
                      staff={{
                        studentId: student.id,
                        outstanding: outstandingAmount(
                          student.lessonWallet ?? emptyWallet,
                        ),
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border bg-card px-6 py-10 text-center">
              <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-[var(--workspace-accent)]">
                <ReceiptIcon className="size-5" strokeWidth={1.75} />
              </span>
              <p className="text-sm text-muted-foreground">
                Nessun pagamento da verificare.
              </p>
            </div>
          )}
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
                Lezioni e pacchetti del wallet. Totale da saldare:{" "}
                {euro(totalOpen)}.
              </p>
            </div>
            <PageTabs
              label="Saldi da mostrare"
              value={onlyOpen}
              onChange={setOnlyOpen}
              tabs={[
                { value: "open", label: "Da saldare" },
                { value: "all", label: "Tutti" },
              ]}
            />
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
                    <tr key={b.student.id} className="hover:bg-subtle">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/studenti/${encodeURIComponent(b.student.id)}?tab=wallet`}
                          className="font-medium hover:underline"
                        >
                          {b.student.firstName} {b.student.lastName}
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
      {tab === "history" && <PaymentHistory students={state.students} />}
    </>
  );
}

type HistoryRow = {
  key: string;
  date: string;
  student: CrmStudent;
  amount: number;
  label: string;
  details: string[];
  status: "approved" | "rejected" | "registered";
  receiptId?: string;
  hasFile: boolean;
};
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(iso),
  );

/** Every collected payment and reviewed receipt, newest first. */
export function paymentHistory(students: CrmStudent[]): HistoryRow[] {
  return students
    .flatMap((student) => {
      const wallet = student.lessonWallet;
      if (!wallet) return [];
      const items = [
        ...wallet.credits.map((c) => ({ name: c.name, payments: c.payments })),
        ...wallet.lessons.map((l) => ({
          name: `${l.title} · ${formatDate(dayOf(l.startsAt))}`,
          payments: l.payments,
        })),
      ];
      const registered: HistoryRow[] = items.flatMap((item) =>
        item.payments
          .filter((p) => !p.receiptId)
          .map((p, i) => ({
            key: `${student.id}:${item.name}:${p.date}:${i}`,
            date: p.date,
            student,
            amount: p.amount,
            label: "Registrato dal team",
            details: [item.name],
            status: "registered" as const,
            hasFile: false,
          })),
      );
      const reviewed: HistoryRow[] = (wallet.receipts ?? [])
        .filter((r) => r.status !== "pending")
        .map((r) => ({
          key: r.id,
          date: r.reviewedAt ?? r.submittedAt,
          student,
          amount:
            r.status === "approved" ? (r.approvedAmount ?? r.amount) : r.amount,
          label: `${paymentMethods[r.method]} · pagato il ${formatDate(r.paidOn)}`,
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
          status: r.status as "approved" | "rejected",
          receiptId: r.id,
          hasFile: Boolean(r.file),
        }));
      return [...registered, ...reviewed];
    })
    .toSorted((a, b) => b.date.localeCompare(a.date));
}

function PaymentHistory({ students }: { students: CrmStudent[] }) {
  const [query, setQuery] = useState("");
  const q = normalize(query);
  const rows = paymentHistory(students).filter(
    (r) =>
      !q ||
      normalize(`${r.student.firstName} ${r.student.lastName}`).includes(q),
  );
  const collected = rows
    .filter((r) => r.status !== "rejected")
    .reduce((sum, r) => sum + r.amount, 0);
  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="history-title" className="text-lg font-semibold">
            Storico pagamenti
          </h2>
          <p className="text-sm text-muted-foreground">
            Incassi registrati dal team e ricevute verificate. Incassato:{" "}
            {euro(collected)}.
          </p>
        </div>
        <input
          aria-label="Cerca uno studente"
          placeholder="Cerca uno studente…"
          className={`${control} w-full rounded-xl sm:w-64`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {rows.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">
                  <Link
                    href={`/admin/studenti/${encodeURIComponent(r.student.id)}?tab=wallet`}
                    className="hover:underline"
                  >
                    {r.student.firstName} {r.student.lastName}
                  </Link>{" "}
                  <span className="text-muted-foreground">· {r.label}</span>
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
                  className={`font-semibold tabular-nums ${r.status === "rejected" ? "text-muted-foreground line-through" : ""}`}
                >
                  {euro(r.amount)}
                </span>
                {r.status === "registered" ? (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(dayOf(r.date))}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ReceiptStatus status={r.status} />
                    {formatDate(dayOf(r.date))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nessun pagamento registrato.
        </p>
      )}
    </section>
  );
}
