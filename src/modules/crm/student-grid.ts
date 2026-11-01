import type { CrmState, CrmStudent, PropertyValue } from "./model.ts";

export const studentColumns = [
  { id: "email", name: "Email", type: "email" },
  { id: "tier", name: "Tier", type: "select" },
  { id: "status", name: "Stato", type: "select" },
  { id: "joinedAt", name: "Aggiunto il", type: "date" },
  { id: "phone", name: "Telefono", type: "phone" },
  { id: "coach", name: "Coach", type: "text" },
] as const;

export function moveColumn(
  columns: readonly string[],
  from: string,
  to: string,
) {
  if (from === to || !columns.includes(from) || !columns.includes(to))
    return [...columns];
  const next = columns.filter((id) => id !== from);
  next.splice(columns.indexOf(to), 0, from);
  return next;
}

/** Apply just the edited field to the latest record; never replace a stale row. */
export function editStudentCell(
  state: CrmState,
  original: CrmStudent,
  column: string,
  value: PropertyValue,
  lastName?: string,
): CrmState {
  const latest = state.students.find((s) => s.id === original.id);
  if (!latest || (latest.revision ?? 0) !== (original.revision ?? 0))
    throw new Error(
      "Questa scheda è stata modificata altrove. Chiudi e riapri la cella per caricare i dati aggiornati.",
    );
  if (latest.archived)
    throw new Error("Ripristina lo studente prima di modificarlo.");
  const next = { ...latest };
  if (column.startsWith("property:")) {
    const id = column.slice(9);
    if (!state.properties.some((p) => p.id === id && !p.archived))
      throw new Error("Questa proprietà non è più disponibile.");
    next.properties = { ...latest.properties, [id]: value };
  } else {
    if (typeof value !== "string") throw new Error("Valore non valido.");
    const text = value.trim();
    switch (column) {
      case "name":
        next.firstName = text;
        next.lastName = (lastName ?? "").trim();
        break;
      case "email":
        if (latest.access)
          throw new Error("L’email è collegata all’account personale.");
        next.email = text.toLowerCase();
        break;
      case "tier":
        next.tierId = text;
        break;
      case "status":
        if (!["active", "paused", "invited"].includes(text))
          throw new Error("Stato non valido.");
        next.status = text as CrmStudent["status"];
        break;
      case "phone":
      case "coach":
        next[column] = text;
        break;
      default:
        throw new Error("Questo campo non è modificabile dalla griglia.");
    }
  }
  return {
    ...state,
    students: state.students.map((s) => (s.id === next.id ? next : s)),
  };
}
