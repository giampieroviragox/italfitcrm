import { studentTierIds, studentTierLabel } from "./student-tiers.ts";
import {
  emptyValue,
  formatPropertyValue,
  type CrmProperty,
  type CrmState,
  type CrmStudent,
  type CrmTier,
  type PropertyValue,
} from "./model.ts";
import { formatDate } from "../../lib/format.ts";
import { studentAccessLabel } from "./student-access.ts";

export const studentColumns = [
  { id: "email", name: "Email", type: "email" },
  { id: "tier", name: "Tier", type: "select" },
  { id: "access", name: "Accesso", type: "select" },
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

export function placeColumn(
  columns: readonly string[],
  from: string,
  to: string,
  side: "before" | "after",
) {
  if (from === to || !columns.includes(from) || !columns.includes(to))
    return [...columns];
  const next = columns.filter((id) => id !== from);
  next.splice(next.indexOf(to) + (side === "after" ? 1 : 0), 0, from);
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
  } else if (column === "tier") {
    const ids = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? [value]
        : [];
    if (!ids.length) throw new Error("Seleziona almeno un tier.");
    next.tierId = ids[0]!;
    next.tierIds = ids;
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

export interface StudentGroup {
  key: string;
  label: string;
  students: CrmStudent[];
  total: number;
}

export function groupStudents(
  students: readonly CrmStudent[],
  groupBy: string | undefined,
  properties: readonly CrmProperty[],
  tiers: readonly CrmTier[],
): StudentGroup[] {
  const property = properties.find(
    (p) => `property:${p.id}` === groupBy && !p.archived,
  );
  if (!groupBy || (!property && !studentColumns.some((c) => c.id === groupBy)))
    return [
      {
        key: "all",
        label: "",
        students: [...students],
        total: students.length,
      },
    ];
  const groups = new Map<string, StudentGroup>();
  for (const student of students) {
    const value = property
      ? student.properties[property.id]
      : groupBy === "access"
        ? studentAccessLabel(student)
        : groupBy === "tier"
          ? studentTierIds(student).toSorted()
          : student[
              groupBy as "status" | "coach" | "email" | "phone" | "joinedAt"
            ];
    const empty = emptyValue(value);
    const key = empty
      ? "empty"
      : JSON.stringify(Array.isArray(value) ? [...value].sort() : value);
    const label = empty
      ? "Non compilato"
      : property
        ? formatPropertyValue(property, value)
        : groupBy === "tier"
          ? studentTierLabel(student, tiers)
          : groupBy === "access"
            ? studentAccessLabel(student)
            : groupBy === "joinedAt"
              ? formatDate(String(value))
              : String(value);
    const group = groups.get(key) ?? { key, label, students: [], total: 0 };
    group.students.push(student);
    group.total++;
    groups.set(key, group);
  }
  const collator = new Intl.Collator("it", {
    numeric: true,
    sensitivity: "base",
  });
  return [...groups.values()].sort((a, b) => {
    if (a.key === "empty") return 1;
    if (b.key === "empty") return -1;
    if (property?.type === "number") return Number(a.key) - Number(b.key);
    if (property?.type === "date" || groupBy === "joinedAt")
      return a.key.localeCompare(b.key);
    return collator.compare(a.label, b.label);
  });
}

/** Paginate the grouped order, retaining each group's total across pages. */
export function pageStudentGroups(
  groups: readonly StudentGroup[],
  start: number,
  size: number,
): StudentGroup[] {
  let offset = 0;
  return groups.flatMap((group) => {
    const from = Math.max(0, start - offset);
    const to = Math.max(0, start + size - offset);
    offset += group.students.length;
    const students = group.students.slice(from, to);
    return students.length ? [{ ...group, students }] : [];
  });
}
