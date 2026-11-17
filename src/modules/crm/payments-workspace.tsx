"use client";

import Link from "next/link";
import { useState } from "react";
import { Receipt as ReceiptIcon } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { PageTabs } from "@/components/ui/page-tabs";
import { StudentIdentity } from "@/modules/students/components/student-identity";
import { emptyWallet, outstandingAmount, paidAmount } from "./lesson-wallet";
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
      <section aria-labelledby="pending-title" className="mb-8 space-y-3">
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
                        outstandingAmount(student.lessonWallet ?? emptyWallet),
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
    </>
  );
}
