"use client";
import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns3,
  Group,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import { StudentIdentity } from "./student-identity";
import { studentAccessLabel } from "@/modules/crm/student-access";
import { StudentDataGrid } from "./student-data-grid";
import { PropertyEditor } from "@/modules/crm/property-manager";
import { StudentProfileSheet } from "@/modules/crm/student-profile-sheet";
import {
  groupStudents,
  pageStudentGroups,
  availableStudentColumns,
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
  const [mobileGrid, setMobileGrid] = useState(false);
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
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );
  const properties = state.properties.filter((p) => !p.archived);
  const columns = [
    ...availableStudentColumns(state.properties),
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
  const filterCount = config.filters.length + Number(config.tier !== "all");
  const searched = Boolean(query.trim()) || filterCount > 0;
  const search = (value: string) => {
    setQuery(value);
    setInteraction(null);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => void setConfig({ query: value }),
      350,
    );
  };
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
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border bg-card"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-4">
        <div className="relative w-full min-w-0 sm:mr-auto sm:min-w-52 sm:max-w-sm sm:flex-1">
          <Search
            className="absolute top-3 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchInput}
            aria-label="Cerca studenti"
            placeholder="Cerca nome o email…"
            className="rounded-xl bg-subtle pr-11 pl-9"
            value={query}
            onChange={(event) => search(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
              aria-label="Cancella ricerca"
              onClick={() => {
                search("");
                searchInput.current?.focus();
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-10 md:hidden"
          onClick={() => setMobileGrid((value) => !value)}
        >
          {mobileGrid ? <List /> : <Table2 />}
          {mobileGrid ? "Elenco" : "Tabella"}
        </Button>
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
                aria-label={label}
                variant={active ? "secondary" : "outline"}
                className="h-10 rounded-xl px-2.5 sm:px-3.5"
                disabled={saving}
                ref={(element) => {
                  panelTriggers.current[kind] = element;
                }}
              >
                <Icon className="size-4" />
                <span className={kind === "filters" ? "" : "hidden sm:inline"}>
                  {label}
                </span>
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
                className="z-50 max-h-[min(650px,var(--radix-popover-content-available-height))] w-[440px] max-w-[calc(100vw-24px)] space-y-4 overflow-y-auto rounded-xl border bg-card p-4 shadow-xl outline-none"
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
                <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background pt-3">
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
      {error && (
        <div className="px-4 py-2">
          <FormError message={error} />
        </div>
      )}
      {!shown.length ? (
        <div className="grid min-h-56 flex-1 place-items-center overflow-y-auto p-5 text-center">
          <div>
            <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
              {searched ? (
                <Search className="size-5" />
              ) : (
                <Users className="size-5" />
              )}
            </span>
            <p className="text-base font-semibold">
              {searched ? "Nessun risultato" : "Nessuno studente in elenco"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searched
                ? "Prova un altro nome o rimuovi i filtri."
                : "Aggiungi la prima scheda studente."}
            </p>
            {searched ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                disabled={saving}
                onClick={() => {
                  if (searchTimer.current) clearTimeout(searchTimer.current);
                  setQuery("");
                  setInteraction(null);
                  void setConfig({ query: "", filters: [], tier: "all" });
                }}
              >
                Azzera ricerca e filtri
              </Button>
            ) : (
              onAdd && (
                <Button type="button" className="mt-4" onClick={onAdd}>
                  <Plus /> Aggiungi studente
                </Button>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          {!mobileGrid && (
            <div className="min-h-0 flex-1 overflow-auto md:hidden">
              {groups.map((group) => (
                <section
                  key={group.key}
                  aria-label={config.groupBy ? group.label : undefined}
                >
                  {config.groupBy && (
                    <h2 className="sticky top-0 z-10 border-y bg-subtle px-4 py-2 text-xs font-semibold">
                      {group.label}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {group.total}
                      </span>
                    </h2>
                  )}
                  <ul className="divide-y border-b">
                    {group.students.map((student) => (
                      <li key={student.id}>
                        <button
                          type="button"
                          className="flex min-h-16 w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-subtle focus-visible:outline-offset-[-3px]"
                          aria-label={`Apri scheda di ${student.firstName} ${student.lastName}`}
                          onClick={() =>
                            setInteraction({ kind: "student", id: student.id })
                          }
                        >
                          <span className="min-w-0 flex-1">
                            <StudentIdentity student={student} />
                          </span>
                          <span className="max-w-24 text-right text-[11px] leading-tight text-muted-foreground">
                            {studentAccessLabel(student)}
                          </span>
                          <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <div
            className={`min-h-0 flex-1 flex-col ${mobileGrid ? "flex" : "hidden md:flex"}`}
          >
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
              onConfig={setConfig}
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
            />
          </div>
        </>
      )}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
        <p role="status" className="text-[13px] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "studente" : "studenti"}
          {searched &&
            ` · ${state.students.filter((student) => !student.archived).length} in elenco`}
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
