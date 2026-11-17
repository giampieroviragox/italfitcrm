"use client";
import { InviteButton } from "./invite-button";
import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrm, updateCrm, useViewer, useRemoteMode } from "./store";
import type { AccountAccess, AdminMember } from "./model";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { SelectControl } from "@/components/ui/select-control";
import {
  allPermissions,
  memberPermissions,
  permissionCatalog,
  roleLabel,
  teamRoles,
  type Permission,
  type TeamRole,
} from "./permissions";
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
export function UsersManager() {
  const state = useCrm();
  const viewer = useViewer(),
    remote = useRemoteMode();
  const canManageAdmins = !remote || viewer?.role === "owner";
  const [editingAdmin, setEditingAdmin] = useState<AdminMember | "new" | null>(
    null,
  );
  return (
    <>
      <LocalNotice />
      <SettingsSection
        title="Team"
        description="Il super admin vede tutto e gestisce ruoli e permessi. Admin e coach vedono solo ciò che il loro ruolo consente."
        action={
          <Button
            size="sm"
            disabled={!canManageAdmins}
            onClick={() => setEditingAdmin("new")}
          >
            <Plus className="size-3.5" />
            Aggiungi
          </Button>
        }
      >
        {state.admins.map((a) => (
          <SettingsRow
            key={a.id}
            title={a.name}
            description={`${roleLabel(a)}${a.role !== "owner" && a.permissions ? " (permessi personalizzati)" : ""} · ${a.email} · ${a.role === "owner" ? "Proprietario" : accessLabel(a.access)}${a.compensationPercent ? ` · compenso ${a.compensationPercent}%` : ""}`}
          >
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
              size="sm"
              disabled={!canManageAdmins}
              onClick={() => setEditingAdmin(a)}
            >
              Modifica
            </Button>
          </SettingsRow>
        ))}
      </SettingsSection>
      {editingAdmin && (
        <AdminEditor
          member={editingAdmin === "new" ? undefined : editingAdmin}
          close={() => setEditingAdmin(null)}
        />
      )}
    </>
  );
}
/** A titled group of settings rows, separated by hairlines. */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-medium">{title}</h2>
          {description && (
            <p className="text-[13px] text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="divide-y border-t">{children}</div>
    </section>
  );
}
export function SettingsRow({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 break-words">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
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
  const owner = member?.role === "owner";
  const [teamRole, setTeamRole] = useState<TeamRole>(
    member?.teamRole ?? "admin",
  );
  const [custom, setCustom] = useState(Boolean(member?.permissions));
  const [permissions, setPermissions] = useState<Permission[]>(() => [
    ...memberPermissions(member ?? ({ role: "admin" } as AdminMember)),
  ]);
  const shown = custom ? permissions : teamRoles[teamRole].permissions;
  return (
    <Editor
      title={
        member ? "Modifica membro del team" : "Aggiungi un membro del team"
      }
      description="Scegli ruolo e permessi, poi prepara il suo accesso personale con un invito."
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
            ...(owner ? {} : { teamRole }),
            ...(!owner && custom
              ? {
                  permissions: allPermissions.filter((p) =>
                    permissions.includes(p),
                  ),
                }
              : {}),
            ...(String(f.get("compensationPercent") ?? "").trim()
              ? {
                  compensationPercent: Number(
                    String(f.get("compensationPercent")).replace(",", "."),
                  ),
                }
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
                next.compensationPercent !== undefined &&
                !(
                  next.compensationPercent >= 0 &&
                  next.compensationPercent <= 100
                )
              )
                throw new Error("Il compenso deve essere tra 0 e 100%.");
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
        {owner ? (
          <Field label="Ruolo">
            <input
              className={control}
              readOnly
              value="Super admin · tutti i permessi"
            />
          </Field>
        ) : (
          <>
            <Field label="Ruolo" hint={teamRoles[teamRole].hint}>
              <SelectControl
                className={control}
                value={teamRole}
                onChange={(e) => {
                  const next = e.target.value === "coach" ? "coach" : "admin";
                  setTeamRole(next);
                  if (!custom) setPermissions([...teamRoles[next].permissions]);
                }}
              >
                {Object.entries(teamRoles).map(([value, role]) => (
                  <option key={value} value={value}>
                    {role.label}
                  </option>
                ))}
              </SelectControl>
            </Field>
            <fieldset className="space-y-2 rounded-xl border p-3">
              <legend className="px-1 text-sm font-medium">Permessi</legend>
              <label className="flex items-center gap-2 text-sm">
                <CheckboxControl
                  checked={custom}
                  onChange={(e) => {
                    setCustom(e.target.checked);
                    if (e.target.checked)
                      setPermissions([...teamRoles[teamRole].permissions]);
                  }}
                />
                Personalizza i permessi di questa persona
              </label>
              <ul className="space-y-1.5">
                {allPermissions.map((permission) => (
                  <li key={permission}>
                    <label className="flex items-start gap-2 text-sm">
                      <CheckboxControl
                        disabled={!custom}
                        checked={shown.includes(permission)}
                        onChange={(e) =>
                          setPermissions((list) =>
                            e.target.checked
                              ? [...list, permission]
                              : list.filter((p) => p !== permission),
                          )
                        }
                      />
                      <span>
                        <span className="block font-medium">
                          {permissionCatalog[permission].label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {permissionCatalog[permission].hint}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          </>
        )}
        <Field
          label="Compenso sui piani seguiti (%)"
          hint="Quota del valore di ogni piano mensile che segue come coach (prezzo dell’abbonamento diviso i mesi). Lascia vuoto se non riceve compensi."
        >
          <input
            className={control}
            name="compensationPercent"
            inputMode="decimal"
            placeholder="Es. 40"
            defaultValue={member?.compensationPercent ?? ""}
          />
        </Field>
        <FormError message={error} />
        <div className="crm-form-actions">
          <EditorCancel />
          <Button type="submit">Salva</Button>
        </div>
      </form>
    </Editor>
  );
}
