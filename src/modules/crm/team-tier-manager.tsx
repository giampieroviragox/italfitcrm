"use client";
import { InviteButton } from "./invite-button";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import {
  useCrm,
  updateCrm,
  downloadBackup,
  useViewer,
  useRemoteMode,
} from "./store";
import type { CrmTier, AdminMember } from "./model";
import {
  EditorCancel,
  Editor,
  Field,
  control,
  FormError,
  LocalNotice,
} from "./ui";
export function TierManager() {
  const state = useCrm();
  const [editing, setEditing] = useState<CrmTier | "new" | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      <PageHeading
        title="Tier studenti"
        description="Crea e organizza i tier da assegnare agli studenti."
        action={<Button onClick={() => setEditing("new")}>Crea tier</Button>}
      />
      <LocalNotice />
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {state.tiers.map((t) => (
          <article key={t.id} className="rounded-xl border bg-white p-6">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t.archived ? "Archiviato" : "Disponibile"}
            </span>
            <h2 className="mt-3 text-lg font-semibold">{t.name}</h2>
            <p className="mt-2 min-h-12 text-xs leading-6 text-muted-foreground">
              {t.description || "Nessuna descrizione"}
            </p>
            <p className="my-5 text-xs">
              {state.students.filter((s) => s.tierId === t.id).length} studenti
              assegnati
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditing(t)}>
                Modifica
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await updateCrm((s) => {
                      if (
                        !t.archived &&
                        s.students.some((x) => !x.archived && x.tierId === t.id)
                      )
                        throw new Error(
                          "Riassegna prima gli studenti a un altro tier.",
                        );
                      return {
                        ...s,
                        tiers: s.tiers.map((x) =>
                          x.id === t.id ? { ...x, archived: !x.archived } : x,
                        ),
                      };
                    });
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {t.archived ? "Ripristina" : "Archivia"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <TierEditor
          tier={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
        />
      )}
    </>
  );
}
function TierEditor({ tier, close }: { tier?: CrmTier; close: () => void }) {
  const [original] = useState(JSON.stringify(tier));
  const [error, setError] = useState("");
  return (
    <Editor
      title={tier ? "Modifica tier" : "Crea tier"}
      description="Un tier organizza gli studenti per percorso o livello di servizio."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next = {
            id: tier?.id || crypto.randomUUID(),
            name: String(f.get("name")).trim(),
            description: String(f.get("description")).trim(),
            archived: tier?.archived ?? false,
          };
          try {
            await updateCrm((s) => {
              if (
                tier &&
                JSON.stringify(s.tiers.find((t) => t.id === tier.id)) !==
                  original
              )
                throw new Error(
                  "Tier modificato altrove. Chiudi e riapri il form.",
                );
              if (
                !next.name ||
                s.tiers.some(
                  (t) =>
                    t.id !== next.id &&
                    t.name.toLowerCase() === next.name.toLowerCase(),
                )
              )
                throw new Error("Scegli un nome univoco per il tier.");
              return {
                ...s,
                tiers: tier
                  ? s.tiers.map((t) => (t.id === next.id ? next : t))
                  : [...s.tiers, next],
              };
            });
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Nome tier *">
          <input
            className={control}
            name="name"
            required
            defaultValue={tier?.name}
          />
        </Field>
        <Field label="Descrizione">
          <textarea
            className={control}
            name="description"
            rows={4}
            defaultValue={tier?.description}
          />
        </Field>
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Salva tier</Button>
        </div>
      </form>
    </Editor>
  );
}
export function TeamManager() {
  const state = useCrm();
  const viewer = useViewer(),
    remote = useRemoteMode();
  const canManage = !remote || viewer?.role === "owner";
  const [editing, setEditing] = useState<AdminMember | "new" | null>(null);
  const [backupError, setBackupError] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="Impostazioni · Team"
        title="Amministratori."
        description="Gestisci più amministratori, separatamente dagli studenti."
        action={
          <Button disabled={!canManage} onClick={() => setEditing("new")}>
            Aggiungi amministratore
          </Button>
        }
      />
      <LocalNotice />
      <div className="space-y-3">
        {state.admins.map((a) => (
          <article
            key={a.id}
            className="flex flex-col gap-5 rounded-xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="min-w-[180px] flex-1 break-words">
              <h2 className="text-sm font-semibold">{a.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{a.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="text-xs">
                {a.role === "owner" ? "Proprietario" : "Amministratore"}
              </span>
              <span className="rounded-md bg-muted px-2 py-1 text-[11px]">
                {a.access?.status === "active"
                  ? "Account attivo"
                  : a.access
                    ? "Invito preparato"
                    : "Accesso non creato"}
              </span>
              {a.role !== "owner" && (
                <InviteButton id={a.id} kind="admin" disabled={!canManage} />
              )}
              <Button
                variant="outline"
                disabled={!canManage}
                onClick={() => setEditing(a)}
              >
                Modifica
              </Button>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-xl border bg-white p-6">
        <h2 className="text-sm font-semibold">Copia dei dati CRM</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Esporta studenti, proprietà, tier, amministratori, viste, piani,
          lezioni e prenotazioni in formato JSON.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={async () => {
            try {
              downloadBackup();
              setBackupError("");
            } catch {
              setBackupError("Impossibile scaricare la copia. Riprova.");
            }
          }}
        >
          Scarica backup JSON
        </Button>
        <FormError message={backupError} />
      </section>
      {editing && (
        <AdminEditor
          member={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
        />
      )}
    </>
  );
}
function AdminEditor({
  member,
  close,
}: {
  member?: AdminMember;
  close: () => void;
}) {
  const [original] = useState(JSON.stringify(member));
  const [error, setError] = useState("");
  return (
    <Editor
      title={member ? "Modifica amministratore" : "Aggiungi amministratore"}
      description="Crea un membro del team, poi prepara il suo accesso personale con un invito."
      close={close}
    >
      <form
        className="crm-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next: AdminMember = {
            id: member?.id || crypto.randomUUID(),
            name: String(f.get("name")).trim(),
            email: String(f.get("email")).trim().toLowerCase(),
            role: member?.role || "admin",
            status: member?.status || "draft",
          };
          try {
            await updateCrm((s) => {
              if (
                member &&
                JSON.stringify(s.admins.find((a) => a.id === member.id)) !==
                  original
              )
                throw new Error(
                  "Amministratore modificato altrove. Chiudi e riapri il form.",
                );
              if (!next.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))
                throw new Error("Inserisci nome ed email validi.");
              if (
                s.admins.some(
                  (a) =>
                    a.id !== next.id && a.email.toLowerCase() === next.email,
                )
              )
                throw new Error(
                  "Questa email appartiene già a un amministratore.",
                );
              return {
                ...s,
                admins: member
                  ? s.admins.map((a) => (a.id === next.id ? next : a))
                  : [...s.admins, next],
              };
            });
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Nome e cognome *">
          <input
            className={control}
            name="name"
            required
            defaultValue={member?.name}
          />
        </Field>
        <Field label="Email *">
          <input
            className={control}
            name="email"
            readOnly={Boolean(member?.access)}
            required
            type="email"
            defaultValue={member?.email}
          />
        </Field>
        <Field label="Ruolo">
          <input
            className={control}
            readOnly
            value={member?.role === "owner" ? "Proprietario" : "Amministratore"}
          />
        </Field>
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Salva amministratore</Button>
        </div>
      </form>
    </Editor>
  );
}
