"use client";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import {
  ArrowUpRight,
  LayoutGrid,
  List,
  Search,
  Users,
  SlidersHorizontal,
  Columns3,
  Download,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentsTable } from "./students-table";
import { StudentIdentity } from "./student-identity";
import { StatusBadge } from "./status-badge";
import {
  defaultDirectory,
  type DirectoryConfig,
  type CrmView,
} from "@/modules/crm/model";
import {
  selectStudents,
  sanitizeDirectory,
  bulkUpdate,
} from "@/modules/crm/logic";
import { useCrm, updateCrm, useSaving } from "@/modules/crm/store";
import {
  Editor,
  EditorCancel,
  Field,
  control,
  FormError,
} from "@/modules/crm/ui";
import { ConfirmDialog } from "@/modules/crm/confirm-dialog";
import { DirectoryFilters } from "@/modules/crm/directory-filters";
import { ActionMenu } from "@/components/ui/action-menu";
import { studentsCsv } from "@/modules/crm/csv";
const baseColumns = [
  { id: "tier", name: "Tier" },
  { id: "status", name: "Stato" },
  { id: "joinedAt", name: "Aggiunto il" },
  { id: "phone", name: "Telefono" },
  { id: "coach", name: "Coach" },
];
export function StudentsDirectory({ onAdd }: { onAdd?: () => void }) {
  const state = useCrm();
  const saving = useSaving();
  const properties = state.properties.filter((p) => !p.archived);
  const persisted = sanitizeDirectory(
      state.directory ?? defaultDirectory,
      state,
    ),
    views = state.views ?? [];
  const [query, setQuery] = useState(persisted.query);
  const config = { ...persisted, query };
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );
  const resetSearch = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setQuery(value);
  };
  const [panel, setPanel] = useState<"filters" | "columns" | null>(null);
  const [panelDraft, setPanelDraft] = useState<DirectoryConfig>(config);
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [viewEditor, setViewEditor] = useState<"new" | "rename" | null>(null),
    [deleteView, setDeleteView] = useState(false),
    [confirmArchive, setConfirmArchive] = useState(false),
    [bulkTier, setBulkTier] = useState(""),
    [bulkStatus, setBulkStatus] = useState("");
  const activeView = views.find((v) => v.id === state.activeViewId);
  const dirty =
    activeView && JSON.stringify(activeView.config) !== JSON.stringify(config);
  const run = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita");
      return false;
    }
  };
  const setConfig = (patch: Partial<DirectoryConfig>) =>
    run(async () => {
      await updateCrm((s) => ({
        ...s,
        directory: { ...(s.directory ?? defaultDirectory), ...patch },
      }));
      setPage(1);
      setSelected([]);
    });
  const filtered = selectStudents(
    state.students,
    config,
    properties,
    state.tiers,
  );
  const hasFilters = Boolean(
    config.query.trim() ||
    config.status !== "all" ||
    config.tier !== "all" ||
    config.filters.length,
  );
  const pages = Math.max(1, Math.ceil(filtered.length / config.pageSize)),
    currentPage = Math.min(page, pages),
    shown = filtered.slice(
      (currentPage - 1) * config.pageSize,
      currentPage * config.pageSize,
    );
  const selectedIds = selected.filter((id) =>
    filtered.some((s) => s.id === id),
  );
  const applyBulk = (patch: Parameters<typeof bulkUpdate>[2]) =>
    run(async () => {
      await updateCrm((s) => bulkUpdate(s, selectedIds, patch));
      setSelected([]);
      setBulkStatus("");
      setBulkTier("");
      setConfirmArchive(false);
    });
  const columnOptions = [
    ...baseColumns,
    ...properties.map((p) => ({ id: `property:${p.id}`, name: p.name })),
  ];
  return (
    <section
      aria-label="Elenco studenti"
      className="min-w-0 rounded-xl border bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
        <div
          className="flex max-w-full items-center gap-2 overflow-x-auto"
          aria-label="Viste salvate"
        >
          <Button
            variant={!activeView ? "secondary" : "ghost"}
            aria-pressed={!activeView}
            onClick={() =>
              run(async () => {
                resetSearch("");
                await updateCrm((s) => ({
                  ...s,
                  directory: defaultDirectory,
                  activeViewId: undefined,
                }));
                setSelected([]);
                setPage(1);
              })
            }
          >
            Tutti gli studenti
          </Button>
          {views.map((v) => (
            <Button
              key={v.id}
              variant={activeView?.id === v.id ? "secondary" : "ghost"}
              aria-pressed={activeView?.id === v.id}
              onClick={() =>
                run(async () => {
                  resetSearch(v.config.query);
                  await updateCrm((s) => ({
                    ...s,
                    activeViewId: v.id,
                    directory: sanitizeDirectory(v.config, s),
                  }));
                  setPage(1);
                  setSelected([]);
                })
              }
            >
              {v.name}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setViewEditor("new")}>
            Salva nuova vista
          </Button>
          {activeView && (
            <>
              <Button
                variant="outline"
                disabled={!dirty}
                onClick={() =>
                  run(
                    async () =>
                      await updateCrm((s) => ({
                        ...s,
                        directory: config,
                        views: (s.views ?? []).map((v) =>
                          v.id === activeView.id ? { ...v, config } : v,
                        ),
                      })),
                  )
                }
              >
                Aggiorna vista
              </Button>
              <ActionMenu
                label="Azioni vista"
                items={[
                  {
                    label: "Rinomina vista",
                    onSelect: () => setViewEditor("rename"),
                  },
                  {
                    label: "Elimina vista",
                    onSelect: () => setDeleteView(true),
                    destructive: true,
                  },
                ]}
              />
            </>
          )}
        </div>
        {dirty && (
          <p role="status" className="w-full text-xs text-amber-800">
            La vista ha modifiche non ancora salvate. La configurazione corrente
            resta disponibile alla riapertura.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <div className="relative min-w-48 flex-1">
          <Search
            className="absolute top-3 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Cerca studenti"
            placeholder="Cerca nome, email, coach, proprietà…"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              setPage(1);
              setSelected([]);
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => {
                void setConfig({ query: value });
              }, 350);
            }}
            className="pl-9"
          />
        </div>
        <label className="text-xs">
          <span className="sr-only">Stato studenti</span>
          <SelectControl
            className="h-10 rounded-lg border bg-white px-3"
            value={config.status}
            onChange={(e) =>
              setConfig({ status: e.target.value as DirectoryConfig["status"] })
            }
          >
            <option value="all">Tutti gli stati</option>
            <option value="active">Attivi</option>
            <option value="invited">Da attivare</option>
            <option value="paused">In pausa</option>
          </SelectControl>
        </label>
        <label className="text-xs">
          <span className="sr-only">Tier studenti</span>
          <SelectControl
            className="h-10 max-w-52 rounded-lg border bg-white px-3"
            value={config.tier}
            onChange={(e) => setConfig({ tier: e.target.value })}
          >
            <option value="all">Tutti i tier</option>
            {state.tiers
              .filter(
                (t) => !t.archived || config.tier === t.id || config.archived,
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.archived ? " (archiviato)" : ""}
                </option>
              ))}
          </SelectControl>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <CheckboxControl
            checked={config.archived}
            onChange={(e) => setConfig({ archived: e.target.checked })}
          />
          Studenti archiviati
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setPanelDraft(structuredClone(config));
              setPanel("filters");
            }}
          >
            <SlidersHorizontal className="size-3.5" />
            Filtri{config.filters.length ? ` (${config.filters.length})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setPanelDraft(structuredClone(config));
              setPanel("columns");
            }}
          >
            <Columns3 className="size-3.5" />
            Colonne
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!filtered.length}
            onClick={() =>
              run(async () => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      studentsCsv(
                        filtered,
                        state.tiers,
                        properties,
                        config.columns,
                      ),
                    ],
                    { type: "text/csv;charset=utf-8" },
                  ),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "studenti-team-italfit.csv";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
            }
          >
            <Download className="size-3.5" />
            Esporta
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs">
            <span className="sr-only">Ordina per</span>
            <SelectControl
              className="h-9 max-w-44 rounded border bg-white px-2"
              value={config.sortKey}
              onChange={(e) => setConfig({ sortKey: e.target.value })}
            >
              <option value="name">Cognome e nome</option>
              <option value="joinedAt">Data inserimento</option>
              <option value="tier">Tier</option>
              <option value="status">Stato</option>
              <option value="coach">Coach</option>
              {properties
                .filter((p) => p.type !== "multiselect")
                .map((p) => (
                  <option key={p.id} value={`property:${p.id}`}>
                    {p.name}
                  </option>
                ))}
            </SelectControl>
          </label>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Inverti ordinamento"
            onClick={() =>
              setConfig({
                sortDirection: config.sortDirection === "asc" ? "desc" : "asc",
              })
            }
          >
            <span className="hidden sm:inline">
              {config.sortDirection === "asc" ? "Crescente ↑" : "Decrescente ↓"}
            </span>
            {config.sortDirection === "asc" ? (
              <ArrowUp className="size-4 sm:hidden" />
            ) : (
              <ArrowDown className="size-4 sm:hidden" />
            )}
          </Button>
          <Button
            variant={config.layout === "table" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Vista tabella"
            aria-pressed={config.layout === "table"}
            onClick={() => setConfig({ layout: "table" })}
          >
            <List className="size-4" />
          </Button>
          <Button
            variant={config.layout === "grid" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Vista schede"
            aria-pressed={config.layout === "grid"}
            onClick={() => setConfig({ layout: "grid" })}
          >
            <LayoutGrid className="size-4" />
          </Button>
        </div>
      </div>
      <FormError message={error} />
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b bg-muted/50 p-4">
          <span className="text-xs font-semibold">
            {selectedIds.length} selezionati
          </span>
          <label className="sr-only" htmlFor="bulk-status">
            Nuovo stato
          </label>
          <SelectControl
            id="bulk-status"
            className="h-10 rounded border bg-white px-3 text-xs"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            <option value="">Nuovo stato…</option>
            <option value="active">Attivo</option>
            <option value="invited">Da attivare</option>
            <option value="paused">In pausa</option>
          </SelectControl>
          <Button
            variant="outline"
            disabled={saving || !bulkStatus || config.archived}
            onClick={() =>
              applyBulk({
                status: bulkStatus as "active" | "paused" | "invited",
              })
            }
          >
            Applica stato
          </Button>
          <label className="sr-only" htmlFor="bulk-tier">
            Nuovo tier
          </label>
          <SelectControl
            id="bulk-tier"
            className="h-10 max-w-48 rounded border bg-white px-3 text-xs"
            value={bulkTier}
            onChange={(e) => setBulkTier(e.target.value)}
          >
            <option value="">Nuovo tier…</option>
            {state.tiers
              .filter((t) => !t.archived)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </SelectControl>
          <Button
            variant="outline"
            disabled={saving || !bulkTier || config.archived}
            onClick={() => applyBulk({ tierId: bulkTier })}
          >
            Applica tier
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setConfirmArchive(true)}
          >
            {config.archived
              ? "Ripristina selezionati"
              : "Archivia selezionati"}
          </Button>
          <Button variant="ghost" onClick={() => setSelected([])}>
            Deseleziona
          </Button>
        </div>
      )}
      {!filtered.length ? (
        <div className="px-6 py-14 text-center">
          <Users className="mx-auto mb-4 size-7 text-muted-foreground" />
          <h2 className="font-semibold">
            {config.archived
              ? "Nessuno studente archiviato trovato"
              : hasFilters
                ? "Nessuno studente trovato"
                : "Aggiungi il primo studente"}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {hasFilters
              ? "Prova una ricerca diversa o rimuovi i filtri per vedere gli altri studenti."
              : config.archived
                ? "Le schede archiviate appariranno qui. Potrai ripristinarle in qualsiasi momento."
                : "Crea la scheda, assegna un tier e prepara l’accesso personale."}
          </p>
          {hasFilters ? (
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => {
                resetSearch("");
                setConfig({
                  query: "",
                  status: "all",
                  tier: "all",
                  filters: [],
                });
              }}
            >
              Azzera filtri
            </Button>
          ) : config.archived ? (
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => setConfig({ archived: false })}
            >
              Torna agli studenti
            </Button>
          ) : onAdd ? (
            <Button className="mt-5" onClick={onAdd}>
              Aggiungi studente
            </Button>
          ) : (
            <Button asChild className="mt-5">
              <Link href="/admin/studenti/nuovo">Aggiungi studente</Link>
            </Button>
          )}
        </div>
      ) : config.layout === "table" ? (
        <StudentsTable
          students={shown}
          availableTiers={state.tiers}
          columnKeys={config.columns}
          propertyColumns={config.columns.flatMap((id) => {
            const p = properties.find((p) => `property:${p.id}` === id);
            return p ? [p] : [];
          })}
          selection={{
            selectedIds,
            onToggle: (id, checked) =>
              setSelected(
                checked
                  ? [...selectedIds, id]
                  : selectedIds.filter((x) => x !== id),
              ),
            onTogglePage: (checked) =>
              setSelected(
                checked
                  ? [...new Set([...selectedIds, ...shown.map((s) => s.id)])]
                  : selectedIds.filter((id) => !shown.some((s) => s.id === id)),
              ),
          }}
        />
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((s, index) => (
            <article
              key={s.id}
              className="min-w-0 space-y-4 rounded-xl border p-4"
            >
              <div className="flex items-start gap-3">
                <CheckboxControl
                  aria-label={`Seleziona ${s.firstName} ${s.lastName}`}
                  checked={selectedIds.includes(s.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selectedIds, s.id]
                        : selectedIds.filter((id) => id !== s.id),
                    )
                  }
                />
                <Link
                  href={`/admin/studenti/${s.id}`}
                  className="min-w-0 flex-1"
                >
                  <StudentIdentity student={s} index={index} />
                </Link>
              </div>
              <div className="flex justify-between">
                <StatusBadge status={s.status} />
                <Link
                  href={`/admin/studenti/${s.id}`}
                  aria-label={`Apri scheda di ${s.firstName} ${s.lastName}`}
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                {state.tiers.find((t) => t.id === s.tierId)?.name}
              </p>
            </article>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "risultato" : "risultati"}{" "}
          · Pagina {currentPage} di {pages}
        </p>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="page-size">
            Studenti per pagina
          </label>
          <SelectControl
            id="page-size"
            className="rounded border p-2 text-xs"
            value={config.pageSize}
            onChange={(e) =>
              setConfig({
                pageSize: Number(e.target.value) as DirectoryConfig["pageSize"],
              })
            }
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} per pagina
              </option>
            ))}
          </SelectControl>
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
      </div>
      {panel && (
        <Editor
          title={
            panel === "filters" ? "Filtri avanzati" : "Colonne della vista"
          }
          description={
            panel === "filters"
              ? "Filtra gli studenti usando le proprietà del CRM."
              : "Scegli le informazioni e il loro ordine nella tabella. La colonna studente rimane sempre visibile."
          }
          dirty={JSON.stringify(panelDraft) !== JSON.stringify(config)}
          close={() => setPanel(null)}
        >
          <div className="crm-editor-form">
            <FormError message={error} />
            {panel === "filters" ? (
              <DirectoryFilters
                filters={panelDraft.filters}
                properties={properties}
                onChange={(filters) =>
                  setPanelDraft({ ...panelDraft, filters })
                }
              />
            ) : (
              <div className="divide-y">
                {[
                  ...panelDraft.columns.flatMap((id) => {
                    const c = columnOptions.find((c) => c.id === id);
                    return c ? [c] : [];
                  }),
                  ...columnOptions.filter(
                    (c) => !panelDraft.columns.includes(c.id),
                  ),
                ].map((c) => (
                  <div className="flex items-center gap-3" key={c.id}>
                    <label
                      className="flex items-center gap-3 py-4 text-sm"
                      key={c.id}
                    >
                      <CheckboxControl
                        checked={panelDraft.columns.includes(c.id)}
                        onChange={(e) =>
                          setPanelDraft({
                            ...panelDraft,
                            columns: e.target.checked
                              ? [...panelDraft.columns, c.id]
                              : panelDraft.columns.filter((x) => x !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                    {panelDraft.columns.includes(c.id) && (
                      <div className="ml-auto flex gap-1">
                        {[-1, 1].map((direction) => (
                          <Button
                            type="button"
                            key={direction}
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Sposta ${c.name} ${direction < 0 ? "prima" : "dopo"}`}
                            disabled={
                              panelDraft.columns.indexOf(c.id) + direction <
                                0 ||
                              panelDraft.columns.indexOf(c.id) + direction >=
                                panelDraft.columns.length
                            }
                            onClick={async () => {
                              const columns = [...panelDraft.columns],
                                from = columns.indexOf(c.id),
                                to = from + direction;
                              [columns[from], columns[to]] = [
                                columns[to]!,
                                columns[from]!,
                              ];
                              setPanelDraft({ ...panelDraft, columns });
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
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="crm-form-actions">
              <EditorCancel />
              <Button
                onClick={async () => {
                  const applied = await setConfig(
                    panel === "filters"
                      ? { filters: panelDraft.filters }
                      : { columns: panelDraft.columns },
                  );
                  if (applied) setPanel(null);
                }}
              >
                Applica
              </Button>
            </div>
          </div>
        </Editor>
      )}
      {viewEditor && (
        <ViewEditor
          initial={viewEditor === "rename" ? activeView : undefined}
          close={() => setViewEditor(null)}
          save={async (name) => {
            await updateCrm((s) => {
              const id =
                viewEditor === "rename" && activeView
                  ? activeView.id
                  : crypto.randomUUID();
              const view = {
                id,
                name,
                config:
                  viewEditor === "rename" && activeView
                    ? activeView.config
                    : config,
              };
              return {
                ...s,
                activeViewId: id,
                directory: config,
                views:
                  viewEditor === "rename"
                    ? (s.views ?? []).map((v) => (v.id === id ? view : v))
                    : [...(s.views ?? []), view],
              };
            });
            setViewEditor(null);
          }}
        />
      )}
      <ConfirmDialog
        error={error}
        open={deleteView}
        title="Eliminare la vista?"
        description="Gli studenti e le loro proprietà rimangono invariati."
        confirmLabel="Elimina vista"
        onCancel={() => setDeleteView(false)}
        onConfirm={() =>
          run(async () => {
            await updateCrm((s) => ({
              ...s,
              views: (s.views ?? []).filter((v) => v.id !== activeView?.id),
              activeViewId: undefined,
            }));
            setDeleteView(false);
          })
        }
      />
      <ConfirmDialog
        error={error}
        open={confirmArchive}
        title={
          config.archived
            ? "Ripristinare gli studenti?"
            : "Archiviare gli studenti?"
        }
        description="Le schede e tutti i valori saranno conservati. Il ripristino richiede un tier non archiviato."
        confirmLabel={config.archived ? "Ripristina" : "Archivia"}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => applyBulk({ archived: !config.archived })}
      />
    </section>
  );
}
function ViewEditor({
  initial,
  close,
  save,
}: {
  initial?: CrmView;
  close: () => void;
  save: (name: string) => void | Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <Editor
      title={initial ? "Rinomina vista" : "Salva nuova vista"}
      description="La vista conserva filtri, ricerca, ordinamento, colonne e visualizzazione."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await save(
              String(new FormData(e.currentTarget).get("name")).trim(),
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Nome vista *">
          <input
            className={control}
            name="name"
            required
            maxLength={80}
            defaultValue={initial?.name}
          />
        </Field>
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Salva vista</Button>
        </div>
      </form>
    </Editor>
  );
}
