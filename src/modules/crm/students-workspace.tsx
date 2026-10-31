"use client";
import Link from "next/link";
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
        eyebrow="CRM · Persone al centro"
        title="Studenti"
        description="Gestisci anagrafiche, tier e proprietà con viste personalizzate."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/impostazioni/proprieta">
                Gestisci proprietà
              </Link>
            </Button>
            <Button onClick={() => setAdding(true)}>Aggiungi studente</Button>
          </div>
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
      <StudentsDirectory />
      {adding && (
        <StudentEditor
          close={() => setAdding(false)}
          saved={() =>
            setMessage(
              "Studente creato. Apri la scheda per preparare l’accesso personale.",
            )
          }
        />
      )}
    </>
  );
}
