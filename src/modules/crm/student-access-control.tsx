"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InviteDialog } from "./invite-button";
import { updateCrm, useRemoteMode, useSaving } from "./store";
import { FormError } from "./ui";
import { setStudentAccess, studentAccessEnabled } from "./student-access";
import type { CrmStudent } from "./model";

export function StudentAccessControl({ student }: { student: CrmStudent }) {
  const remote = useRemoteMode();
  const saving = useSaving();
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const enabled = studentAccessEnabled(student);
  if (!remote) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant={enabled ? "outline" : "default"}
          disabled={!remote || saving || student.archived}
          onClick={async () => {
            if (!student.access) {
              setInviting(true);
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
                : "Attiva accesso"}
        </Button>
        {enabled && (
          <Button
            variant="ghost"
            disabled={saving || !remote}
            onClick={() => setInviting(true)}
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
