"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Download, Lock } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { PageTabs } from "@/components/ui/page-tabs";
import { SelectControl } from "@/components/ui/select-control";
import { formatDate, formatMonth } from "@/lib/format";
import {
  accountingMonths,
  compensations,
  lessonsMonth,
  onlineMonth,
  planRows,
} from "./accounting";
import { csvCell } from "./csv";
import { todayRome } from "./fitness-logic";
import { euro } from "./money";
import { downloadCsv } from "./payments-workspace";
import { useCan, useCrm, useHydrated, useViewer } from "./store";
import { LocalNotice, control } from "./ui";
import { OnlineReceiptsQueue } from "./receipts-view";

function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${accent ? "text-[var(--workspace-accent)]" : ""}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  if (!rows.length)
    return (
      <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="border-b bg-subtle text-left text-xs text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-4 py-2.5 font-medium ${i ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((cell, i) => (
                <td
                  key={i}
                  className={`px-4 py-2.5 ${i ? "text-right tabular-nums" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const studentLink = (id: string, name: string, tab: string) => (
  <Link
    href={`/admin/studenti/${encodeURIComponent(id)}?tab=${tab}`}
    className="font-medium hover:underline"
  >
    {name}
  </Link>
);
const amount = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const csv = (rows: (string | number)[][]) =>
  "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

/** Monthly accounting; each tab is shown only to roles that may see it. */
export function AccountingWorkspace() {
  const state = useCrm();
  const hydrated = useHydrated();
  const viewer = useViewer();
  const can = useCan();
  const today = todayRome();
  const [month, setMonth] = useState(today.slice(0, 7));
  const tabs = [
    ...(can("accounting.online") &&
    can("accounting.lessons") &&
    can("compensation.all")
      ? [{ value: "summary", label: "Riepilogo" }]
      : []),
    ...(can("accounting.online")
      ? [{ value: "online", label: "Coaching online" }]
      : []),
    ...(can("accounting.lessons")
      ? [{ value: "lessons", label: "Lezioni" }]
      : []),
    {
      value: "compensation",
      label: can("compensation.all") ? "Compensi coach" : "I miei compensi",
    },
  ];
  const [tab, setTab] = useState(tabs[0]!.value);
  if (!hydrated)
    return (
      <p role="status" className="py-12 text-sm text-muted-foreground">
        Caricamento…
      </p>
    );
  const active = tabs.some((t) => t.value === tab) ? tab : tabs[0]!.value;
  const online = onlineMonth(state, month);
  const lessons = lessonsMonth(state, month);
  const ownId = viewer?.recordId ?? "owner-demo";
  const coaches = compensations(state, month).filter(
    (c) => can("compensation.all") || c.coachId === ownId,
  );
  const plans = planRows(state, month).filter(
    (r) => can("compensation.all") || r.coachId === ownId,
  );
  const coachName = (id?: string) =>
    state.admins.find((a) => a.id === id)?.name ?? "—";
  const lessonsAccrued = lessons.venues.reduce((s, v) => s + v.accrued, 0);
  return (
    <>
      <PageHeading
        title="Contabilità"
        description="Incassi, importi maturati e compensi del mese. Ogni ruolo vede solo le sezioni che gli competono."
      />
      <LocalNotice />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PageTabs
          label="Sezioni della contabilità"
          value={active}
          onChange={setTab}
          tabs={tabs}
        />
        <div className="w-full sm:w-56">
          <SelectControl
            aria-label="Mese"
            className={`${control} rounded-xl`}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {accountingMonths(state, today).map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </SelectControl>
        </div>
      </div>

      {active === "summary" && (
        <section className="space-y-5" aria-label="Riepilogo del mese">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Incassato nel mese"
              value={euro(online.collected + lessons.collected)}
              hint={`Online ${euro(online.collected)} · lezioni ${euro(lessons.collected)}`}
            />
            <Stat
              label="Maturato nel mese"
              value={euro(online.planValue + lessonsAccrued)}
              hint={`Piani ${euro(online.planValue)} · lezioni ${euro(lessonsAccrued)}`}
            />
            <Stat
              label="Compensi coach"
              value={euro(online.compensation)}
              hint={`${online.plans} piani nel mese`}
            />
            <Stat
              label="Margine sull’incassato"
              value={euro(
                online.collected + lessons.collected - online.compensation,
              )}
              hint="Incassato meno compensi del mese"
              accent
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat
              label="Da incassare · online"
              value={euro(online.open)}
              hint="Su tutti gli abbonamenti, ad oggi"
            />
            <Stat
              label="Da incassare · lezioni"
              value={euro(lessons.open)}
              hint="Su tutti i wallet, ad oggi"
            />
          </div>
          <Table
            head={[
              "Sede",
              "Lezioni di gruppo",
              "Individuali",
              "Presenze",
              "Maturato",
            ]}
            rows={lessons.venues.map((v) => [
              v.label,
              v.groupLessons,
              v.individualLessons,
              v.attendances,
              euro(v.accrued),
            ])}
            empty="Nessuna lezione nel mese."
          />
        </section>
      )}

      {active === "online" && (
        <section className="space-y-5" aria-label="Contabilità Coaching online">
          <OnlineReceiptsQueue
            students={state.students}
            title="Pagamenti da verificare"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Abbonamenti attivi"
              value={String(online.activeSubscriptions)}
              hint={`${online.newSubscriptions} iniziati nel mese`}
            />
            <Stat
              label="Venduto nel mese"
              value={euro(online.sold)}
              hint="Abbonamenti che iniziano nel mese"
            />
            <Stat label="Incassato nel mese" value={euro(online.collected)} />
            <Stat
              label="Da incassare"
              value={euro(online.open)}
              hint="Su tutti gli abbonamenti, ad oggi"
              accent={online.open > 0}
            />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Piani del mese</h2>
              <p className="text-sm text-muted-foreground">
                {online.plans} piani · valore {euro(online.planValue)} ·
                compensi {euro(online.compensation)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!online.plans}
              onClick={() =>
                downloadCsv(
                  `piani-${month}.csv`,
                  csv([
                    [
                      "Studente",
                      "Piano",
                      "Coach",
                      "Valore (€)",
                      "Compenso (€)",
                    ],
                    ...planRows(state, month).map((r) => [
                      r.studentName,
                      r.title,
                      coachName(r.coachId),
                      amount(r.value),
                      amount(r.compensation),
                    ]),
                  ]),
                )
              }
            >
              <Download className="size-4" /> Esporta CSV
            </Button>
          </div>
          <Table
            head={["Studente", "Piano", "Coach", "Valore", "Compenso"]}
            rows={planRows(state, month).map((r) => [
              studentLink(r.studentId, r.studentName, "coaching"),
              r.title,
              coachName(r.coachId),
              euro(r.value),
              euro(r.compensation),
            ])}
            empty="Nessun piano assegnato nel mese."
          />
          <h2 className="text-lg font-semibold">Incassi del mese</h2>
          <Table
            head={["Studente", "Data", "Registrato da", "Importo"]}
            rows={online.payments.map((p) => [
              studentLink(p.studentId, p.studentName, "coaching"),
              formatDate(p.date.slice(0, 10)),
              p.by ?? "—",
              euro(p.amount),
            ])}
            empty="Nessun incasso registrato nel mese."
          />
        </section>
      )}

      {active === "lessons" && (
        <section className="space-y-5" aria-label="Contabilità lezioni">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Maturato nel mese" value={euro(lessonsAccrued)} />
            <Stat label="Incassato nel mese" value={euro(lessons.collected)} />
            <Stat
              label="Pacchetti venduti"
              value={String(lessons.packsSold)}
              hint={euro(lessons.packsAmount)}
            />
            <Stat
              label="Da incassare"
              value={euro(lessons.open)}
              hint="Su tutti i wallet, ad oggi"
              accent={lessons.open > 0}
            />
          </div>
          <Table
            head={[
              "Sede",
              "Lezioni di gruppo",
              "Individuali",
              "Presenze",
              "Maturato",
            ]}
            rows={lessons.venues.map((v) => [
              v.label,
              v.groupLessons,
              v.individualLessons,
              v.attendances,
              euro(v.accrued),
            ])}
            empty="Nessuna lezione nel mese."
          />
          <p className="text-sm text-muted-foreground">
            Le lezioni scalate da un pacchetto contano per la loro quota del
            prezzo del pacchetto. Il dettaglio dei pagamenti è nella pagina{" "}
            <Link href="/admin/pagamenti" className="underline">
              Pagamenti
            </Link>
            .
          </p>
        </section>
      )}

      {active === "compensation" && (
        <section className="space-y-5" aria-label="Compensi">
          {coaches.length ? (
            <Table
              head={[
                "Coach",
                "Percentuale",
                "Piani seguiti",
                "Valore piani",
                "Compenso",
              ]}
              rows={coaches.map((c) => [
                c.coachName,
                c.percent ? `${c.percent}%` : "—",
                c.plans,
                euro(c.value),
                euro(c.compensation),
              ])}
              empty=""
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border bg-card px-6 py-10 text-center">
              <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <Lock className="size-5" strokeWidth={1.75} />
              </span>
              <p className="max-w-sm text-sm text-muted-foreground">
                Nessun compenso nel mese. I compensi si calcolano sui piani
                mensili seguiti come coach, con la percentuale impostata dal
                super admin nel Team.
              </p>
            </div>
          )}
          {plans.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">Dettaglio piani</h2>
              <Table
                head={["Studente", "Piano", "Coach", "Valore", "Compenso"]}
                rows={plans.map((r) => [
                  r.studentName,
                  r.title,
                  coachName(r.coachId),
                  euro(r.value),
                  euro(r.compensation),
                ])}
                empty=""
              />
            </>
          )}
        </section>
      )}
    </>
  );
}
