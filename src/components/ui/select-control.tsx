"use client";
import {
  Children,
  Fragment,
  isValidElement,
  useRef,
  useState,
  type ReactNode,
  type AriaAttributes,
} from "react";
import { Select } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormChanged } from "./form-change-context";
interface Option {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<{ children?: ReactNode }>(node))
    return text(node.props.children);
  return "";
}
function collect(children: ReactNode): Option[] {
  const result: Option[] = [];
  Children.forEach(children, (node) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      }>(node)
    )
      return;
    if (node.type === Fragment) result.push(...collect(node.props.children));
    else if (node.type === "option")
      result.push({
        value: String(node.props.value ?? text(node.props.children)),
        label: node.props.children,
        disabled: node.props.disabled,
      });
  });
  return result;
}
type Props = AriaAttributes & {
  children: ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: {
    target: { value: string };
    currentTarget: { value: string };
  }) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  autoFocus?: boolean;
};
export function SelectControl({
  children,
  value,
  defaultValue,
  onChange,
  name,
  id,
  required,
  disabled,
  className,
  title,
  autoFocus,
  ...aria
}: Props) {
  const options = collect(children);
  const [internal, setInternal] = useState(
      String(defaultValue ?? options[0]?.value ?? ""),
    ),
    [invalid, setInvalid] = useState(false);
  const selected = value === undefined ? internal : String(value);
  const placeholder =
    options.find((o) => o.value === "")?.label ?? "Seleziona…";
  const trigger = useRef<HTMLButtonElement>(null);
  const changed = useFormChanged();
  return (
    <div className="relative min-w-0">
      <Select.Root
        value={
          selected
            ? `option-${options.findIndex((o) => o.value === selected)}`
            : ""
        }
        disabled={disabled}
        onValueChange={(next) => {
          const actual = options[Number(next.slice(7))]?.value ?? "";
          if (value === undefined) setInternal(actual);
          setInvalid(false);
          onChange?.({
            target: { value: actual },
            currentTarget: { value: actual },
          });
          changed();
        }}
      >
        <Select.Trigger
          ref={trigger}
          data-slot="select-control"
          id={id}
          title={title}
          autoFocus={autoFocus}
          {...aria}
          aria-required={required}
          aria-invalid={invalid || aria["aria-invalid"]}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-input bg-white px-3 text-left text-sm outline-none transition-colors hover:bg-muted/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-50 [&>span:first-child]:truncate",
            className,
            "flex items-center justify-between",
          )}
        >
          <Select.Value placeholder={placeholder}>
            {selected
              ? options.find((o) => o.value === selected)?.label
              : undefined}
          </Select.Value>
          <Select.Icon asChild>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className="z-[65] max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border bg-white text-foreground shadow-[0_8px_30px_#00000014] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <Select.ScrollUpButton className="flex h-7 items-center justify-center bg-white">
              <ChevronUp className="size-4" />
            </Select.ScrollUpButton>
            <Select.Viewport className="p-1.5">
              {options.map((o) => (
                <Select.Item
                  key={String(options.indexOf(o))}
                  value={`option-${options.indexOf(o)}`}
                  disabled={o.disabled}
                  className="relative flex min-h-9 max-w-[calc(100vw-40px)] cursor-pointer items-center rounded-lg py-2 pr-9 pl-3 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-muted"
                >
                  <Select.ItemText>
                    <span className="block truncate">{o.label}</span>
                  </Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3">
                    <Check className="size-3.5" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="flex h-7 items-center justify-center bg-white">
              <ChevronDown className="size-4" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {(name || required) && (
        <input
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
          name={name}
          required={required}
          disabled={disabled}
          value={selected}
          onChange={() => {}}
          onInvalid={(e) => {
            e.preventDefault();
            setInvalid(true);
            trigger.current?.focus();
          }}
        />
      )}
      {invalid && (
        <span
          role="alert"
          className="mt-1 block text-xs font-normal text-destructive"
        >
          Seleziona un valore.
        </span>
      )}
    </div>
  );
}
