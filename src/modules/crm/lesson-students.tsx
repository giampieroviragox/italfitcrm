"use client";
import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectControl } from "@/components/ui/select-control";
import { useCrm } from "./store";
import { control } from "./ui";
import { StudentCreateDialog } from "./student-editor";
import type { CrmStudent } from "./model";

const fullName = (s: Pick<CrmStudent, "firstName" | "lastName">) =>
  `${s.firstName} ${s.lastName}`.trim();

/** "Aggiungi studente": creates the record, then hands the new id back. */
export function NewStudentButton({
  onCreated,
  className,
}: {
  onCreated: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => setOpen(true)}
      >
        <UserPlus className="size-4" />
        Nuovo studente
      </Button>
      {open && (
        // React events cross portals: without this the dialog's submit would
        // also submit the lesson form this button sits in.
        <div onSubmit={(event) => event.stopPropagation()}>
          <StudentCreateDialog
            close={() => setOpen(false)}
            saved={(id) => onCreated(id)}
          />
        </div>
      )}
    </>
  );
}

/**
 * Chooses one or more students for a lesson. `allowed` are the students who
 * can be enrolled; a selected student outside that list is flagged.
 */
export function StudentPicker({
  allowed,
  selected,
  onChange,
  max,
}: {
  allowed: CrmStudent[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const state = useCrm();
  const options = allowed.filter((s) => !selected.includes(s.id));
  const full = max !== undefined && selected.length >= max;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1">
          <SelectControl
            className={control}
            aria-label="Aggiungi uno studente esistente"
            value=""
            disabled={full || !options.length}
            onChange={(e) =>
              e.target.value && onChange([...selected, e.target.value])
            }
          >
            <option value="">
              {full
                ? "Posti esauriti"
                : options.length
                  ? "Scegli uno studente…"
                  : "Nessuno studente disponibile"}
            </option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {fullName(s)}
              </option>
            ))}
          </SelectControl>
        </div>
        <NewStudentButton onCreated={(id) => onChange([...selected, id])} />
      </div>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Studenti scelti">
          {selected.map((id) => {
            const student = state.students.find((s) => s.id === id);
            const ok = allowed.some((s) => s.id === id);
            return (
              <li
                key={id}
                className={`flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-3 text-sm ${ok ? "" : "border-destructive/40 text-destructive"}`}
              >
                <span>
                  {student ? fullName(student) : "Studente"}
                  {!ok && " · lezioni non incluse"}
                </span>
                <button
                  type="button"
                  aria-label={`Togli ${student ? fullName(student) : "studente"}`}
                  className="grid size-6 place-items-center rounded-full hover:bg-muted"
                  onClick={() => onChange(selected.filter((x) => x !== id))}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
