"use client";
import { CoachSelect } from "./coach-select";
import { TierPicker } from "./tier-picker";
import { studentTierIds } from "./student-tiers";
import { useRef, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import { PropertyField } from "./property-fields";
import { Field, FormError, control } from "./ui";
import { updateCrm, useSaving } from "./store";
import { editStudentCell } from "./student-grid";
import type { CrmProperty, CrmStudent, CrmTier, PropertyValue } from "./model";

export function StudentGridCell({
  student,
  column,
  label,
  property,
  tiers,
  children,
  open,
  onOpenChange,
}: {
  student: CrmStudent;
  column: string;
  label: string;
  property?: CrmProperty;
  tiers: readonly CrmTier[];
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    onOpenChange(false);
    trigger.current?.focus();
  };
  const readOnly =
    student.archived ||
    column === "joinedAt" ||
    column === "access" ||
    (column === "email" && !!student.access);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          disabled={!!readOnly}
          aria-label={`${readOnly ? "Visualizza" : "Modifica"} ${label} di ${student.firstName} ${student.lastName}`}
          title={
            column === "email" && student.access
              ? "Email collegata all’account personale"
              : readOnly
                ? "Campo in sola lettura"
                : "Fai clic per modificare"
          }
          className="flex min-h-11 py-1 w-full min-w-0 items-center overflow-hidden px-3 text-left text-[13px] outline-none hover:bg-foreground/[.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span
            className={
              column === "tier"
                ? "block w-full whitespace-normal"
                : "block w-full truncate"
            }
          >
            {children}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={-1}
          collisionPadding={12}
          className="z-50 max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border bg-card p-4 shadow-xl outline-none"
          aria-label={`Modifica ${label}`}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={() => trigger.current?.focus()}
        >
          <CellForm
            student={student}
            column={column}
            label={label}
            property={property}
            tiers={tiers}
            close={close}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CellForm({
  student,
  column,
  label,
  property,
  tiers,
  close,
}: {
  student: CrmStudent;
  column: string;
  label: string;
  property?: CrmProperty;
  tiers: readonly CrmTier[];
  close: () => void;
}) {
  const [original] = useState(student);
  const [originalProperty] = useState(JSON.stringify(property));
  const [value, setValue] = useState<PropertyValue>(() => {
    if (property) return student.properties[property.id] ?? "";
    if (column === "name") return student.firstName;
    if (column === "tier") return studentTierIds(student);
    return student[column as "email" | "phone" | "coach" | "status"] ?? "";
  });
  const [lastName, setLastName] = useState(student.lastName);
  const [error, setError] = useState("");
  const saving = useSaving();
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        try {
          await updateCrm((state) => {
            if (
              property &&
              JSON.stringify(
                state.properties.find((p) => p.id === property.id),
              ) !== originalProperty
            )
              throw new Error(
                "La proprietà è stata modificata. Chiudi e riapri la cella.",
              );
            return editStudentCell(state, original, column, value, lastName);
          });
          close();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Salvataggio non riuscito.",
          );
        }
      }}
    >
      <fieldset disabled={saving} className="space-y-4" aria-busy={saving}>
        <p className="truncate text-xs text-muted-foreground">
          {student.firstName} {student.lastName}
        </p>
        {property ? (
          <PropertyField
            property={property}
            value={value}
            onChange={setValue}
          />
        ) : column === "tier" ? (
          <TierPicker
            tiers={tiers}
            value={Array.isArray(value) ? value : []}
            onChange={setValue}
          />
        ) : column === "coach" ? (
          <CoachSelect value={String(value)} onChange={setValue} />
        ) : (
          <>
            <Field label={column === "name" ? "Nome" : label}>
              <input
                className={control}
                required={column === "name" || column === "email"}
                type={
                  column === "email"
                    ? "email"
                    : column === "phone"
                      ? "tel"
                      : "text"
                }
                value={String(value)}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            {column === "name" && (
              <Field label="Cognome">
                <input
                  className={control}
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
            )}
          </>
        )}
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" type="button" onClick={close}>
            Annulla
          </Button>
          <Button size="sm" type="submit">
            {saving ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
