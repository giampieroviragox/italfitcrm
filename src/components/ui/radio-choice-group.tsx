"use client";
import { RadioGroup } from "radix-ui";
import { useFormChanged } from "./form-change-context";
export function RadioChoiceGroup({
  options,
  value,
  onChange,
  name,
  required,
  label,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  label: string;
}) {
  const changed = useFormChanged();
  return (
    <RadioGroup.Root
      aria-label={label}
      name={name}
      required={required}
      value={value}
      onValueChange={(next) => {
        onChange(next);
        changed();
      }}
      className="space-y-1"
    >
      {options.map((option) => (
        <label
          key={option}
          className="flex min-h-10 cursor-pointer items-center gap-3 text-sm"
        >
          <RadioGroup.Item
            value={option}
            className="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-foreground/25 bg-white outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 data-[state=checked]:border-primary"
          >
            <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
          </RadioGroup.Item>
          {option}
        </label>
      ))}
    </RadioGroup.Root>
  );
}
