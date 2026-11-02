"use client";
import { useState, type AriaAttributes } from "react";
import { Checkbox } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormChanged } from "./form-change-context";
type Props = AriaAttributes & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: { target: { checked: boolean } }) => void;
  name?: string;
  value?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};
export function CheckboxControl({
  checked,
  defaultChecked = false,
  onChange,
  name,
  value,
  id,
  disabled,
  required,
  className,
  ...aria
}: Props) {
  const [internal, setInternal] = useState(defaultChecked);
  const changed = useFormChanged();
  const mixed = aria["aria-checked"] === "mixed";
  return (
    <Checkbox.Root
      {...aria}
      data-slot="checkbox-control"
      id={id}
      name={name}
      value={value}
      required={required}
      disabled={disabled}
      checked={mixed ? "indeterminate" : (checked ?? internal)}
      onCheckedChange={(next) => {
        const actual = next === true;
        if (checked === undefined) setInternal(actual);
        onChange?.({ target: { checked: actual } });
        changed();
      }}
      className={cn(
        "relative after:absolute after:-inset-2 after:content-[''] inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-foreground/25 bg-background text-primary-foreground outline-none transition-colors hover:border-foreground/50 focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
        className,
      )}
    >
      <Checkbox.Indicator>
        {mixed ? (
          <Minus className="size-3" strokeWidth={2.5} />
        ) : (
          <Check className="size-3" strokeWidth={2.5} />
        )}
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
