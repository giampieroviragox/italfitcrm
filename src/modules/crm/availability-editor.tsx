"use client";
import { useState } from "react";
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
  availabilitySlotCount,
  slotDurationMinutes,
  type AvailabilitySlot,
} from "./availability";

export function AvailabilityEditor({
  selection,
  close,
  apply,
}: {
  selection: AvailabilitySelection;
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
      selection.existing
        ? availabilitySlotCount(selection.existing)
        : defaultCount(selection.date, selection.start, selection.end),
    ),
  };
  const [values, setValues] = useState(defaults);
  const [manualCount, setManualCount] = useState(Boolean(selection.existing));
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
    const next = { ...values, [key]: value };
    if (!manualCount)
      next.count = String(defaultCount(next.date, next.start, next.end));
    setValues(next);
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
      description="Scegli la fascia e quanti slot uguali contiene. Le modifiche restano in bozza fino a Salva calendario."
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
          <input
            className={control}
            type="date"
            required
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dalle">
            <input
              className={control}
              type="time"
              step={60}
              required
              value={values.start}
              onChange={(e) => update("start", e.target.value)}
            />
          </Field>
          <Field label="Alle" hint="00:00 indica mezzanotte, a fine giornata.">
            <input
              className={control}
              type="time"
              step={60}
              required
              value={values.end === "24:00" ? "00:00" : values.end}
              onChange={(e) =>
                update(
                  "end",
                  e.target.value === "00:00" ? "24:00" : e.target.value,
                )
              }
            />
          </Field>
        </div>
        <Field
          label="Numero di slot"
          hint="Gli slot dividono la fascia in parti uguali."
        >
          <input
            className={control}
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            value={values.count}
            onChange={(e) => {
              setManualCount(true);
              setValues({ ...values, count: e.target.value });
              setError("");
            }}
          />
        </Field>
        <div
          className="flex items-start gap-3 border-t border-b bg-[#f7f9f7] px-1 py-4 text-[#294532]"
          aria-live="polite"
        >
          <Clock3 className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {period
                ? `${availabilitySlotCount(period)} slot da ${durationLabel(slotDurationMinutes(period))}`
                : "Controlla fascia e numero di slot"}
            </p>
            <p className="mt-1 text-xs leading-5">
              {period
                ? `${values.start}–${values.end} · ${durationLabel((Date.parse(period.end) - Date.parse(period.start)) / 60000)} complessive · Europe/Rome`
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
    </Editor>
  );
}
function defaultCount(date: string, start: string, end: string) {
  try {
    const period = periodFromFields(date, start, end, 1);
    const duration =
      (Date.parse(period.end) - Date.parse(period.start)) / 60000;
    return duration % 60 === 0 ? duration / 60 : 1;
  } catch {
    return 1;
  }
}
