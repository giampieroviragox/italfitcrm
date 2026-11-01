"use client";
import { SelectControl } from "@/components/ui/select-control";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioChoiceGroup } from "@/components/ui/radio-choice-group";
import { statusLabels } from "@/modules/students/config";
import { useCrm, updateCrm, useRemoteMode } from "./store";
import { type CrmStudent, validPropertyValue } from "./model";
import { EditorCancel, Editor, Field, control, FormError } from "./ui";
import { PropertyField } from "./property-fields";
import { InviteDialog } from "./invite-button";
const recordOnly = "Solo scheda",
  recordWithAccess = "Scheda e accesso";
export function StudentEditor({
  student,
  close,
  saved,
}: {
  student?: CrmStudent;
  close: () => void;
  saved?: (id: string, accessRequested: boolean) => void;
}) {
  const state = useCrm(),
    remote = useRemoteMode();
  const [draft, setDraft] = useState<CrmStudent>(() =>
    student
      ? { ...student, properties: { ...student.properties } }
      : {
          id: "",
          firstName: "",
          lastName: "",
          email: "",
          coach: "",
          phone: "",
          tags: [],
          status: "invited",
          tierId: "",
          joinedAt: new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Europe/Rome",
          }).format(new Date()),
          properties: {},
        },
  );
  const [baseRevision] = useState(student?.revision ?? 0);
  const [error, setError] = useState("");
  const [accessChoice, setAccessChoice] = useState(recordOnly);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(
    null,
  );
  const canChooseAccess = remote && !student;
  const giveAccess = canChooseAccess && accessChoice === recordWithAccess;
  const set = <K extends keyof CrmStudent>(key: K, value: CrmStudent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  if (created)
    return (
      <InviteDialog
        id={created.id}
        kind="student"
        createdName={created.name}
        close={() => {
          saved?.(created.id, true);
          close();
        }}
      />
    );
  return (
    <Editor
      title={student ? "Modifica studente" : "Aggiungi studente"}
      description={
        canChooseAccess
          ? "Anagrafica, tier e proprietà CRM. In fondo scegli se dare subito l’accesso all’area studente."
          : "Anagrafica, tier e proprietà CRM. Dopo il salvataggio puoi preparare l’accesso dalla scheda."
      }
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const item = {
              ...draft,
              id: draft.id || crypto.randomUUID(),
              firstName: draft.firstName.trim(),
              lastName: draft.lastName.trim(),
              email: draft.email.trim().toLowerCase(),
              coach: draft.coach.trim(),
            };
            await updateCrm((current) => {
              const latest = current.students.find((s) => s.id === item.id);
              if (
                student &&
                (!latest || (latest.revision ?? 0) !== baseRevision)
              )
                throw new Error(
                  "Questa scheda è stata modificata altrove. Chiudi e riapri il form per caricare la versione aggiornata.",
                );
              if (student?.archived)
                throw new Error(
                  "Ripristina lo studente prima di modificarne la scheda.",
                );
              if (
                !item.firstName ||
                !item.lastName ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)
              )
                throw new Error("Inserisci nome, cognome ed email validi.");
              if (
                current.students.some(
                  (s) =>
                    s.id !== item.id && s.email.toLowerCase() === item.email,
                )
              )
                throw new Error("Esiste già uno studente con questa email.");
              if (
                !current.tiers.some(
                  (t) =>
                    t.id === item.tierId &&
                    (!t.archived || student?.tierId === t.id),
                )
              )
                throw new Error("Seleziona un tier disponibile.");
              for (const p of current.properties.filter((p) => !p.archived))
                if (!validPropertyValue(p, item.properties[p.id]))
                  throw new Error(
                    `Controlla la proprietà “${p.name}”: valore mancante o non valido.`,
                  );
              return {
                ...current,
                students: student
                  ? current.students.map((s) => (s.id === item.id ? item : s))
                  : [item, ...current.students],
              };
            });
            if (giveAccess) {
              setCreated({
                id: item.id,
                name: `${item.firstName} ${item.lastName}`,
              });
              return;
            }
            saved?.(item.id, false);
            close();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Salvataggio non riuscito",
            );
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome *">
            <input
              className={control}
              required
              value={draft.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </Field>
          <Field label="Cognome *">
            <input
              className={control}
              required
              value={draft.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Email *"
          hint={
            student?.access
              ? "Email collegata all’account personale."
              : undefined
          }
        >
          <input
            className={control}
            required
            type="email"
            value={draft.email}
            readOnly={Boolean(student?.access)}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tier *">
            <SelectControl
              className={control}
              required
              value={draft.tierId}
              onChange={(e) => set("tierId", e.target.value)}
            >
              <option value="">Seleziona un tier…</option>
              {state.tiers
                .filter((t) => !t.archived || t.id === draft.tierId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.archived ? " (archiviato)" : ""}
                  </option>
                ))}
            </SelectControl>
          </Field>
          <Field label="Stato">
            <SelectControl
              className={control}
              value={draft.status}
              onChange={(e) =>
                set("status", e.target.value as CrmStudent["status"])
              }
            >
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SelectControl>
          </Field>
        </div>
        <Field label="Telefono">
          <input
            className={control}
            type="tel"
            value={draft.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+39"
          />
        </Field>
        <Field label="Coach di riferimento">
          <input
            className={control}
            value={draft.coach}
            onChange={(e) => set("coach", e.target.value)}
          />
        </Field>
        <Field label="Tag" hint="Separa i tag con una virgola.">
          <input
            className={control}
            defaultValue={draft.tags.join(", ")}
            onChange={(e) =>
              set("tags", [
                ...new Set(
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                ),
              ])
            }
          />
        </Field>
        {Array.from(
          new Set(
            state.properties.filter((p) => !p.archived).map((p) => p.group),
          ),
        ).map((group) => (
          <section key={group} className="space-y-5 border-t pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </h3>
            {state.properties
              .filter((p) => !p.archived && p.group === group)
              .map((p) => (
                <PropertyField
                  key={p.id}
                  property={p}
                  value={draft.properties[p.id]}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      properties: { ...d.properties, [p.id]: v },
                    }))
                  }
                />
              ))}
          </section>
        ))}
        {canChooseAccess && (
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-xs font-medium">
              Accesso all’area studente
            </legend>
            <RadioChoiceGroup
              label="Accesso all’area studente"
              name="student-access"
              options={[recordOnly, recordWithAccess]}
              value={accessChoice}
              onChange={setAccessChoice}
            />
            <p className="text-[11px] leading-5 text-muted-foreground">
              {giveAccess
                ? "Dopo la creazione prepari il link personale o l’invito via email."
                : "Lo studente non potrà accedere. Potrai invitarlo in seguito dalla scheda."}
            </p>
          </fieldset>
        )}
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">
            {student
              ? "Salva modifiche"
              : giveAccess
                ? "Crea e prepara l’accesso"
                : "Crea studente"}
          </Button>
        </div>
      </form>
    </Editor>
  );
}
