"use client";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { useState, type ReactNode } from "react";
import { useClock } from "./use-clock";
import {
  durationLabel,
  periodFromFields,
  type AvailabilitySelection,
} from "./availability-time";
import { Clock3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Editor, EditorCancel, Field, FormError, control } from "./ui";
import {
  availabilityCapacity,
  availabilityDurationMinutes,
  maxAvailabilityCapacity,
  type AvailabilitySlot,
} from "./availability";

export function AvailabilityEditor({
  selection,
  close,
  apply,
  roster,
}: {
  selection: AvailabilitySelection;
  /** Enrolled students of a published period, shown under the form. */
  roster?: ReactNode;
  close: () => void;
  apply: (
    next: AvailabilitySlot | undefined,
    previous?: AvailabilitySlot,
  ) => void;
}) {
  const now = useClock();
  const defaults = {
    date: selection.date,
    start: selection.start,
    end: selection.end,
    count: String(
      selection.existing ? availabilityCapacity(selection.existing) : 1,
    ),
  };
  const [values, setValues] = useState(defaults);
  const [error, setError] = useState("");
  let period: AvailabilitySlot | null = null;
  let validation = "";
  try {
    period = periodFromFields(
      values.date,
      values.start,
      values.end,
      Number(values.count),
    );
  } catch (e) {
    validation = (e as Error).message;
  }
  const update = (key: "date" | "start" | "end", value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const submit = (next: AvailabilitySlot | undefined) => {
    try {
      if (next && Date.parse(next.start) <= now)
        throw new Error("Scegli un orario futuro.");
      apply(next, selection.existing);
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Editor
      centered
      title={
        selection.existing ? "Modifica disponibilità" : "Nuova disponibilità"
      }
      description={
        selection.existing
          ? "Cambia orario e posti, oppure iscrivi tu uno studente che non si è prenotato."
          : "Imposta l’orario e quanti studenti possono prenotarsi da soli per l’intera fascia."
      }
      dirty={JSON.stringify(values) !== JSON.stringify(defaults)}
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!period) {
            setError(validation);
            return;
          }
          submit(period);
        }}
      >
        <Field label="Giorno">
          <DatePicker
            required
            value={values.date}
            onChange={(v) => update("date", v)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dalle">
            <TimePicker
              required
              value={values.start}
              onChange={(v) => update("start", v)}
            />
          </Field>
          <Field label="Alle" hint="00:00 indica mezzanotte, a fine giornata.">
            <TimePicker
              required
              value={values.end === "24:00" ? "00:00" : values.end}
              onChange={(v) => update("end", v === "00:00" ? "24:00" : v)}
            />
          </Field>
        </div>
        <Field
          label="Posti disponibili"
          hint="Tutti gli iscritti hanno lo stesso orario di inizio e fine."
        >
          <input
            className={control}
            type="number"
            min={1}
            max={maxAvailabilityCapacity}
            step={1}
            required
            value={values.count}
            onChange={(e) => {
              setValues({ ...values, count: e.target.value });
              setError("");
            }}
          />
        </Field>
        <div
          className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3.5"
          aria-live="polite"
        >
          <Clock3 className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {period
                ? `${availabilityCapacity(period)} ${availabilityCapacity(period) === 1 ? "posto" : "posti"} nella stessa fascia`
                : "Controlla orario e numero di posti"}
            </p>
            <p className="mt-1 text-xs leading-5">
              {period
                ? `${values.start}–${values.end} · ${durationLabel(availabilityDurationMinutes(period))} complessive · Europe/Rome`
                : validation}
            </p>
          </div>
        </div>
        <FormError message={error} />
        <div className="crm-form-actions">
          {selection.existing && (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => submit(undefined)}
            >
              <Trash2 className="size-4" />
              Rimuovi
            </Button>
          )}
          <EditorCancel />
          <Button type="submit">
            {selection.existing ? "Aggiorna fascia" : "Aggiungi al calendario"}
          </Button>
        </div>
      </form>
      {roster}
    </Editor>
  );
}
