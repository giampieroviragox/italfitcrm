"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { DropdownMenu } from "radix-ui";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { studentAccessLabel } from "@/modules/crm/student-access";
import { StudentTierBadges } from "./tier-badge";
import { StudentGridCell } from "@/modules/crm/student-grid-cell";
import {
  studentColumns,
  moveColumn,
  placeColumn,
  type StudentGroup,
} from "@/modules/crm/student-grid";
import {
  formatPropertyValue,
  propertyTypes,
  type CrmProperty,
  type CrmStudent,
  type CrmTier,
  type DirectoryConfig,
} from "@/modules/crm/model";
import {
  columnDragOffsets,
  columnDragScrollSpeed,
} from "@/modules/crm/column-drag";
import { formatDate } from "@/lib/format";

const menuItem =
  "flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] outline-none focus:bg-muted data-disabled:pointer-events-none data-disabled:opacity-40";
export function StudentDataGrid({
  students,
  tiers,
  properties,
  config,
  saving,
  offset,
  groups,
  activeCell,
  onCellChange,
  onOpenStudent,
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
  groups: readonly StudentGroup[];
  activeCell: { studentId: string; column: string } | null;
  onCellChange: (studentId: string, column: string, open: boolean) => void;
  onOpenStudent: (id: string) => void;
  onConfig: (patch: Partial<DirectoryConfig>) => Promise<boolean>;
  onAddField: () => void;
  onEditField: (p: CrmProperty) => void;
  onFilter: (p: CrmProperty) => void;
  onAdd?: () => void;
}) {
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    widths: Record<string, number>;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    side: "before" | "after";
  } | null>(null);
  const dragStart = useRef<{
    id: string;
    x: number;
    y: number;
    active: boolean;
    scrollLeft: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    headers: { id: string; left: number; width: number }[];
  } | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const ghost = useRef<HTMLDivElement>(null);
  const animationFrame = useRef<number | null>(null);
  const [pendingColumns, setPendingColumns] = useState<string[] | null>(null);
  useEffect(
    () => () => {
      if (animationFrame.current !== null)
        cancelAnimationFrame(animationFrame.current);
    },
    [],
  );
  const dropRef = useRef<typeof dropTarget>(null);
  const scrollRegion = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    width: number;
  } | null>(null);
  const menuOpensPanel = useRef(false);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const visibleColumns = pendingColumns ?? config.columns;
  const columns = ["name", ...visibleColumns];
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
  const offsets =
    drag && dropTarget
      ? columnDragOffsets(
          visibleColumns,
          drag.widths,
          drag.id,
          dropTarget.id,
          dropTarget.side,
        )
      : {};
  const columnMotion = (id: string): CSSProperties => ({
    transform:
      drag && id !== drag.id && offsets[id]
        ? `translate3d(${offsets[id]}px,0,0)`
        : undefined,
    transition: drag ? undefined : "none",
  });
  const stopDrag = () => {
    if (animationFrame.current !== null)
      cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
    dragStart.current = null;
    dropRef.current = null;
    setDrag(null);
    setDropTarget(null);
  };
  const animateDrag = (time: number, previousTime = time, schedule = true) => {
    const start = dragStart.current;
    const region = scrollRegion.current;
    if (!start?.active || !region) return;
    const { x, y } = pointer.current;
    if (ghost.current)
      ghost.current.style.transform = `translate3d(${x + 14}px,${y - 24}px,0) rotate(6deg)`;
    const withinHeader = y >= start.top - 32 && y <= start.bottom + 48;
    if (withinHeader)
      region.scrollLeft +=
        (columnDragScrollSpeed(x, start.left, start.right) *
          Math.min(32, time - previousTime)) /
        1000;
    const scrollDelta = region.scrollLeft - start.scrollLeft;
    const target =
      withinHeader && x >= start.left && x <= start.right
        ? start.headers.find(
            (header) =>
              x >= header.left - scrollDelta &&
              x <= header.left + header.width - scrollDelta,
          )
        : undefined;
    const next =
      target && target.id !== start.id
        ? {
            id: target.id,
            side:
              x < target.left - scrollDelta + target.width / 2
                ? ("before" as const)
                : ("after" as const),
          }
        : null;
    if (
      next?.id !== dropRef.current?.id ||
      next?.side !== dropRef.current?.side
    ) {
      dropRef.current = next;
      setDropTarget(next);
    }
    if (schedule)
      animationFrame.current = requestAnimationFrame((nextTime) =>
        animateDrag(nextTime, time),
      );
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {drag &&
        createPortal(
          <div
            ref={ghost}
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 z-[100] flex w-52 will-change-transform items-center gap-3 rounded-xl border border-primary/20 bg-card px-4 py-3 text-sm font-medium shadow-xl"
            style={{
              transform: `translate3d(${drag.x + 14}px,${drag.y - 24}px,0) rotate(6deg)`,
            }}
          >
            <GripVertical className="size-4 text-muted-foreground" />
            {labelFor(drag.id)}
          </div>,
          document.body,
        )}
      <div
        ref={scrollRegion}
        className="min-h-0 flex-1 overflow-auto overscroll-x-contain"
        role="region"
        aria-label="Griglia studenti"
        tabIndex={0}
      >
        <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">
            Una riga per studente. Usa i menu delle colonne per ordinare,
            filtrare e gestire i campi.
          </caption>
          <colgroup>
            <col style={{ width: 44 }} />
            {columns.map((id) => (
              <col key={id} style={{ width: widthFor(id) }} />
            ))}
            <col style={{ width: 64 }} />
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 h-10 w-[44px] border-b bg-background px-3">
                <span className="sr-only">Numero riga</span>
              </th>
              {columns.map((id) => {
                const property = propertyFor(id);
                const type =
                  property?.type ??
                  studentColumns.find((c) => c.id === id)?.type ??
                  "text";
                const index = config.columns.indexOf(id);
                const sortable = type !== "multiselect";
                return (
                  <th
                    key={id}
                    scope="col"
                    data-column-id={id}
                    style={{
                      width: widthFor(id),
                      minWidth: widthFor(id),
                      maxWidth: widthFor(id),
                      ...columnMotion(id),
                    }}
                    aria-sort={
                      config.sortKey === id
                        ? config.sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={`group/head relative h-10 border-b bg-background text-left font-medium text-muted-foreground transition-[transform,opacity,box-shadow] duration-150 ease-out motion-reduce:transition-none ${id === "name" ? "z-30 sm:sticky sm:left-[44px]" : ""} ${dropTarget?.id === id ? (dropTarget.side === "before" ? "shadow-[inset_3px_0_0_var(--primary)]" : "shadow-[inset_-3px_0_0_var(--primary)]") : ""} ${drag?.id === id ? "opacity-20" : ""}`}
                  >
                    <div className="flex items-center gap-1 px-2">
                      {id !== "name" && (
                        <button
                          type="button"
                          disabled={saving}
                          title={`Trascina ${labelFor(id)}`}
                          aria-label={`Sposta colonna ${labelFor(id)}`}
                          className="flex h-9 w-5 shrink-0 touch-none items-center justify-center rounded cursor-grab text-muted-foreground opacity-0 outline-none group-hover/head:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
                          onPointerDown={(e) => {
                            if (e.button !== 0 || saving || pendingColumns)
                              return;
                            const region = scrollRegion.current;
                            if (!region) return;
                            e.preventDefault();
                            e.currentTarget.focus();
                            e.currentTarget.setPointerCapture(e.pointerId);
                            const rect = region.getBoundingClientRect();
                            const headerRect = e.currentTarget
                              .closest("th")!
                              .getBoundingClientRect();
                            const nameHeader =
                              region.querySelector<HTMLElement>(
                                '[data-column-id="name"]',
                              );
                            const left =
                              nameHeader &&
                              getComputedStyle(nameHeader).position === "sticky"
                                ? nameHeader.getBoundingClientRect().right
                                : rect.left;
                            pointer.current = { x: e.clientX, y: e.clientY };
                            dragStart.current = {
                              id,
                              x: e.clientX,
                              y: e.clientY,
                              active: false,
                              scrollLeft: region.scrollLeft,
                              left,
                              right: rect.right,
                              top: headerRect.top,
                              bottom: headerRect.bottom,
                              headers: Array.from(
                                region.querySelectorAll<HTMLElement>(
                                  "[data-column-id]",
                                ),
                              )
                                .filter(
                                  (header) =>
                                    header.dataset.columnId !== "name",
                                )
                                .map((header) => ({
                                  id: header.dataset.columnId!,
                                  left: header.getBoundingClientRect().left,
                                  width: header.getBoundingClientRect().width,
                                })),
                            };
                          }}
                          onPointerMove={(e) => {
                            pointer.current = { x: e.clientX, y: e.clientY };
                            const start = dragStart.current;
                            if (
                              !start ||
                              start.active ||
                              Math.hypot(
                                e.clientX - start.x,
                                e.clientY - start.y,
                              ) < 5
                            )
                              return;
                            start.active = true;
                            setDrag({
                              id,
                              x: e.clientX,
                              y: e.clientY,
                              widths: Object.fromEntries(
                                start.headers.map((header) => [
                                  header.id,
                                  header.width,
                                ]),
                              ),
                            });
                            animationFrame.current =
                              requestAnimationFrame(animateDrag);
                          }}
                          onPointerUp={(e) => {
                            pointer.current = { x: e.clientX, y: e.clientY };
                            if (dragStart.current?.active)
                              animateDrag(
                                performance.now(),
                                performance.now(),
                                false,
                              );
                            const target = dropRef.current;
                            if (
                              dragStart.current?.active &&
                              target &&
                              !saving
                            ) {
                              const next = placeColumn(
                                visibleColumns,
                                id,
                                target.id,
                                target.side,
                              );
                              if (
                                next.some(
                                  (column, i) => column !== visibleColumns[i],
                                )
                              ) {
                                setPendingColumns(next);
                                void onConfig({ columns: next }).finally(() =>
                                  setPendingColumns(null),
                                );
                              }
                            }
                            stopDrag();
                            if (e.currentTarget.hasPointerCapture(e.pointerId))
                              e.currentTarget.releasePointerCapture(
                                e.pointerId,
                              );
                          }}
                          onPointerCancel={stopDrag}
                          onLostPointerCapture={stopDrag}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              stopDrag();
                            }
                            if (
                              !saving &&
                              (e.key === "ArrowLeft" || e.key === "ArrowRight")
                            ) {
                              e.preventDefault();
                              const to =
                                config.columns[
                                  index + (e.key === "ArrowRight" ? 1 : -1)
                                ];
                              if (to)
                                onConfig({
                                  columns: moveColumn(config.columns, id, to),
                                });
                            }
                          }}
                        >
                          <GripVertical className="size-3" />
                        </button>
                      )}
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className="flex h-10 min-w-0 flex-1 items-center gap-2 text-left outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
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
                            <ChevronDown className="size-3 shrink-0 opacity-0 transition-opacity group-hover/head:opacity-100" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            onCloseAutoFocus={(event) => {
                              if (menuOpensPanel.current) {
                                event.preventDefault();
                                menuOpensPanel.current = false;
                              }
                            }}
                            align="start"
                            sideOffset={4}
                            className="z-50 min-w-56 rounded-xl border bg-card p-1 shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
                          >
                            <DropdownMenu.Label className="px-3 py-2 text-[11px] text-muted-foreground">
                              {propertyTypes[type]}
                            </DropdownMenu.Label>
                            {property && (
                              <DropdownMenu.Item
                                className={menuItem}
                                onSelect={() => {
                                  menuOpensPanel.current = true;
                                  onEditField(property);
                                }}
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
                                onSelect={() => {
                                  menuOpensPanel.current = true;
                                  onFilter(property);
                                }}
                              >
                                Filtra per questo campo
                              </DropdownMenu.Item>
                            )}
                            {id !== "name" &&
                              !["multiselect", "textarea"].includes(type) && (
                                <DropdownMenu.Item
                                  className={menuItem}
                                  onSelect={() => onConfig({ groupBy: id })}
                                >
                                  Raggruppa per questo campo
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
              <th className="border-b bg-background px-2">
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
          {!students.length && (
            <tbody>
              <tr>
                <td colSpan={columns.length + 2} className="px-5 py-16">
                  <div className="sticky left-5 mx-auto flex max-w-sm flex-col items-center text-center">
                    <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-foreground/[.045]">
                      <Users className="size-5" strokeWidth={1.75} />
                    </span>
                    <p className="text-base font-medium text-foreground">
                      Nessuno studente
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Aggiungi la prima scheda o modifica ricerca e filtri.
                    </p>
                    {onAdd && !config.archived && (
                      <Button className="mt-5" onClick={onAdd}>
                        <Plus className="size-4" />
                        Aggiungi studente
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          )}
          {groups.map((group) => (
            <tbody
              key={group.key}
              aria-label={config.groupBy ? group.label : undefined}
            >
              {config.groupBy && (
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={columns.length + 2}
                    className="border-b bg-subtle px-3 py-2.5 text-left font-medium"
                  >
                    <span className="sticky left-3 inline-flex items-center gap-2">
                      {group.label}
                      <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                        {group.total}
                      </span>
                    </span>
                  </th>
                </tr>
              )}
              {group.students.map((student) => (
                <tr key={student.id} className="group bg-background">
                  <td className="sticky left-0 z-10 border-b bg-inherit px-2 text-center text-[11px] tabular-nums text-muted-foreground">
                    {offset +
                      students.findIndex((s) => s.id === student.id) +
                      1}
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
                                className="rounded-full bg-foreground/[.045] px-2 py-0.5 text-xs"
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
                        <StudentTierBadges student={student} tiers={tiers} />
                      );
                    else if (id === "access")
                      value = (
                        <span className="text-[13px] text-muted-foreground">
                          {studentAccessLabel(student)}
                        </span>
                      );
                    else if (id === "joinedAt")
                      value = formatDate(student.joinedAt);
                    else
                      value = student[id as "email" | "phone" | "coach"] || "—";
                    return (
                      <td
                        key={id}
                        style={{
                          width: widthFor(id),
                          maxWidth: widthFor(id),
                          ...columnMotion(id),
                          opacity: drag?.id === id ? 0.2 : undefined,
                        }}
                        className={`overflow-hidden border-b bg-background transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none group-hover:bg-subtle ${id === "name" ? "z-10 bg-inherit sm:sticky sm:left-[44px]" : ""}`}
                      >
                        <div className="flex items-center">
                          {id === "name" ? (
                            <button
                              type="button"
                              onClick={() => onOpenStudent(student.id)}
                              aria-label={`Apri scheda di ${student.firstName} ${student.lastName}`}
                              className="h-11 w-full truncate px-3 text-left text-[13px] font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                            >
                              {value}
                            </button>
                          ) : (
                            <StudentGridCell
                              student={student}
                              column={id}
                              label={labelFor(id)}
                              property={property}
                              tiers={tiers}
                              open={
                                activeCell?.studentId === student.id &&
                                activeCell.column === id
                              }
                              onOpenChange={(open) =>
                                onCellChange(student.id, id, open)
                              }
                            >
                              {value}
                            </StudentGridCell>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="border-b bg-muted/10" />
                </tr>
              ))}
            </tbody>
          ))}
          {onAdd && !config.archived && students.length > 0 && (
            <tbody>
              <tr>
                <td className="border-b px-3 text-center text-muted-foreground">
                  <Plus className="mx-auto size-3.5" />
                </td>
                <td colSpan={columns.length + 1} className="border-b">
                  <button
                    className="flex h-10 w-full items-center px-3 text-left text-[13px] text-muted-foreground hover:bg-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    onClick={onAdd}
                  >
                    Aggiungi studente
                  </button>
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
