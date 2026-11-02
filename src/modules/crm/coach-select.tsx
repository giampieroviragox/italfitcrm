import { SelectControl } from "@/components/ui/select-control";
import { Field, control } from "./ui";

export function CoachSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Coach di riferimento">
      <SelectControl
        className={control}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Non assegnato</option>
        <option value="Giorgio">Giorgio</option>
        <option value="Marta">Marta</option>
        {value && !["Giorgio", "Marta"].includes(value) && (
          <option value={value} disabled>
            {value}
          </option>
        )}
      </SelectControl>
    </Field>
  );
}
