"use client";
import { useEffect, useId, useRef, useState, type AriaAttributes } from "react";
import { Popover } from "radix-ui";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormChanged } from "./form-change-context";

type FieldProps = AriaAttributes & {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const trigger =
  "flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-[10px] border border-input bg-background px-3 text-left text-sm outline-none transition-[border-color,box-shadow] hover:border-(--border-hover) focus-visible:border-(--border-focus) focus-visible:ring-[3px] focus-visible:ring-foreground/5 data-[state=open]:border-(--border-focus) data-[state=open]:ring-[3px] data-[state=open]:ring-foreground/5 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive";
const panel =
  "z-[65] rounded-xl border bg-card p-2 text-sm text-foreground shadow-[0_8px_30px_#00000014] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";
const cell =
  "flex items-center justify-center rounded-lg text-sm tabular-nums outline-none transition-colors hover:bg-foreground/[.045] focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:pointer-events-none disabled:opacity-30";
const selectedCell =
  "bg-foreground font-medium text-background hover:bg-foreground";

/** Shared shell: trigger, popover and hidden input for native form validation. */
function PickerShell({
  value,
  label,
  icon: Icon,
  open,
  setOpen,
  name,
  id,
  required,
  disabled,
  className,
  placeholder = "Seleziona…",
  aria,
  children,
}: Omit<FieldProps, "onChange"> & {
  label: string;
  icon: typeof Clock3;
  open: boolean;
  setOpen: (open: boolean) => void;
  aria: AriaAttributes;
  children: React.ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const [invalid, setInvalid] = useState(false);
  return (
    <div className="relative min-w-0">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            ref={button}
            type="button"
            role="combobox"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={contentId}
            id={id}
            disabled={disabled}
            {...aria}
            aria-required={required}
            aria-invalid={invalid || aria["aria-invalid"]}
            className={cn(trigger, className)}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? label : placeholder}
            </span>
            <Icon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            id={contentId}
            className={panel}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              button.current?.focus();
            }}
          >
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {(name || required) && (
        <input
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
          name={name}
          required={required}
          disabled={disabled}
          value={value}
          onChange={() => {}}
          onInvalid={(e) => {
            const handled = e.defaultPrevented;
            e.preventDefault();
            setInvalid(true);
            if (!handled) button.current?.focus();
          }}
        />
      )}
      {invalid && !value && (
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

function splitAria<T extends FieldProps>(props: T) {
  const aria: AriaAttributes = {};
  for (const [key, v] of Object.entries(props))
    if (key.startsWith("aria-")) (aria as Record<string, unknown>)[key] = v;
  return aria;
}

const weekdays = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];
const monthNames = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, i, 15)),
  ),
);
function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
  }).format(new Date());
}

/** Month grid for "YYYY-MM-DD" values. */
export function DatePicker(props: FieldProps & { min?: string; max?: string }) {
  const { value, onChange, min, max } = props;
  const changed = useFormChanged();
  const [open, setOpen] = useState(false);
  const base = value || todayIso();
  const [view, setView] = useState(base.slice(0, 7));
  const [year, month] = view.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setView(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  };
  const today = todayIso();
  const label = value
    ? new Intl.DateTimeFormat("it-IT", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value + "T12:00:00Z"))
    : "";
  const pick = (iso: string) => {
    onChange(iso);
    changed();
    setOpen(false);
  };
  return (
    <PickerShell
      {...props}
      aria={splitAria(props)}
      label={label}
      icon={CalendarDays}
      open={open}
      setOpen={(next) => {
        if (next) setView((value || todayIso()).slice(0, 7));
        setOpen(next);
      }}
    >
      <div className="w-[264px]">
        <div className="mb-1 flex items-center justify-between pl-2">
          <span className="text-sm font-medium capitalize">
            {monthNames[month - 1]} {year}
          </span>
          <span className="flex">
            <button
              type="button"
              aria-label="Mese precedente"
              className={cn(cell, "size-8")}
              onClick={() => shift(-1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Mese successivo"
              className={cn(cell, "size-8")}
              onClick={() => shift(1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {weekdays.map((d) => (
            <span
              key={d}
              className="flex h-8 items-center justify-center text-xs text-muted-foreground"
            >
              {d}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`e${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const iso = `${view}-${pad(i + 1)}`;
            const selected = iso === value;
            return (
              <button
                key={iso}
                type="button"
                aria-label={new Intl.DateTimeFormat("it-IT", {
                  dateStyle: "full",
                  timeZone: "UTC",
                }).format(new Date(iso + "T12:00:00Z"))}
                aria-pressed={selected}
                disabled={Boolean((min && iso < min) || (max && iso > max))}
                className={cn(
                  cell,
                  "h-8",
                  selected
                    ? selectedCell
                    : iso === today &&
                        "font-semibold underline underline-offset-4",
                )}
                onClick={() => pick(iso)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between border-t pt-2">
          <button
            type="button"
            className={cn(cell, "h-8 px-2.5 text-[13px] font-medium")}
            onClick={() => pick(today)}
          >
            Oggi
          </button>
          {!props.required && value && (
            <button
              type="button"
              className={cn(
                cell,
                "h-8 px-2.5 text-[13px] text-muted-foreground",
              )}
              onClick={() => pick("")}
            >
              Cancella
            </button>
          )}
        </div>
      </div>
    </PickerShell>
  );
}

/** Two scrolling columns for "HH:MM" values. */
export function TimePicker(props: FieldProps & { minuteStep?: number }) {
  const { value, onChange, minuteStep = 5 } = props;
  const changed = useFormChanged();
  const [open, setOpen] = useState(false);
  const [h, m] = (value || "").split(":");
  const minutes = Array.from(
    new Set([
      ...Array.from({ length: 60 / minuteStep }, (_, i) => pad(i * minuteStep)),
      ...(m ? [m] : []),
    ]),
  ).sort();
  const set = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`);
    changed();
  };
  const columns = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      columns.current
        ?.querySelectorAll<HTMLElement>("[aria-pressed=true]")
        .forEach((el) => el.scrollIntoView({ block: "center" })),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const column = (
    items: string[],
    current: string | undefined,
    choose: (v: string) => void,
    label: string,
  ) => (
    <div
      role="group"
      aria-label={label}
      className="flex h-56 w-14 flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:none]"
    >
      {items.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={item === current}
          className={cn(cell, "h-8 shrink-0", item === current && selectedCell)}
          onClick={() => choose(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
  return (
    <PickerShell
      {...props}
      aria={splitAria(props)}
      label={value}
      icon={Clock3}
      open={open}
      setOpen={setOpen}
    >
      <div ref={columns} className="flex gap-1">
        {column(
          Array.from({ length: 24 }, (_, i) => pad(i)),
          h,
          (hour) => set(hour, m ?? "00"),
          "Ore",
        )}
        <span className="w-px bg-border" />
        {column(
          minutes,
          m,
          (minute) => {
            set(h ?? "00", minute);
            setOpen(false);
          },
          "Minuti",
        )}
      </div>
    </PickerShell>
  );
}

/** Year navigation and a month grid for "YYYY-MM" values. */
export function MonthPicker(props: FieldProps) {
  const { value, onChange } = props;
  const changed = useFormChanged();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number((value || todayIso()).slice(0, 4)));
  const label = value
    ? `${monthNames[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}`
    : "";
  return (
    <PickerShell
      {...props}
      aria={splitAria(props)}
      label={label}
      icon={CalendarDays}
      open={open}
      setOpen={(next) => {
        if (next) setYear(Number((value || todayIso()).slice(0, 4)));
        setOpen(next);
      }}
      className={cn(
        "[&>span:first-child]:first-letter:uppercase",
        props.className,
      )}
    >
      <div className="w-[240px]">
        <div className="mb-1 flex items-center justify-between pl-2">
          <span className="text-sm font-medium tabular-nums">{year}</span>
          <span className="flex">
            <button
              type="button"
              aria-label="Anno precedente"
              className={cn(cell, "size-8")}
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Anno successivo"
              className={cn(cell, "size-8")}
              onClick={() => setYear((y) => y + 1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {monthNames.map((name, i) => {
            const iso = `${year}-${pad(i + 1)}`;
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={iso === value}
                className={cn(
                  cell,
                  "h-9 capitalize",
                  iso === value && selectedCell,
                )}
                onClick={() => {
                  onChange(iso);
                  changed();
                  setOpen(false);
                }}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>
    </PickerShell>
  );
}
