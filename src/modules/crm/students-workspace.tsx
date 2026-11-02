"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { StudentsDirectory } from "@/modules/students/components/students-directory";
import { StudentCreateDialog } from "./student-editor";
import { LocalNotice } from "./ui";
export function StudentsWorkspace() {
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeading
        title="Studenti"
        action={
          <Button onClick={() => setAdding(true)}>Aggiungi studente</Button>
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
      {adding && (
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
