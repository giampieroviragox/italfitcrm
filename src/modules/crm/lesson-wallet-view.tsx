"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  canUseLessonCredit,
  lessonPrice,
  type LessonVenue,
  emptyWallet,
  milanoPrivateCredit,
  lessonVenues,
  paidAmount,
  remainingCredit,
  type LessonWallet,
  type WalletCommand,
} from "./lesson-wallet";
import { updateLessonWallet } from "./store";
import { ReceiptForm, ReceiptList } from "./receipts-view";
import { outstandingAmount } from "./lesson-wallet";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { SelectControl } from "@/components/ui/select-control";
import { romeToIso, todayRome } from "./fitness-logic";
import { Field, FormError, control } from "./ui";

export { euro } from "./money";
import { euro } from "./money";
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
  onSubmitReceipt,
  only,
}: {
  wallet?: LessonWallet;
  staff?: { studentId: string; archived: boolean };
  /** Student mode: declares a payment with its receipt. */
  onSubmitReceipt?: (form: FormData) => Promise<string>;
  /** Shows one part only, as a section of the student profile. */
  only?: "packages" | "lessons" | "payments";
}) {
  const show = (part: "packages" | "lessons" | "payments") =>
    !only || only === part;
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
            kind: "package" as const,
            quantity:
              Number(data.get("quantity")) * (unit === "minutes" ? 60 : 1),
            unit,
            price: Math.round(Number(data.get("price")) * 100),
            individual: true,
          };
    void asyncSubmit(
      { action: "credit", studentId: staff.studentId, credit },
      () => setPurchase(""),
    );
  };
  return (
    <section id="wallet-lezioni" className="space-y-4">
      {!only && (
        <div>
          <h2 className="text-lg font-semibold">Wallet lezioni</h2>
          <p className="text-sm text-muted-foreground">
            Pacchetti, lezioni svolte e pagamenti delle lezioni in sede.
          </p>
        </div>
      )}
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
      {show("payments") &&
        (onSubmitReceipt || (wallet.receipts?.length ?? 0) > 0) && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              {staff
                ? "Pagamenti dichiarati dallo studente"
                : "I tuoi pagamenti"}
            </h3>
            {onSubmitReceipt && (
              <ReceiptForm
                outstanding={outstandingAmount(wallet)}
                onSubmit={onSubmitReceipt}
              />
            )}
            <ReceiptList
              receipts={wallet.receipts ?? []}
              staff={
                staff
                  ? {
                      studentId: staff.studentId,
                      outstanding: outstandingAmount(wallet),
                    }
                  : undefined
              }
            />
          </div>
        )}
      {show("packages") && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            Pacchetti lezioni individuali
          </h3>
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
                          {units(credit.quantity - remaining, credit.unit)}{" "}
                          usate · {units(remaining, credit.unit)} residue su{" "}
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
              Nessun pacchetto registrato.
            </p>
          )}
          {staff && !staff.archived && (
            <form
              className="space-y-3 rounded-xl border bg-card p-3"
              onSubmit={addCredit}
            >
              <fieldset disabled={pending} className="space-y-3">
                <Field
                  label="Assegna un pacchetto"
                  hint="I pacchetti coprono solo le lezioni individuali. Le lezioni di gruppo si pagano a listino."
                >
                  <select
                    className={control}
                    value={purchase}
                    onChange={(e) => setPurchase(e.target.value)}
                  >
                    <option value="">Seleziona il pacchetto</option>
                    <option value="milano">
                      Milano 1:1 · 10 ore + 1 in regalo · 750 €
                    </option>
                    <option value="package">Pacchetto personalizzato</option>
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
                  </>
                )}
                {purchase && (
                  <Button type="submit" size="sm">
                    Assegna pacchetto
                  </Button>
                )}
              </fieldset>
            </form>
          )}
        </div>
      )}
      {show("lessons") && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Storico lezioni svolte</h3>
          {settledSingleLessons.length > 0 && (
            <p className="text-sm text-muted-foreground">
              A lezione, saldate:{" "}
              {units(settledSingleLessons.length, "lessons")} ·{" "}
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
                        {lesson.id.startsWith("manual-")
                          ? "Individuale"
                          : `Di gruppo · ${lesson.participants} ${lesson.participants === 1 ? "presente" : "presenti"}`}{" "}
                        · {date(lesson.startsAt)} · {hours(lesson.minutes)} ·{" "}
                        {lessonVenues[lesson.venue]}
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
      )}
      {show("lessons") && staff && !staff.archived && (
        <RecordLessonForm
          wallet={wallet}
          studentId={staff.studentId}
          pending={pending}
          submit={asyncSubmit}
        />
      )}
      {show("payments") && staff && charges.length > 0 && (
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

/** Records a lesson already held and agreed directly with the student (e.g. 1:1). */
function RecordLessonForm({
  wallet,
  studentId,
  pending,
  submit,
}: {
  wallet: LessonWallet;
  studentId: string;
  pending: boolean;
  submit: (command: WalletCommand, onSuccess: () => void) => Promise<void>;
}) {
  const today = todayRome();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Lezione individuale");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [venue, setVenue] = useState<LessonVenue>("milano");
  const [creditId, setCreditId] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const listPrice = lessonPrice(venue, 1, minutes);
  const usable = wallet.credits.filter((c) =>
    canUseLessonCredit(wallet, c, venue, 1, minutes),
  );
  const credit = usable.find((c) => c.id === creditId);
  const reset = () => {
    setOpen(false);
    setTime("");
    setPrice("");
    setCreditId("");
    setError("");
  };
  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Registra una lezione individuale
      </Button>
    );
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        if (!time) return setError("Indica l’orario della lezione.");
        let startsAt;
        try {
          startsAt = romeToIso(`${date}T${time}`);
        } catch (e) {
          return setError((e as Error).message);
        }
        const manual = price.trim()
          ? Math.round(Number(price.replace(",", ".")) * 100)
          : undefined;
        if (manual !== undefined && (!Number.isFinite(manual) || manual < 0))
          return setError("Prezzo non valido.");
        if (!credit && manual === undefined && listPrice === undefined)
          return setError(
            "Per questa lezione il listino non ha un prezzo: inseriscilo.",
          );
        void submit(
          {
            action: "record",
            studentId,
            lesson: { title, startsAt, minutes, venue, participants: 1 },
            ...(credit ? { creditId: credit.id } : {}),
            ...(!credit && manual !== undefined ? { manualPrice: manual } : {}),
          },
          reset,
        );
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        <legend className="mb-1 text-sm font-semibold">
          Registra una lezione individuale
        </legend>
        <p className="text-sm text-muted-foreground">
          Le lezioni 1:1 fissate direttamente con il coach. Si pagano a listino
          oppure si scalano dal pacchetto, ed entrano nello storico e nel saldo.
        </p>
        <Field label="Titolo">
          <input
            required
            maxLength={100}
            className={control}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data">
            <DatePicker required max={today} value={date} onChange={setDate} />
          </Field>
          <Field label="Ora">
            <TimePicker required value={time} onChange={setTime} />
          </Field>
          <Field label="Durata">
            <SelectControl
              className={control}
              value={String(minutes)}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {hours(m)}
                </option>
              ))}
            </SelectControl>
          </Field>
        </div>
        <Field label="Sede">
          <SelectControl
            className={control}
            value={venue}
            onChange={(e) =>
              setVenue(e.target.value === "monza" ? "monza" : "milano")
            }
          >
            {Object.entries(lessonVenues).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectControl>
        </Field>
        <Field
          label="Scala dal pacchetto"
          hint={
            usable.length
              ? "Lascia vuoto per addebitarla a lezione."
              : "Nessun pacchetto con ore residue utilizzabile per questa sede e durata."
          }
        >
          <SelectControl
            className={control}
            value={creditId}
            onChange={(e) => setCreditId(e.target.value)}
          >
            <option value="">Nessuno: addebito a lezione</option>
            {usable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · residuo {units(remainingCredit(wallet, c), c.unit)}
              </option>
            ))}
          </SelectControl>
        </Field>
        {!credit && (
          <Field
            label="Prezzo a persona (€)"
            hint={
              listPrice !== undefined
                ? `Listino ${lessonVenues[venue]}, lezione individuale: ${euro(listPrice)}. Inserisci un importo solo se diverso.`
                : "Il listino non copre questa durata o questo numero di partecipanti: inserisci il prezzo."
            }
          >
            <input
              inputMode="decimal"
              className={control}
              placeholder={
                listPrice !== undefined ? String(listPrice / 100) : ""
              }
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </Field>
        )}
        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            {pending ? "Salvataggio…" : "Registra lezione"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            Annulla
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
