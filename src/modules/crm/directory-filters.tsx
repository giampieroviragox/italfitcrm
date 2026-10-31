"use client";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import { Button } from "@/components/ui/button";
import { operatorsFor } from "./logic";
import type { CrmProperty, PropertyFilter } from "./model";
import { control, Field } from "./ui";
export function DirectoryFilters({
  filters,
  properties,
  onChange,
}: {
  filters: PropertyFilter[];
  properties: readonly CrmProperty[];
  onChange: (f: PropertyFilter[]) => void;
}) {
  const update = (id: string, patch: Partial<PropertyFilter>) =>
    onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  return (
    <section aria-label="Condizioni delle proprietà">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Lo studente deve rispettare tutte le condizioni. “Non compilato”
          distingue i campi vuoti da zero e No.
        </p>
        {filters.map((f, index) => {
          const p = properties.find((p) => p.id === f.propertyId);
          if (!p) return null;
          const empty = ["is_empty", "is_not_empty"].includes(f.operator);
          return (
            <fieldset
              key={f.id}
              className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2"
            >
              <legend className="px-1 text-xs text-muted-foreground">
                Condizione {index + 1}
              </legend>
              <Field label="Proprietà">
                <SelectControl
                  className={control}
                  value={f.propertyId}
                  onChange={(e) => {
                    const prop = properties.find(
                      (p) => p.id === e.target.value,
                    );
                    if (prop)
                      update(f.id, {
                        propertyId: prop.id,
                        operator: operatorsFor(prop)[0]!.value,
                        value: "",
                        values: [],
                      });
                  }}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              <Field label="Condizione">
                <SelectControl
                  className={control}
                  value={f.operator}
                  onChange={(e) =>
                    update(f.id, {
                      operator: e.target.value as PropertyFilter["operator"],
                    })
                  }
                >
                  {operatorsFor(p).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              {empty ? (
                <p className="self-center text-xs text-muted-foreground">
                  Nessun valore richiesto
                </p>
              ) : p.type === "multiselect" ? (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm">Valori</legend>
                  {p.options.map((o) => (
                    <label key={o} className="flex items-center gap-2 text-xs">
                      <CheckboxControl
                        checked={(f.values ?? []).includes(o)}
                        onChange={(e) =>
                          update(f.id, {
                            values: e.target.checked
                              ? [...(f.values ?? []), o]
                              : (f.values ?? []).filter((v) => v !== o),
                          })
                        }
                      />
                      {o}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <Field label="Valore">
                  {["boolean", "select", "radio"].includes(p.type) ? (
                    <SelectControl
                      className={control}
                      value={f.value}
                      onChange={(e) => update(f.id, { value: e.target.value })}
                    >
                      <option value="">Seleziona…</option>
                      {p.type === "boolean" ? (
                        <>
                          <option value="true">Sì</option>
                          <option value="false">No</option>
                        </>
                      ) : (
                        p.options.map((o) => <option key={o}>{o}</option>)
                      )}
                    </SelectControl>
                  ) : (
                    <input
                      className={control}
                      type={
                        p.type === "number"
                          ? "number"
                          : p.type === "date"
                            ? "date"
                            : "text"
                      }
                      step={p.type === "number" ? "any" : undefined}
                      value={f.value}
                      onChange={(e) => update(f.id, { value: e.target.value })}
                    />
                  )}
                </Field>
              )}
              <Button
                className="self-end"
                variant="ghost"
                aria-label={`Rimuovi condizione ${index + 1}`}
                onClick={() => onChange(filters.filter((x) => x.id !== f.id))}
              >
                Rimuovi
              </Button>
              {!empty &&
                (p.type === "multiselect"
                  ? !f.values?.length
                  : !f.value.trim()) && (
                  <p className="text-xs text-amber-800 sm:col-span-2">
                    Completa la condizione per ottenere risultati, oppure
                    rimuovila.
                  </p>
                )}
            </fieldset>
          );
        })}
        <Button
          variant="outline"
          disabled={!properties.length}
          onClick={() => {
            const p = properties[0];
            if (p)
              onChange([
                ...filters,
                {
                  id: crypto.randomUUID(),
                  propertyId: p.id,
                  operator: operatorsFor(p)[0]!.value,
                  value: "",
                  values: [],
                },
              ]);
          }}
        >
          Aggiungi condizione
        </Button>
        {!properties.length && (
          <p className="text-xs text-muted-foreground">
            Crea prima una proprietà nelle impostazioni.
          </p>
        )}
      </div>
    </section>
  );
}
