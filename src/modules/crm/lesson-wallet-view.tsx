"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  emptyWallet,
  milanoPrivateCredit,
  lessonVenues,
  paidAmount,
  remainingCredit,
  type LessonWallet,
  type WalletCommand,
} from "./lesson-wallet";
import { updateLessonWallet } from "./store";
import { Field, FormError, control } from "./ui";

export const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    useGrouping: "always",
  }).format(cents / 100);
const date = (value: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
function hours(minutes: number) {
  const whole = Math.floor(minutes / 60),
    rest = minutes % 60;
  return whole
    ? `${whole} h${rest ? ` ${rest} min` : ""}`
    : minutes
      ? `${rest} min`
      : "0 h";
}
const units = (quantity: number, unit: "minutes" | "lessons") =>
  unit === "minutes"
    ? hours(quantity)
    : `${quantity} ${quantity === 1 ? "lezione" : "lezioni"}`;

export function LessonWalletView({
  wallet = emptyWallet,
  staff,
}: {
  wallet?: LessonWallet;
  staff?: { studentId: string; archived: boolean };
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [purchase, setPurchase] = useState("");
  const [unit, setUnit] = useState<"minutes" | "lessons">("minutes");
  const lock = useRef(false);
  const entries = [...wallet.credits, ...wallet.lessons];
  const paid = entries.reduce((sum, item) => sum + paidAmount(item), 0);
  const total = entries.reduce((sum, item) => sum + item.price, 0);
  const minutes = wallet.lessons.reduce(
    (sum, lesson) => sum + lesson.minutes,
    0,
  );
  const settledSingleLessons = wallet.lessons.filter(
    (l) => !l.creditId && paidAmount(l) >= l.price,
  );
  const charges = [
    ...wallet.credits.map((item) => ({
      item,
      category: "credit" as const,
      label: item.name,
    })),
    ...wallet.lessons.map((item) => ({
      item,
      category: "lesson" as const,
      label: `${item.title} · ${date(item.startsAt)}`,
    })),
  ].filter(({ item }) => item.price > paidAmount(item));
  const asyncSubmit = async (command: WalletCommand, onSuccess: () => void) => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await updateLessonWallet(command);
      onSuccess();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const addCredit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!staff) return;
    const data = new FormData(event.currentTarget);
    const credit =
      purchase === "milano"
        ? milanoPrivateCredit
        : {
            name: String(data.get("name")),
            kind:
              purchase === "subscription"
                ? ("subscription" as const)
                : ("package" as const),
            quantity:
              Number(data.get("quantity")) * (unit === "minutes" ? 60 : 1),
            unit,
            price: Math.round(Number(data.get("price")) * 100),
            individual: data.has("individual"),
          };
    void asyncSubmit(
      { action: "credit", studentId: staff.studentId, credit },
      () => setPurchase(""),
    );
  };
  return (
    <section id="wallet-lezioni" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Wallet lezioni</h2>
        <p className="text-sm text-muted-foreground">
          Crediti, presenze e pagamenti delle lezioni in sede.
        </p>
      </div>
      <dl className="grid gap-2 sm:grid-cols-3">
        {[
          {
            label: "Lezioni svolte",
            value: `${wallet.lessons.length} · ${hours(minutes)}`,
          },
          { label: staff ? "Incassato" : "Pagato", value: euro(paid) },
          { label: "Da saldare", value: euro(total - paid) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <FormError message={error} />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Pacchetti e abbonamenti</h3>
        {wallet.credits.length ? (
          <>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {(["quantity", "paid", "remaining"] as const).map((key) => {
                const amount = (unit: "minutes" | "lessons") =>
                  wallet.credits
                    .filter((c) => c.unit === unit)
                    .reduce(
                      (sum, c) =>
                        sum +
                        (key === "quantity"
                          ? c.quantity
                          : key === "paid"
                            ? paidAmount(c) >= c.price
                              ? c.quantity
                              : 0
                            : remainingCredit(wallet, c)),
                      0,
                    );
                return (
                  <div key={key}>
                    <dt className="text-muted-foreground">
                      {
                        {
                          quantity: "Acquistate",
                          paid: "Saldate per intero",
                          remaining: "Residue",
                        }[key]
                      }
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {units(amount("minutes"), "minutes")} ·{" "}
                      {units(amount("lessons"), "lessons")}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <ul className="divide-y rounded-xl border px-3">
              {wallet.credits.toReversed().map((credit) => {
                const remaining = remainingCredit(wallet, credit);
                return (
                  <li
                    key={credit.id}
                    className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{credit.name}</p>
                      <p className="text-muted-foreground">
                        {credit.kind === "package"
                          ? "Pacchetto"
                          : "Abbonamento"}{" "}
                        · {date(credit.purchasedAt)}
                        {credit.individual ? " · Solo individuale" : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {units(credit.quantity - remaining, credit.unit)} usate
                        · {units(remaining, credit.unit)} residue su{" "}
                        {units(credit.quantity, credit.unit)}
                      </p>
                    </div>
                    <p className="tabular-nums">
                      {euro(paidAmount(credit))} / {euro(credit.price)} pagati
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nessun pacchetto o abbonamento registrato.
          </p>
        )}
        {staff && !staff.archived && (
          <form
            className="space-y-3 rounded-xl border bg-card p-3"
            onSubmit={addCredit}
          >
            <fieldset disabled={pending} className="space-y-3">
              <Field label="Assegna credito">
                <select
                  className={control}
                  value={purchase}
                  onChange={(e) => setPurchase(e.target.value)}
                >
                  <option value="">Seleziona il tipo di credito</option>
                  <option value="milano">
                    Milano 1:1 · 10 ore + 1 in regalo · 750 €
                  </option>
                  <option value="package">Pacchetto personalizzato</option>
                  <option value="subscription">
                    Abbonamento con lezioni in sede
                  </option>
                </select>
              </Field>
              {purchase && purchase !== "milano" && (
                <>
                  <Field label="Nome">
                    <input
                      required
                      name="name"
                      maxLength={100}
                      className={control}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Unità">
                      <select
                        className={control}
                        value={unit}
                        onChange={(e) =>
                          setUnit(
                            e.target.value === "minutes"
                              ? "minutes"
                              : "lessons",
                          )
                        }
                      >
                        <option value="minutes">Ore</option>
                        <option value="lessons">Lezioni</option>
                      </select>
                    </Field>
                    <Field
                      label={
                        unit === "minutes"
                          ? "Ore acquistate"
                          : "Lezioni acquistate"
                      }
                    >
                      <input
                        key={unit}
                        required
                        name="quantity"
                        type="number"
                        min={unit === "minutes" ? 0.25 : 1}
                        step={unit === "minutes" ? 0.25 : 1}
                        max={unit === "minutes" ? 1000 : 60000}
                        className={control}
                      />
                    </Field>
                    <Field label="Prezzo totale (€)">
                      <input
                        required
                        name="price"
                        type="number"
                        min="0"
                        max="100000"
                        step="0.01"
                        className={control}
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input name="individual" type="checkbox" /> Solo lezioni
                    individuali
                  </label>
                </>
              )}
              {purchase && (
                <Button type="submit" size="sm">
                  Assegna credito
                </Button>
              )}
            </fieldset>
          </form>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Storico lezioni svolte</h3>
        {settledSingleLessons.length > 0 && (
          <p className="text-sm text-muted-foreground">
            A lezione, saldate: {units(settledSingleLessons.length, "lessons")}{" "}
            ·{" "}
            {hours(
              settledSingleLessons.reduce(
                (sum, lesson) => sum + lesson.minutes,
                0,
              ),
            )}
          </p>
        )}
        {wallet.lessons.length ? (
          <ul className="divide-y rounded-xl border px-3">
            {wallet.lessons
              .toSorted(
                (a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt),
              )
              .map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{lesson.title}</p>
                    <p className="text-muted-foreground">
                      {date(lesson.startsAt)} · {hours(lesson.minutes)} ·{" "}
                      {lessonVenues[lesson.venue]} · {lesson.participants}{" "}
                      {lesson.participants === 1
                        ? "partecipante"
                        : "partecipanti"}
                    </p>
                  </div>
                  <p className="tabular-nums">
                    {lesson.creditId
                      ? `Coperta da ${wallet.credits.find((credit) => credit.id === lesson.creditId)?.name ?? "credito"}${lesson.allocatedPrice !== undefined ? ` · quota ${euro(lesson.allocatedPrice)}` : ""}`
                      : `${euro(paidAmount(lesson))} / ${euro(lesson.price)} pagati`}
                  </p>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nessuna presenza confermata.
          </p>
        )}
      </div>
      {staff && charges.length > 0 && (
        <form
          className="rounded-xl border bg-card p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const selected = charges.find(
              ({ item, category }) =>
                `${category}:${item.id}` === data.get("item"),
            );
            if (!selected) return;
            void asyncSubmit(
              {
                action: "payment",
                studentId: staff.studentId,
                category: selected.category,
                targetId: selected.item.id,
                amount: Math.round(Number(data.get("amount")) * 100),
              },
              () => form.reset(),
            );
          }}
        >
          <fieldset
            disabled={pending}
            className="flex flex-wrap items-end gap-3"
          >
            <legend className="mb-2 text-sm font-semibold">
              Registra un pagamento
            </legend>
            <div className="min-w-44 flex-1">
              <Field label="Voce da saldare">
                <select name="item" required className={control}>
                  <option value="">Seleziona</option>
                  {charges.map(({ item, category, label }) => (
                    <option
                      key={`${category}:${item.id}`}
                      value={`${category}:${item.id}`}
                    >
                      {label} · residuo {euro(item.price - paidAmount(item))}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Importo (€)">
              <input
                name="amount"
                required
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                className={control}
              />
            </Field>
            <Button type="submit" size="sm">
              Registra pagamento
            </Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
