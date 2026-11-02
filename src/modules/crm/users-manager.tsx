"use client";
import { studentAccessLabel } from "./student-access";
import { TierPicker } from "./tier-picker";
import { studentTierIds } from "./student-tiers";
import Link from "next/link";
import { InviteButton } from "./invite-button";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCrm, updateCrm, useViewer, useRemoteMode } from "./store";
import type { AccountAccess, AdminMember, CrmStudent } from "./model";
import { StudentCreateDialog } from "./student-editor";
import {
  EditorCancel,
  Editor,
  Field,
  control,
  FormError,
  LocalNotice,
} from "./ui";
const accessLabel = (access?: AccountAccess | null) =>
  access?.status === "active"
    ? "Account attivo"
    : access
      ? "Invito preparato"
      : "Accesso non creato";
const row =
  "flex flex-col gap-5 rounded-xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6";
const badge = "rounded-md bg-muted px-2 py-1 text-[11px]";
function TierSelect({ student }: { student: CrmStudent }) {
  const state = useCrm();
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <TierPicker
        tiers={state.tiers}
        value={studentTierIds(student)}
        onChange={async (ids) => {
          try {
            if (!ids.length) throw new Error("Seleziona almeno un tier.");
            await updateCrm((s) => ({
              ...s,
              students: s.students.map((x) =>
                x.id === student.id
                  ? { ...x, tierId: ids[0]!, tierIds: ids }
                  : x,
              ),
            }));
            setError("");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      <FormError message={error} />
    </div>
  );
}
export function UsersManager({
  initialTab = "admins",
}: {
  initialTab?: "admins" | "students";
}) {
  const state = useCrm();
  const viewer = useViewer(),
    remote = useRemoteMode();
  const canManageAdmins = !remote || viewer?.role === "owner";
  const [tab, setTab] = useState<string>(initialTab);
  const [editingAdmin, setEditingAdmin] = useState<AdminMember | "new" | null>(
    null,
  );
  const [editingStudent, setEditingStudent] = useState<
    CrmStudent | "new" | null
  >(null);
  const students = state.students.filter((s) => !s.archived);
  return (
    <>
      <PageHeading
        eyebrow="Impostazioni"
        title="Utenti"
        description="Gestisci accessi e permessi. Il ruolo si sceglie alla creazione e non può essere cambiato."
        action={
          tab === "admins" ? (
            <Button
              disabled={!canManageAdmins}
              onClick={() => setEditingAdmin("new")}
            >
              Aggiungi amministratore
            </Button>
          ) : (
            <Button onClick={() => setEditingStudent("new")}>
              Aggiungi studente
            </Button>
          )
        }
      />
      <LocalNotice />
      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList className="group-data-horizontal/tabs:h-10">
          <TabsTrigger className="px-4" value="admins">
            Amministratori ({state.admins.length})
          </TabsTrigger>
          <TabsTrigger className="px-4" value="students">
            Studenti ({students.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="admins" className="space-y-3">
          {state.admins.map((a) => (
            <article key={a.id} className={row}>
              <div className="min-w-[180px] flex-1 break-words">
                <h2 className="text-sm font-semibold">{a.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{a.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span className="text-xs">
                  {a.role === "owner" ? "Proprietario" : "Amministratore"}
                </span>
                <span className={badge}>{accessLabel(a.access)}</span>
                {a.role !== "owner" && (
                  <InviteButton
                    id={a.id}
                    kind="admin"
                    disabled={!canManageAdmins}
                    label={a.access ? "Nuovo link" : "Dai accesso"}
                  />
                )}
                <Button
                  variant="outline"
                  disabled={!canManageAdmins}
                  onClick={() => setEditingAdmin(a)}
                >
                  Modifica
                </Button>
              </div>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="students" className="space-y-3">
          {students.map((s) => (
            <article key={s.id} className={row}>
              <div className="min-w-[180px] flex-1 break-words">
                <h2 className="text-sm font-semibold">
                  <Link
                    className="hover:underline"
                    href={`/admin/studenti/${encodeURIComponent(s.id)}`}
                  >
                    {s.firstName} {s.lastName}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{s.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <TierSelect student={s} />
                <span className={badge}>{studentAccessLabel(s)}</span>
                <InviteButton
                  id={s.id}
                  kind="student"
                  label={s.access ? "Nuovo link" : "Dai accesso"}
                />
                <Button variant="outline" asChild>
                  <Link href={`/admin/studenti/${encodeURIComponent(s.id)}`}>
                    Modifica
                  </Link>
                </Button>
              </div>
            </article>
          ))}
          {!students.length && (
            <p className="rounded-xl border border-dashed bg-white px-6 py-16 text-center text-sm text-muted-foreground">
              Nessuno studente ancora presente.
            </p>
          )}
        </TabsContent>
      </Tabs>
      {editingAdmin && (
        <AdminEditor
          member={editingAdmin === "new" ? undefined : editingAdmin}
          close={() => setEditingAdmin(null)}
        />
      )}
      {editingStudent === "new" && (
        <StudentCreateDialog close={() => setEditingStudent(null)} />
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
            ...(String(f.get("avatarUrl") ?? "").trim()
              ? { avatarUrl: String(f.get("avatarUrl")).trim() }
              : {}),
            ...(member?.availability
              ? { availability: member.availability }
              : {}),
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
        <Field
          label="Foto profilo"
          hint="Link HTTPS alla foto. Compare agli studenti che hanno questo coach assegnato."
        >
          <input
            className={control}
            name="avatarUrl"
            type="url"
            placeholder="https://…"
            defaultValue={member?.avatarUrl}
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
