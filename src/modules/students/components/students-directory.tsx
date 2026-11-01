"use client";
import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Group,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import { StudentDataGrid } from "./student-data-grid";
import { PropertyEditor } from "@/modules/crm/property-manager";
import { StudentProfileSheet } from "@/modules/crm/student-profile-sheet";
import {
  groupStudents,
  pageStudentGroups,
  studentColumns,
} from "@/modules/crm/student-grid";
import {
  defaultDirectory,
  type CrmProperty,
  type DirectoryConfig,
} from "@/modules/crm/model";
import {
  operatorsFor,
  sanitizeDirectory,
  selectStudents,
} from "@/modules/crm/logic";
import { updateCrm, useCrm, useSaving } from "@/modules/crm/store";
import { Field, FormError, control } from "@/modules/crm/ui";
import { DirectoryFilters } from "@/modules/crm/directory-filters";

type Panel = "filters" | "columns" | "groups";
type Interaction =
  | { kind: Panel }
  | { kind: "cell"; studentId: string; column: string }
  | { kind: "student"; id: string }
  | { kind: "property"; property?: CrmProperty };

export function StudentsDirectory({ onAdd }: { onAdd?: () => void }) {
  const state = useCrm();
  const saving = useSaving();
  const persisted = sanitizeDirectory(
    state.directory ?? defaultDirectory,
    state,
  );
  const [queryDraft, setQuery] = useState<string | null>(null);
  const query = queryDraft ?? persisted.query;
  const config: DirectoryConfig = {
    ...persisted,
    query,
    archived: false,
    layout: "table",
  };
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [draft, setDraft] = useState(config);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const panelTriggers = useRef<
    Partial<Record<Panel, HTMLButtonElement | null>>
  >({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );
  const properties = state.properties.filter((p) => !p.archived);
  const columns = [
    ...studentColumns,
    ...properties.map((p) => ({ id: `property:${p.id}`, name: p.name })),
  ];
  const groupColumns = columns.filter((c) => {
    const property = properties.find((p) => `property:${p.id}` === c.id);
    return !property || !["textarea", "multiselect"].includes(property.type);
  });
  const setConfig = async (patch: Partial<DirectoryConfig>) => {
    try {
      await updateCrm((current) => ({
        ...current,
        activeViewId: undefined,
        directory: {
          ...(current.directory ?? defaultDirectory),
          ...patch,
          archived: false,
          layout: "table",
        },
      }));
      setPage(1);
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
      return false;
    }
  };
  const filtered = selectStudents(
    state.students,
    config,
    properties,
    state.tiers,
  );
  const pages = Math.max(1, Math.ceil(filtered.length / config.pageSize));
  const currentPage = Math.min(page, pages);
  const groups = pageStudentGroups(
    groupStudents(filtered, config.groupBy, properties, state.tiers),
    (currentPage - 1) * config.pageSize,
    config.pageSize,
  );
  const shown = groups.flatMap((g) => g.students);
  const filterCount =
    config.filters.length +
    Number(config.status !== "all") +
    Number(config.tier !== "all");
  const openPanel = (kind: Panel, open: boolean) => {
    if (open) {
      setDraft(structuredClone(config));
      setInteraction({ kind });
    } else
      setInteraction((current) => (current?.kind === kind ? null : current));
  };
  return (
    <section
      aria-label="Elenco studenti"
      className="min-w-0 overflow-hidden rounded-xl border bg-white"
    >
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative min-w-48 flex-1">
          <Search
            className="absolute top-3 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Cerca studenti"
            placeholder="Cerca studenti…"
            className="pl-9"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              setInteraction(null);
              setPage(1);
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => {
                void setConfig({ query: value });
              }, 350);
            }}
          />
        </div>
        {(
          [
            { kind: "columns", label: "Campi", Icon: Columns3, active: false },
            {
              kind: "filters",
              label: `Filtri${filterCount ? ` (${filterCount})` : ""}`,
              Icon: SlidersHorizontal,
              active: filterCount > 0,
            },
            {
              kind: "groups",
              label: "Raggruppa",
              Icon: Group,
              active: !!config.groupBy,
            },
          ] as const
        ).map(({ kind, label, Icon, active }) => (
          <Popover.Root
            key={kind}
            open={interaction?.kind === kind}
            onOpenChange={(open) => openPanel(kind, open)}
          >
            <Popover.Trigger asChild>
              <Button
                variant={active ? "secondary" : "ghost"}
                size="sm"
                disabled={saving}
                ref={(element) => {
                  panelTriggers.current[kind] = element;
                }}
              >
                <Icon className="size-3.5" />
                {label}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                onCloseAutoFocus={(event) => event.preventDefault()}
                onEscapeKeyDown={() => panelTriggers.current[kind]?.focus()}
                align="end"
                sideOffset={10}
                collisionPadding={12}
                aria-label={
                  kind === "columns"
                    ? "Campi della tabella"
                    : kind === "filters"
                      ? "Filtra studenti"
                      : "Raggruppa studenti"
                }
                className="z-50 max-h-[min(650px,var(--radix-popover-content-available-height))] w-[440px] max-w-[calc(100vw-24px)] space-y-4 overflow-y-auto rounded-xl border bg-white p-4 shadow-xl outline-none"
              >
                <h2 className="text-sm font-semibold">
                  {kind === "columns"
                    ? "Campi della tabella"
                    : kind === "filters"
                      ? "Filtra studenti"
                      : "Raggruppa studenti"}
                </h2>
                {kind === "columns" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInteraction({ kind: "property" })}
                    >
                      <Plus className="size-3.5" />
                      Aggiungi campo
                    </Button>
                    <div className="divide-y">
                      {[
                        ...draft.columns.flatMap((id) => {
                          const column = columns.find((c) => c.id === id);
                          return column ? [column] : [];
                        }),
                        ...columns.filter((c) => !draft.columns.includes(c.id)),
                      ].map((column) => (
                        <div
                          key={column.id}
                          className="flex items-center gap-2 py-2"
                        >
                          <label className="flex min-h-8 min-w-0 flex-1 items-center gap-2 text-xs">
                            <CheckboxControl
                              checked={draft.columns.includes(column.id)}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  columns: e.target.checked
                                    ? [...draft.columns, column.id]
                                    : draft.columns.filter(
                                        (id) => id !== column.id,
                                      ),
                                })
                              }
                            />
                            <span className="truncate">{column.name}</span>
                          </label>
                          {draft.columns.includes(column.id) &&
                            [-1, 1].map((direction) => (
                              <Button
                                key={direction}
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Sposta ${column.name} ${direction < 0 ? "prima" : "dopo"}`}
                                disabled={
                                  draft.columns.indexOf(column.id) + direction <
                                    0 ||
                                  draft.columns.indexOf(column.id) +
                                    direction >=
                                    draft.columns.length
                                }
                                onClick={() => {
                                  const next = [...draft.columns],
                                    from = next.indexOf(column.id),
                                    to = from + direction;
                                  [next[from], next[to]] = [
                                    next[to]!,
                                    next[from]!,
                                  ];
                                  setDraft({ ...draft, columns: next });
                                }}
                              >
                                {direction < 0 ? (
                                  <ChevronUp className="size-3.5" />
                                ) : (
                                  <ChevronDown className="size-3.5" />
                                )}
                              </Button>
                            ))}
                        </div>
                      ))}
                    </div>
                  </>
                ) : kind === "filters" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Stato">
                        <SelectControl
                          className={control}
                          value={draft.status}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              status: e.target
                                .value as DirectoryConfig["status"],
                            })
                          }
                        >
                          <option value="all">Tutti gli stati</option>
                          <option value="active">Attivi</option>
                          <option value="invited">Da attivare</option>
                          <option value="paused">In pausa</option>
                        </SelectControl>
                      </Field>
                      <Field label="Tier">
                        <SelectControl
                          className={control}
                          value={draft.tier}
                          onChange={(e) =>
                            setDraft({ ...draft, tier: e.target.value })
                          }
                        >
                          <option value="all">Tutti i tier</option>
                          {state.tiers
                            .filter((t) => !t.archived || t.id === draft.tier)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </SelectControl>
                      </Field>
                    </div>
                    <DirectoryFilters
                      filters={draft.filters}
                      properties={properties}
                      onChange={(filters) => setDraft({ ...draft, filters })}
                    />
                  </>
                ) : (
                  <Field label="Raggruppa per">
                    <SelectControl
                      className={control}
                      value={draft.groupBy ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, groupBy: e.target.value })
                      }
                    >
                      <option value="">Nessun raggruppamento</option>
                      {groupColumns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </SelectControl>
                  </Field>
                )}
                <FormError message={error} />
                <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-white pt-3">
                  {kind === "filters" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          status: "all",
                          tier: "all",
                          filters: [],
                        })
                      }
                    >
                      Azzera
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openPanel(kind, false);
                      panelTriggers.current[kind]?.focus();
                    }}
                  >
                    Annulla
                  </Button>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={async () => {
                      const applied = await setConfig(
                        kind === "columns"
                          ? { columns: draft.columns }
                          : kind === "filters"
                            ? {
                                status: draft.status,
                                tier: draft.tier,
                                filters: draft.filters,
                              }
                            : { groupBy: draft.groupBy ?? "" },
                      );
                      if (applied) {
                        openPanel(kind, false);
                        panelTriggers.current[kind]?.focus();
                      }
                    }}
                  >
                    Applica
                  </Button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ))}
      </div>
      <FormError message={error} />
      <StudentDataGrid
        students={shown}
        groups={groups}
        tiers={state.tiers}
        properties={properties}
        config={config}
        saving={saving}
        offset={(currentPage - 1) * config.pageSize}
        activeCell={interaction?.kind === "cell" ? interaction : null}
        onCellChange={(studentId, column, open) =>
          setInteraction((current) =>
            open
              ? { kind: "cell", studentId, column }
              : current?.kind === "cell" &&
                  current.studentId === studentId &&
                  current.column === column
                ? null
                : current,
          )
        }
        onConfig={(patch) => {
          void setConfig(patch);
        }}
        onOpenStudent={(id) => setInteraction({ kind: "student", id })}
        onAddField={() => setInteraction({ kind: "property" })}
        onEditField={(property) =>
          setInteraction({ kind: "property", property })
        }
        onFilter={(property) => {
          setDraft({
            ...structuredClone(config),
            filters: [
              ...config.filters,
              {
                id: crypto.randomUUID(),
                propertyId: property.id,
                operator: operatorsFor(property)[0]!.value,
                value: "",
                values: [],
              },
            ],
          });
          setInteraction({ kind: "filters" });
        }}
        onAdd={
          onAdd
            ? () => {
                setInteraction(null);
                onAdd();
              }
            : undefined
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <p role="status" className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "studente" : "studenti"}
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {currentPage} / {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Successiva
            </Button>
          </div>
        )}
      </div>
      {interaction?.kind === "property" && (
        <PropertyEditor
          property={interaction.property}
          showInDirectory
          close={() => setInteraction(null)}
        />
      )}
      {interaction?.kind === "student" && (
        <StudentProfileSheet
          id={interaction.id}
          close={() => setInteraction(null)}
        />
      )}
    </section>
  );
}
