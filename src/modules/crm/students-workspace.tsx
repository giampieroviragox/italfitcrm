"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { StudentsDirectory } from "@/modules/students/components/students-directory";
import { StudentCreateDialog } from "./student-editor";
import { LocalNotice } from "./ui";
import { useCan } from "./store";
export function StudentsWorkspace() {
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const canEdit = useCan()("students.edit");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeading
        title="Studenti"
        description="Anagrafiche, tier e accesso alla piattaforma."
        action={
          canEdit ? (
            <Button
              size="lg"
              className="rounded-full"
              onClick={() => setAdding(true)}
            >
              <Plus />
              Aggiungi studente
            </Button>
          ) : undefined
        }
      />
      <LocalNotice />
      {message && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300"
        >
          {message}
        </p>
      )}
      <StudentsDirectory onAdd={() => setAdding(true)} />
      {adding && canEdit && (
        <StudentCreateDialog
          close={() => setAdding(false)}
          saved={(_, accessRequested) =>
            setMessage(
              accessRequested
                ? "Studente creato. Lo stato dell’accesso è indicato nella scheda."
                : "Studente creato senza accesso. Puoi invitarlo dalla scheda quando serve.",
            )
          }
        />
      )}
    </div>
  );
}
