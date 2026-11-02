"use client";
import { CoachSelect } from "./coach-select";
import { TierPicker } from "./tier-picker";
import { studentTierIds } from "./student-tiers";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioChoiceGroup } from "@/components/ui/radio-choice-group";
import { useCrm, updateCrm, useRemoteMode } from "./store";
import {
  type CrmStudent,
  type PropertyValue,
  validPropertyValue,
} from "./model";
import { EditorCancel, Editor, Field, control, FormError } from "./ui";
import { PropertyField } from "./property-fields";
import { InviteDialog } from "./invite-button";
import { PhoneField } from "./phone-field";
import { formatDate } from "@/lib/format";
const recordOnly = "Solo scheda",
  recordWithAccess = "Scheda e accesso";
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(),
  );
export function StudentCreateDialog({
  close,
  saved,
}: {
  close: () => void;
  saved?: (id: string, accessRequested: boolean) => void;
}) {
  const state = useCrm(),
    remote = useRemoteMode();
  const [firstName, setFirstName] = useState(""),
    [lastName, setLastName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [tierIds, setTierIds] = useState<string[]>([]),
    [joinedAt] = useState(today),
    [properties, setProperties] = useState<Record<string, PropertyValue>>({}),
    [accessChoice, setAccessChoice] = useState(recordOnly),
    [error, setError] = useState(""),
    [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const giveAccess = remote && accessChoice === recordWithAccess;
  const required = state.properties.filter((p) => p.required && !p.archived);
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
      centered
      title="Aggiungi studente"
      description="Crea la scheda e scegli se dare subito l’accesso all’area studente."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const id = crypto.randomUUID(),
            first = firstName.trim(),
            last = lastName.trim(),
            address = email.trim().toLowerCase();
          try {
            await updateCrm((current) => {
              if (
                !first ||
                !last ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
              )
                throw new Error("Inserisci nome, cognome ed email validi.");
              if (
                current.students.some((s) => s.email.toLowerCase() === address)
              )
                throw new Error("Esiste già uno studente con questa email.");
              if (
                !tierIds.length ||
                tierIds.some(
                  (id) =>
                    !current.tiers.some((t) => t.id === id && !t.archived),
                )
              )
                throw new Error("Seleziona un tier disponibile.");
              return {
                ...current,
                students: [
                  {
                    id,
                    firstName: first,
                    lastName: last,
                    email: address,
                    phone,
                    coach: "",

                    status: "active",
                    tierId: tierIds[0]!,
                    tierIds,
                    joinedAt,
                    properties: { ...properties },
                  },
                  ...current.students,
                ],
              };
            });
            if (giveAccess) {
              setCreated({ id, name: `${first} ${last}` });
              return;
            }
            saved?.(id, false);
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
              autoComplete="off"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Cognome *">
            <input
              className={control}
              required
              autoComplete="off"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Email *">
          <input
            className={control}
            required
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <PhoneField value={phone} onChange={setPhone} />
        <TierPicker tiers={state.tiers} value={tierIds} onChange={setTierIds} />
        {required.map((p) => (
          <PropertyField
            key={p.id}
            property={p}
            value={properties[p.id]}
            onChange={(v) => setProperties((d) => ({ ...d, [p.id]: v }))}
          />
        ))}
        {remote && (
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
            <p className="text-xs leading-5 text-muted-foreground">
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
            {giveAccess ? "Crea e prepara l’accesso" : "Crea studente"}
          </Button>
        </div>
      </form>
    </Editor>
  );
}
export function StudentEditor({
  student,
  close,
  saved,
}: {
  student: CrmStudent;
  close: () => void;
  saved: () => void;
}) {
  const state = useCrm();
  const [draft, setDraft] = useState<CrmStudent>(() => ({
    ...student,
    properties: { ...student.properties },
  }));
  const [baseRevision] = useState(student.revision ?? 0);
  const [error, setError] = useState("");
  const set = <K extends keyof CrmStudent>(key: K, value: CrmStudent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <Editor
      inline
      title="Scheda studente"
      description={`Anagrafica e servizi · Aggiunto il ${formatDate(student.joinedAt)}`}
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const item = {
              ...draft,
              firstName: draft.firstName.trim(),
              lastName: draft.lastName.trim(),
              email: draft.email.trim().toLowerCase(),
              coach: draft.coach.trim(),
            };
            await updateCrm((current) => {
              const latest = current.students.find((s) => s.id === item.id);
              if (!latest || (latest.revision ?? 0) !== baseRevision)
                throw new Error(
                  "Questa scheda è stata modificata altrove. Annulla le modifiche per caricare la versione aggiornata.",
                );
              if (student.archived)
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
                !studentTierIds(item).length ||
                studentTierIds(item).some(
                  (id) =>
                    !current.tiers.some((t) => t.id === id && !t.archived),
                )
              )
                throw new Error("Seleziona almeno un tier disponibile.");
              for (const p of current.properties.filter((p) => !p.archived))
                if (!validPropertyValue(p, item.properties[p.id]))
                  throw new Error(
                    `Controlla la proprietà “${p.name}”: valore mancante o non valido.`,
                  );
              return {
                ...current,
                students: current.students.map((s) =>
                  s.id === item.id ? item : s,
                ),
              };
            });
            saved();
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
          <Field
            label="Email *"
            hint={
              student.access
                ? "Email collegata all’account personale."
                : undefined
            }
          >
            <input
              className={control}
              required
              type="email"
              value={draft.email}
              readOnly={Boolean(student.access)}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <CoachSelect value={draft.coach} onChange={(v) => set("coach", v)} />
        </div>
        <PhoneField
          value={draft.phone ?? ""}
          onChange={(v) => set("phone", v)}
        />
        <section className="border-t pt-5">
          <TierPicker
            tiers={state.tiers}
            value={studentTierIds(draft)}
            onChange={(ids) =>
              setDraft((d) => ({ ...d, tierId: ids[0] ?? "", tierIds: ids }))
            }
          />
        </section>
        {Array.from(
          new Set(
            state.properties.filter((p) => !p.archived).map((p) => p.group),
          ),
        ).map((group) => (
          <section key={group} className="space-y-5 border-t pt-6">
            <h3 className="text-sm font-medium text-muted-foreground">
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
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit" disabled={student.archived}>
            Salva modifiche
          </Button>
        </div>
      </form>
    </Editor>
  );
}
