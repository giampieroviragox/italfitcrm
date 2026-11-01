"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { StudentsDirectory } from "@/modules/students/components/students-directory";
import { StudentEditor } from "./student-editor";
import { LocalNotice } from "./ui";
export function StudentsWorkspace() {
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <>
      <PageHeading
        title="Studenti"
        description="Gestisci anagrafiche, tier e proprietà con viste personalizzate."
        action={
          <Button onClick={() => setAdding(true)}>Aggiungi studente</Button>
        }
      />
      <LocalNotice />
      {message && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-green-50 p-3 text-xs text-green-800"
        >
          {message}
        </p>
      )}
      <StudentsDirectory onAdd={() => setAdding(true)} />
      {adding && (
        <StudentEditor
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
    </>
  );
}
