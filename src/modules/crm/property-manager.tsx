"use client";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import { useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { useCrm, updateCrm } from "./store";
import {
  choiceTypes,
  normalize,
  propertyTypes,
  uniqueOptions,
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
function PropertyEditor({
  property,
  close,
}: {
  property?: CrmProperty;
  close: () => void;
}) {
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
  const [original] = useState(JSON.stringify(property));
  const [options, setOptions] = useState(draft.options.join("\n"));
  const [error, setError] = useState("");
  return (
    <Editor
      title={property ? "Modifica proprietà" : "Crea proprietà"}
      description="Definisci un campo disponibile nelle schede di tutti gli studenti."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const next = {
              ...draft,
              id: draft.id || crypto.randomUUID(),
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
              if (!next.name || !next.group)
                throw new Error("Nome e gruppo sono obbligatori.");
              if (
                [
                  "nome",
                  "cognome",
                  "email",
                  "telefono",
                  "tier",
                  "stato",
                  "tag",
                  "coach",
                ].includes(next.name.toLowerCase()) ||
                s.properties.some(
                  (p) =>
                    p.id !== next.id &&
                    p.name.toLowerCase() === next.name.toLowerCase(),
                )
              )
                throw new Error(
                  "Questo nome è già utilizzato. Scegli un nome univoco.",
                );
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
          label="Tipo di campo"
          hint={
            property
              ? "Il tipo resta fisso per preservare i dati esistenti."
              : undefined
          }
        >
          <SelectControl
            className={control}
            disabled={!!property}
            value={draft.type}
            onChange={(e) =>
              setDraft({
                ...draft,
                type: e.target.value as CrmProperty["type"],
              })
            }
          >
            {Object.entries(propertyTypes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SelectControl>
        </Field>
        <Field label="Gruppo *">
          <input
            required
            className={control}
            value={draft.group}
            onChange={(e) => setDraft({ ...draft, group: e.target.value })}
            placeholder="Es. Obiettivi e preferenze"
          />
        </Field>
        <Field label="Descrizione">
          <textarea
            className={control}
            rows={3}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
        </Field>
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
        <label className="flex items-center gap-2 text-sm">
          <CheckboxControl
            checked={draft.required}
            onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
          />
          Campo obbligatorio
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          L’obbligatorietà viene verificata alla creazione e al prossimo
          salvataggio degli studenti. Le schede esistenti non vengono compilate
          automaticamente.
        </p>
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
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
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
  const visible = state.properties.filter(
    (p) =>
      p.archived === archived &&
      `${p.name} ${p.group}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="Impostazioni · CRM"
        title="Proprietà CRM"
        description="Definisci i campi condivisi da tutte le schede studente."
        action={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await updateCrm((s) => {
                    const templates: Omit<CrmProperty, "id">[] = [
                      {
                        name: "Obiettivo",
                        type: "select",
                        group: "Allenamento",
                        description: "Obiettivo principale del percorso",
                        required: false,
                        options: [
                          "Forza",
                          "Ipertrofia",
                          "Dimagrimento",
                          "Benessere",
                          "Mobilità",
                        ],
                        archived: false,
                      },
                      {
                        name: "Esperienza",
                        type: "radio",
                        group: "Allenamento",
                        description: "Livello di esperienza",
                        required: false,
                        options: ["Principiante", "Intermedio", "Avanzato"],
                        archived: false,
                      },
                      {
                        name: "Disponibilità settimanale",
                        type: "multiselect",
                        group: "Allenamento",
                        description: "Giorni disponibili per allenarsi",
                        required: false,
                        options: [
                          "Lunedì",
                          "Martedì",
                          "Mercoledì",
                          "Giovedì",
                          "Venerdì",
                          "Sabato",
                          "Domenica",
                        ],
                        archived: false,
                      },
                      {
                        name: "Inizio percorso",
                        type: "date",
                        group: "Allenamento",
                        description: "Data di inizio del percorso",
                        required: false,
                        options: [],
                        archived: false,
                      },
                    ];
                    return {
                      ...s,
                      properties: [
                        ...s.properties,
                        ...templates
                          .filter(
                            (t) =>
                              !s.properties.some(
                                (p) => normalize(p.name) === normalize(t.name),
                              ),
                          )
                          .map((t) => ({ ...t, id: crypto.randomUUID() })),
                      ],
                    };
                  });
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Aggiungi campi fitness
            </Button>
            <Button onClick={() => setEditing("new")}>Crea proprietà</Button>
          </>
        }
      />
      <LocalNotice />
      <div className="mb-5 flex flex-wrap gap-4">
        <input
          className={`${control} sm:max-w-xs`}
          aria-label="Cerca proprietà"
          placeholder="Cerca nome o gruppo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-xs">
          <CheckboxControl
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Mostra archiviate
        </label>
      </div>
      <FormError message={error} />
      <div className="space-y-3">
        {visible.map((p) => (
          <article
            className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-5"
            key={p.id}
          >
            <div className="min-w-[180px] flex-1 break-words">
              <h2 className="text-sm font-semibold">
                {p.name} {p.required && <span className="text-primary">*</span>}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.group} · {propertyTypes[p.type]} ·{" "}
                {
                  state.students.filter(
                    (s) =>
                      s.properties[p.id] !== undefined &&
                      s.properties[p.id] !== "" &&
                      (!Array.isArray(s.properties[p.id]) ||
                        (s.properties[p.id] as string[]).length),
                  ).length
                }{" "}
                valori compilati
              </p>
              {p.description && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.description}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setEditing(p)}>
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
        {!visible.length && (
          <div className="rounded-xl border border-dashed bg-white px-6 py-16 text-center">
            <h2 className="text-lg font-semibold">
              {archived
                ? "Nessuna proprietà archiviata"
                : "Nessuna proprietà personalizzata"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {search
                ? "Nessun risultato per questa ricerca."
                : "Crea una proprietà per aggiungere nuove informazioni a tutte le schede studente."}
            </p>
          </div>
        )}
      </div>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        I campi di base (nome, cognome, email, telefono, tier, stato, coach e
        tag) sono già disponibili. Le proprietà archiviate conservano i loro
        valori e possono essere ripristinate.
      </p>
      <ConfirmDialog
        open={!!pendingArchive}
        title="Archiviare la proprietà?"
        description="I valori nelle schede vengono conservati. Questa proprietà sarà rimossa da colonne, filtri e ordinamento delle viste salvate. Potrai ripristinarla dalle proprietà archiviate."
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
