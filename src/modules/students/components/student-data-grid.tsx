"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  CircleDot,
  GripVertical,
  Hash,
  Link2,
  ListFilter,
  Mail,
  Phone,
  Plus,
  Type,
  WrapText,
  type LucideIcon,
} from "lucide-react";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { StudentGridCell } from "@/modules/crm/student-grid-cell";
import { studentColumns, moveColumn } from "@/modules/crm/student-grid";
import {
  formatPropertyValue,
  propertyTypes,
  type CrmProperty,
  type CrmStudent,
  type CrmTier,
  type DirectoryConfig,
  type PropertyType,
} from "@/modules/crm/model";
import { formatDate } from "@/lib/format";

const typeIcons: Record<PropertyType, LucideIcon> = {
  text: Type,
  textarea: WrapText,
  number: Hash,
  date: CalendarDays,
  select: CircleDot,
  radio: CircleDot,
  multiselect: ListFilter,
  boolean: CheckSquare,
  url: Link2,
  email: Mail,
  phone: Phone,
};
const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs outline-none focus:bg-muted data-disabled:pointer-events-none data-disabled:opacity-40";
export function StudentDataGrid({
  students,
  tiers,
  properties,
  config,
  saving,
  offset,
  selection,
  onConfig,
  onAddField,
  onEditField,
  onFilter,
  onAdd,
}: {
  students: readonly CrmStudent[];
  tiers: readonly CrmTier[];
  properties: readonly CrmProperty[];
  config: DirectoryConfig;
  saving: boolean;
  offset: number;
  selection: {
    selectedIds: string[];
    onToggle: (id: string, checked: boolean) => void;
    onTogglePage: (checked: boolean) => void;
  };
  onConfig: (patch: Partial<DirectoryConfig>) => void;
  onAddField: () => void;
  onEditField: (p: CrmProperty) => void;
  onFilter: (p: CrmProperty) => void;
  onAdd?: () => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    width: number;
  } | null>(null);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const columns = ["name", ...config.columns];
  const checked =
    students.length > 0 &&
    students.every((s) => selection.selectedIds.includes(s.id));
  const mixed =
    !checked && students.some((s) => selection.selectedIds.includes(s.id));
  const propertyFor = (id: string) =>
    properties.find((p) => `property:${p.id}` === id);
  const labelFor = (id: string) =>
    id === "name"
      ? "Studente"
      : (propertyFor(id)?.name ??
        studentColumns.find((c) => c.id === id)?.name ??
        id);
  const widthFor = (id: string) =>
    resizing?.id === id
      ? resizing.width
      : (config.columnWidths?.[id] ?? (id === "name" ? 260 : 200));
  return (
    <div className="overflow-hidden">
      <p className="border-b bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
        Fai clic su una cella per modificarla. Trascina le colonne per
        riordinarle o il bordo per ridimensionarle.
      </p>
      <div
        className="max-h-[65vh] min-h-60 overflow-auto overscroll-x-contain"
        role="region"
        aria-label="Griglia studenti"
        tabIndex={0}
      >
        <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-xs">
          <caption className="sr-only">
            Una riga per studente. Usa i menu delle colonne per ordinare,
            filtrare e gestire i campi.
          </caption>
          <colgroup>
            <col style={{ width: 72 }} />
            {columns.map((id) => (
              <col key={id} style={{ width: widthFor(id) }} />
            ))}
            <col style={{ width: 64 }} />
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 h-11 w-[72px] border-r border-b bg-[#f6f7f8] px-3">
                <CheckboxControl
                  aria-label="Seleziona pagina"
                  aria-checked={mixed ? "mixed" : checked}
                  checked={checked}
                  onChange={(e) => selection.onTogglePage(e.target.checked)}
                />
              </th>
              {columns.map((id) => {
                const property = propertyFor(id);
                const type =
                  property?.type ??
                  studentColumns.find((c) => c.id === id)?.type ??
                  "text";
                const Icon = typeIcons[type];
                const index = config.columns.indexOf(id);
                const sortable = type !== "multiselect";
                return (
                  <th
                    key={id}
                    scope="col"
                    style={{
                      width: widthFor(id),
                      minWidth: widthFor(id),
                      maxWidth: widthFor(id),
                    }}
                    aria-sort={
                      config.sortKey === id
                        ? config.sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={`relative h-11 border-r border-b bg-[#f6f7f8] text-left font-medium ${id === "name" ? "z-30 sm:sticky sm:left-[72px]" : ""} ${dropTarget === id ? "shadow-[inset_3px_0_0_var(--primary)]" : ""} ${dragging === id ? "opacity-50" : ""}`}
                    onDragOver={(e) => {
                      if (dragging && id !== "name") {
                        e.preventDefault();
                        setDropTarget(id);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging && id !== "name")
                        onConfig({
                          columns: moveColumn(config.columns, dragging, id),
                        });
                      setDragging(null);
                      setDropTarget(null);
                    }}
                  >
                    <div className="flex items-center gap-1 px-2">
                      {id !== "name" && (
                        <span
                          draggable={!saving}
                          title={`Trascina ${labelFor(id)}`}
                          aria-hidden="true"
                          className="cursor-grab text-muted-foreground active:cursor-grabbing"
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", id);
                            setDragging(id);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropTarget(null);
                          }}
                        >
                          <GripVertical className="size-3" />
                        </span>
                      )}
                      <Icon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className="flex h-10 min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Menu colonna ${labelFor(id)}`}
                            disabled={saving}
                          >
                            <span className="flex-1 truncate">
                              {labelFor(id)}
                            </span>
                            {config.sortKey === id &&
                              (config.sortDirection === "asc" ? (
                                <ArrowUp className="size-3 text-primary" />
                              ) : (
                                <ArrowDown className="size-3 text-primary" />
                              ))}
                            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="start"
                            sideOffset={4}
                            className="z-50 min-w-56 rounded-xl border bg-white p-1.5 shadow-xl"
                          >
                            <DropdownMenu.Label className="px-3 py-2 text-[11px] text-muted-foreground">
                              {propertyTypes[type]}
                            </DropdownMenu.Label>
                            {property && (
                              <DropdownMenu.Item
                                className={menuItem}
                                onSelect={() => onEditField(property)}
                              >
                                Modifica campo
                              </DropdownMenu.Item>
                            )}
                            <DropdownMenu.Item
                              disabled={!sortable}
                              className={menuItem}
                              onSelect={() =>
                                onConfig({ sortKey: id, sortDirection: "asc" })
                              }
                            >
                              <ArrowUp className="size-3.5" />
                              Ordina crescente
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              disabled={!sortable}
                              className={menuItem}
                              onSelect={() =>
                                onConfig({ sortKey: id, sortDirection: "desc" })
                              }
                            >
                              <ArrowDown className="size-3.5" />
                              Ordina decrescente
                            </DropdownMenu.Item>
                            {property && (
                              <DropdownMenu.Item
                                className={menuItem}
                                onSelect={() => onFilter(property)}
                              >
                                Filtra per questo campo
                              </DropdownMenu.Item>
                            )}
                            {id !== "name" && (
                              <>
                                <DropdownMenu.Separator className="my-1 border-t" />
                                <DropdownMenu.Item
                                  disabled={index === 0}
                                  className={menuItem}
                                  onSelect={() =>
                                    onConfig({
                                      columns: moveColumn(
                                        config.columns,
                                        id,
                                        config.columns[index - 1]!,
                                      ),
                                    })
                                  }
                                >
                                  Sposta a sinistra
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  disabled={index === config.columns.length - 1}
                                  className={menuItem}
                                  onSelect={() =>
                                    onConfig({
                                      columns: moveColumn(
                                        config.columns,
                                        id,
                                        config.columns[index + 1]!,
                                      ),
                                    })
                                  }
                                >
                                  Sposta a destra
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  className={menuItem}
                                  onSelect={() =>
                                    onConfig({
                                      columns: config.columns.filter(
                                        (c) => c !== id,
                                      ),
                                    })
                                  }
                                >
                                  Nascondi campo
                                </DropdownMenu.Item>
                              </>
                            )}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                    <div
                      role="separator"
                      aria-label={`Larghezza colonna ${labelFor(id)}`}
                      aria-orientation="vertical"
                      aria-valuemin={140}
                      aria-valuemax={560}
                      aria-valuenow={widthFor(id)}
                      tabIndex={0}
                      className="absolute top-0 right-0 z-40 h-full w-1.5 touch-none cursor-col-resize outline-none hover:bg-primary/40 focus-visible:bg-primary"
                      onKeyDown={(e) => {
                        if (
                          saving ||
                          !["ArrowLeft", "ArrowRight"].includes(e.key)
                        )
                          return;
                        e.preventDefault();
                        onConfig({
                          columnWidths: {
                            ...config.columnWidths,
                            [id]: Math.max(
                              140,
                              Math.min(
                                560,
                                widthFor(id) +
                                  (e.key === "ArrowRight" ? 20 : -20),
                              ),
                            ),
                          },
                        });
                      }}
                      onPointerDown={(e) => {
                        if (saving) return;
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        resizeStart.current = {
                          x: e.clientX,
                          width: widthFor(id),
                        };
                        setResizing({ id, width: widthFor(id) });
                      }}
                      onPointerMove={(e) => {
                        if (
                          resizeStart.current &&
                          e.currentTarget.hasPointerCapture(e.pointerId)
                        )
                          setResizing({
                            id,
                            width: Math.round(
                              Math.max(
                                140,
                                Math.min(
                                  560,
                                  resizeStart.current.width +
                                    e.clientX -
                                    resizeStart.current.x,
                                ),
                              ),
                            ),
                          });
                      }}
                      onPointerUp={(e) => {
                        if (!resizeStart.current) return;
                        const width = Math.round(
                          Math.max(
                            140,
                            Math.min(
                              560,
                              resizeStart.current.width +
                                e.clientX -
                                resizeStart.current.x,
                            ),
                          ),
                        );
                        resizeStart.current = null;
                        setResizing(null);
                        onConfig({
                          columnWidths: { ...config.columnWidths, [id]: width },
                        });
                      }}
                      onPointerCancel={() => {
                        resizeStart.current = null;
                        setResizing(null);
                      }}
                    />
                  </th>
                );
              })}
              <th className="border-b bg-[#f6f7f8] px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Aggiungi campo"
                  onClick={onAddField}
                >
                  <Plus className="size-4" />
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {!students.length && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="border-b px-5 py-10 text-center text-muted-foreground"
                >
                  Nessuno studente in questa vista. Aggiungi una scheda o
                  modifica i filtri.
                </td>
              </tr>
            )}
            {students.map((student, index) => (
              <tr
                key={student.id}
                className={`group ${selection.selectedIds.includes(student.id) ? "bg-primary/5" : "bg-white"}`}
              >
                <td className="sticky left-0 z-10 border-r border-b bg-inherit px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-right text-[10px] tabular-nums text-muted-foreground">
                      {offset + index + 1}
                    </span>
                    <CheckboxControl
                      aria-label={`Seleziona ${student.firstName} ${student.lastName}`}
                      checked={selection.selectedIds.includes(student.id)}
                      onChange={(e) =>
                        selection.onToggle(student.id, e.target.checked)
                      }
                    />
                  </div>
                </td>
                {columns.map((id) => {
                  const property = propertyFor(id);
                  let value;
                  if (property) {
                    const raw = student.properties[property.id];
                    value =
                      property.type === "select" ||
                      property.type === "radio" ||
                      property.type === "multiselect" ? (
                        <span className="inline-flex gap-1">
                          {(Array.isArray(raw)
                            ? raw
                            : typeof raw === "string" && raw
                              ? [raw]
                              : []
                          ).map((v) => (
                            <span
                              key={v}
                              className="rounded bg-sky-100 px-2 py-1 text-[11px] text-sky-900"
                            >
                              {v}
                            </span>
                          ))}
                        </span>
                      ) : (
                        formatPropertyValue(property, raw)
                      );
                  } else if (id === "name")
                    value = (
                      <span className="font-medium">
                        {student.firstName} {student.lastName}
                      </span>
                    );
                  else if (id === "tier")
                    value = (
                      <span className="rounded bg-violet-50 px-2 py-1 text-[11px] text-violet-800">
                        {tiers.find((t) => t.id === student.tierId)?.name ??
                          "—"}
                      </span>
                    );
                  else if (id === "status")
                    value = <StatusBadge status={student.status} />;
                  else if (id === "joinedAt")
                    value = formatDate(student.joinedAt);
                  else
                    value = student[id as "email" | "phone" | "coach"] || "—";
                  return (
                    <td
                      key={id}
                      style={{ width: widthFor(id), maxWidth: widthFor(id) }}
                      className={`overflow-hidden border-r border-b group-hover:bg-muted/20 ${id === "name" ? "z-10 bg-inherit sm:sticky sm:left-[72px]" : ""}`}
                    >
                      <div className="flex items-center">
                        <StudentGridCell
                          student={student}
                          column={id}
                          label={labelFor(id)}
                          property={property}
                          tiers={tiers}
                        >
                          {value}
                        </StudentGridCell>
                        {id === "name" && (
                          <Link
                            href={`/admin/studenti/${encodeURIComponent(student.id)}`}
                            aria-label={`Apri scheda di ${student.firstName} ${student.lastName}`}
                            className="mr-2 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <ArrowUpRight className="size-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="border-b bg-muted/10" />
              </tr>
            ))}
            {onAdd && !config.archived && (
              <tr>
                <td className="border-b px-3 text-center text-muted-foreground">
                  <Plus className="mx-auto size-3.5" />
                </td>
                <td colSpan={columns.length + 1} className="border-b">
                  <button
                    className="flex h-10 w-full items-center px-3 text-left text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    onClick={onAdd}
                  >
                    Aggiungi studente
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
