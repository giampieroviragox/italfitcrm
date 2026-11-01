import type { CrmState, CrmStudent } from "./model.ts";

export function studentAccessEnabled(student: CrmStudent) {
  return (
    Boolean(student.access) &&
    student.access?.enabled !== false &&
    !student.accessDisabled &&
    !student.archived
  );
}

export function studentAccessLabel(student: CrmStudent) {
  if (!student.access) return "Non attivato";
  if (!studentAccessEnabled(student)) return "Disattivato";
  return student.access.status === "active"
    ? "Attivo"
    : "In attesa di attivazione";
}

export function setStudentAccess(
  state: CrmState,
  original: CrmStudent,
  enabled: boolean,
): CrmState {
  const student = state.students.find((s) => s.id === original.id);
  if (!student || (student.revision ?? 0) !== (original.revision ?? 0))
    throw new Error(
      "La scheda è cambiata. Aggiorna i dati prima di modificare l’accesso.",
    );
  if (!student.access)
    throw new Error("Prepara prima il link personale dello studente.");
  if (student.archived)
    throw new Error("La scheda non è disponibile per l’attivazione.");
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === student.id
        ? { ...s, accessDisabled: !enabled, access: { ...s.access!, enabled } }
        : s,
    ),
  };
}
