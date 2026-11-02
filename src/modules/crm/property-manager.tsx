"use client";
import { propertyKey } from "./property-key";
import { useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { useCrm, updateCrm } from "./store";
import {
  choiceTypes,
  propertyTypes,
  uniqueOptions,
  defaultDirectory,
  type CrmProperty,
} from "./model";
import {
  EditorCancel,
  Editor,
  Field,
  control,
  FormError,
  LocalNotice,
} from "./ui";
export function PropertyEditor({
  property,
  close,
  showInDirectory = false,
}: {
  property?: CrmProperty;
  close: () => void;
  showInDirectory?: boolean;
}) {
  const state = useCrm();
  const [draft, setDraft] = useState<CrmProperty>(() =>
    property
      ? { ...property }
      : {
          id: "",
          name: "",
          type: "text",
          description: "",
          group: "Informazioni studente",
          required: false,
          options: [],
          archived: false,
        },
  );
  const [typeQuery, setTypeQuery] = useState("");
  const [original] = useState(JSON.stringify(property));
  const [options, setOptions] = useState(draft.options.join("\n"));
  const [error, setError] = useState("");
  return (
    <Editor
      title={property ? "Modifica proprietà" : "Crea proprietà"}
      description="Scegli il nome e il tipo del campo."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const next = {
              ...draft,
              id: draft.id,
              name: draft.name.trim(),
              group: draft.group.trim(),
              options: choiceTypes.includes(draft.type)
                ? [
                    ...new Set(
                      options
                        .split("\n")
                        .map((o) => o.trim())
                        .filter(Boolean),
                    ),
                  ]
                : [],
            };
            next.options = uniqueOptions(next.options);
            await updateCrm((s) => {
              if (
                property &&
                JSON.stringify(
                  s.properties.find((p) => p.id === property.id),
                ) !== original
              )
                throw new Error(
                  "Proprietà modificata altrove. Chiudi e riapri il form.",
                );
              if (!property) next.id = propertyKey(next.name, s.properties);
              if (!next.name) throw new Error("Il nome è obbligatorio.");
              if (choiceTypes.includes(next.type) && next.options.length < 2)
                throw new Error("Inserisci almeno due opzioni distinte.");
              if (property && property.type !== next.type)
                throw new Error(
                  "Il tipo di una proprietà esistente non può essere cambiato.",
                );
              if (property && choiceTypes.includes(next.type))
                for (const student of s.students) {
                  const v = student.properties[next.id];
                  const used = Array.isArray(v)
                    ? v
                    : typeof v === "string" && v
                      ? [v]
                      : [];
                  if (used.some((o) => !next.options.includes(o)))
                    throw new Error(
                      "Non puoi rimuovere opzioni utilizzate dagli studenti. Svuota prima quei valori, oppure archivia la proprietà.",
                    );
                }
              return {
                ...s,
                ...(!property && showInDirectory
                  ? {
                      directory: {
                        ...(s.directory ?? defaultDirectory),
                        columns: [
                          ...(s.directory ?? defaultDirectory).columns,
                          `property:${next.id}`,
                        ],
                      },
                    }
                  : {}),
                properties: property
                  ? s.properties.map((p) => (p.id === next.id ? next : p))
                  : [...s.properties, next],
              };
            });
            close();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Errore di salvataggio",
            );
          }
        }}
      >
        <Field label="Nome proprietà *">
          <input
            className={control}
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Es. Obiettivo principale"
          />
        </Field>
        <Field
          label="Key"
          hint="Generata automaticamente, univoca e stabile anche se cambi il nome."
        >
          <input
            className={`${control} font-mono`}
            readOnly
            value={
              property?.id ??
              (draft.name.trim()
                ? propertyKey(draft.name, state.properties)
                : "")
            }
            placeholder="es. obiettivo-principale"
          />
        </Field>
        {property ? (
          <Field
            label="Tipo di campo"
            hint="Il tipo resta fisso per preservare i dati esistenti."
          >
            <input
              className={control}
              readOnly
              value={propertyTypes[draft.type]}
            />
          </Field>
        ) : (
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium">Tipo di campo</legend>
            <input
              className={control}
              aria-label="Cerca tipo di campo"
              placeholder="Cerca un tipo di campo…"
              value={typeQuery}
              onChange={(e) => setTypeQuery(e.target.value)}
            />
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="group"
              aria-label="Tipi di campo"
            >
              {Object.entries(propertyTypes)
                .filter(([, label]) =>
                  label
                    .toLocaleLowerCase("it")
                    .includes(typeQuery.toLocaleLowerCase("it")),
                )
                .map(([type, label]) => (
                  <button
                    type="button"
                    key={type}
                    aria-pressed={draft.type === type}
                    className={`rounded-lg border px-3 py-3 text-left text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary ${draft.type === type ? "border-primary bg-primary/5 font-semibold text-primary" : "border-input"}`}
                    onClick={() =>
                      setDraft({ ...draft, type: type as CrmProperty["type"] })
                    }
                  >
                    {label}
                  </button>
                ))}
            </div>
          </fieldset>
        )}
        {choiceTypes.includes(draft.type) && (
          <Field
            label="Opzioni *"
            hint="Una voce per riga. Minimo due opzioni; i duplicati vengono rimossi."
          >
            <textarea
              required
              className={control}
              rows={5}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder={"Forza\nResistenza\nMobilità"}
            />
          </Field>
        )}
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Salva proprietà</Button>
        </div>
      </form>
    </Editor>
  );
}
export function PropertyManager() {
  const state = useCrm();
  const [editing, setEditing] = useState<CrmProperty | "new" | null>(null);
  const [pendingArchive, setPendingArchive] = useState<CrmProperty | null>(
    null,
  );
  const [error, setError] = useState("");
  const toggleArchive = async (p: CrmProperty) => {
    try {
      await updateCrm((s) => ({
        ...s,
        properties: s.properties.map((x) =>
          x.id === p.id ? { ...x, archived: !p.archived } : x,
        ),
      }));
      setError("");
      setPendingArchive(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="Impostazioni"
        title="Proprietà"
        description="I campi presenti nelle schede di tutti gli studenti."
        action={
          <Button onClick={() => setEditing("new")}>Crea proprietà</Button>
        }
      />
      <LocalNotice />
      <FormError message={error} />
      <div className="space-y-3">
        {state.properties
          .filter((p) => !p.deleted)
          .map((p) => (
            <article
              className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-5"
              key={p.id}
            >
              <div className="min-w-[180px] flex-1 break-words">
                <h2 className="text-sm font-semibold">{p.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {propertyTypes[p.type]}
                  {p.archived ? " · Archiviata" : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={p.archived}
                  onClick={() => setEditing(p)}
                >
                  Modifica
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    p.archived ? toggleArchive(p) : setPendingArchive(p)
                  }
                >
                  {p.archived ? "Ripristina" : "Archivia"}
                </Button>
              </div>
            </article>
          ))}
        {!state.properties.some((p) => !p.deleted) && (
          <div className="rounded-xl border border-dashed bg-white px-6 py-16 text-center">
            <h2 className="text-lg font-semibold">Nessuna proprietà</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Crea una proprietà per aggiungere un campo a tutte le schede
              studente.
            </p>
          </div>
        )}
      </div>
      <ConfirmDialog
        error={error}
        open={!!pendingArchive}
        title="Archiviare la proprietà?"
        description="I valori nelle schede vengono conservati. Questa proprietà sarà rimossa da colonne, filtri e ordinamento delle viste salvate. Potrai ripristinarla da questa lista."
        confirmLabel="Archivia proprietà"
        onCancel={() => setPendingArchive(null)}
        onConfirm={async () => {
          if (pendingArchive) toggleArchive(pendingArchive);
        }}
      />
      {editing && (
        <PropertyEditor
          property={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
        />
      )}
    </>
  );
}
