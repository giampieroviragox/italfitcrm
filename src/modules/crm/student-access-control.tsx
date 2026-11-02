"use client";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InviteDialog } from "./invite-button";
import { updateCrm, useRemoteMode, useSaving } from "./store";
import { Editor, EditorCancel, Field, control, FormError } from "./ui";
import { useNavigationRequest } from "./use-unsaved-changes";
import { setStudentAccess, studentAccessEnabled } from "./student-access";
import type { CrmStudent } from "./model";

export function StudentAccessControl({ student }: { student: CrmStudent }) {
  const remote = useRemoteMode();
  const request = useNavigationRequest();
  const saving = useSaving();
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const enabled = studentAccessEnabled(student);
  if (!remote)
    return (
      <>
        <Button
          type="button"
          disabled={student.archived}
          onClick={() => request(() => setInviting(true))}
        >
          <UserPlus className="size-4" />
          Invita studente
        </Button>
        {inviting && (
          <Editor
            centered
            title="Invita studente"
            description="Accesso personale alla piattaforma."
            close={() => setInviting(false)}
          >
            <div className="crm-editor-form">
              <Field label="Email dello studente">
                <input className={control} value={student.email} readOnly />
              </Field>
              <p
                role="status"
                className="rounded-lg border bg-muted/40 p-4 text-sm leading-6"
              >
                Gli inviti non sono disponibili nella demo locale. Per generare
                un link personale o inviare un invito serve il workspace
                collegato.
              </p>
              <Button type="button" disabled>
                Genera link personale
              </Button>
              <EditorCancel />
            </div>
          </Editor>
        )}
      </>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant={enabled ? "outline" : "default"}
          disabled={!remote || saving || student.archived}
          onClick={async () => {
            if (!student.access) {
              request(() => setInviting(true));
              return;
            }
            try {
              await updateCrm((state) =>
                setStudentAccess(state, student, !enabled),
              );
              setError("");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Impossibile modificare l’accesso.",
              );
            }
          }}
        >
          {saving
            ? "Salvataggio…"
            : enabled
              ? "Disattiva accesso"
              : student.access
                ? "Riattiva accesso"
                : "Invita studente"}
        </Button>
        {enabled && (
          <Button
            variant="ghost"
            disabled={saving || !remote}
            onClick={() => request(() => setInviting(true))}
          >
            Prepara link
          </Button>
        )}
      </div>
      {inviting && (
        <InviteDialog
          id={student.id}
          kind="student"
          close={() => setInviting(false)}
        />
      )}
    </div>
  );
}
