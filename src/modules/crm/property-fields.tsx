"use client";
import { DatePicker } from "@/components/ui/date-time-picker";
import { SelectControl } from "@/components/ui/select-control";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { RadioChoiceGroup } from "@/components/ui/radio-choice-group";
import { useFormChanged } from "@/components/ui/form-change-context";
import { control, Field } from "./ui";
import type { CrmProperty, PropertyValue } from "./model";
export function PropertyField({
  property: p,
  value,
  onChange,
}: {
  property: CrmProperty;
  value: PropertyValue | undefined;
  onChange: (v: PropertyValue) => void;
}) {
  const changed = useFormChanged();
  const label = `${p.name}${p.required ? " *" : ""}`;
  if (p.type === "multiselect" || p.type === "radio")
    return (
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-xs font-medium">{label}</legend>
        {p.description && (
          <p className="text-xs text-muted-foreground">{p.description}</p>
        )}
        {p.type === "radio" ? (
          <RadioChoiceGroup
            label={label}
            name={p.id}
            required={p.required}
            options={p.options}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
          />
        ) : (
          p.options.map((o) => (
            <label key={o} className="flex min-h-10 items-center gap-3 text-sm">
              <CheckboxControl
                name={p.id}
                value={o}
                checked={Array.isArray(value) && value.includes(o)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...(Array.isArray(value) ? value : []), o]
                      : (Array.isArray(value) ? value : []).filter(
                          (x) => x !== o,
                        ),
                  )
                }
              />
              {o}
            </label>
          ))
        )}
        {p.type === "radio" && !p.required && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              changed();
            }}
            className="text-xs text-muted-foreground underline"
          >
            Cancella scelta
          </button>
        )}
      </fieldset>
    );
  const stringValue =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  return (
    <Field label={label} hint={p.description}>
      {p.type === "textarea" ? (
        <textarea
          aria-label={label}
          required={p.required}
          className={control}
          rows={4}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : p.type === "select" || p.type === "boolean" ? (
        <SelectControl
          aria-label={label}
          required={p.required}
          className={control}
          value={
            p.type === "boolean"
              ? typeof value === "boolean"
                ? String(value)
                : ""
              : stringValue
          }
          onChange={(e) =>
            onChange(
              p.type === "boolean" && e.target.value
                ? e.target.value === "true"
                : e.target.value,
            )
          }
        >
          <option value="">Seleziona…</option>
          {p.type === "boolean" ? (
            <>
              <option value="true">Sì</option>
              <option value="false">No</option>
            </>
          ) : (
            p.options.map((o) => <option key={o}>{o}</option>)
          )}
        </SelectControl>
      ) : p.type === "date" ? (
        <DatePicker
          aria-label={label}
          required={p.required}
          value={stringValue}
          onChange={onChange}
        />
      ) : (
        <input
          aria-label={label}
          required={p.required}
          className={control}
          type={
            p.type === "phone" ? "tel" : p.type === "text" ? "text" : p.type
          }
          step={p.type === "number" ? "any" : undefined}
          value={stringValue}
          onChange={(e) =>
            onChange(
              p.type === "number" && e.target.value !== ""
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </Field>
  );
}
