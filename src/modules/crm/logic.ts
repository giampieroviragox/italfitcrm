import { studentAccessLabel } from "./student-access.ts";
import { studentTierIds, studentTierLabel } from "./student-tiers.ts";
import { assertFitnessTransition } from "./fitness-logic.ts";
import {
  emptyValue,
  normalize,
  validDate,
  validPropertyValue,
  choiceTypes,
  type CrmProperty,
  type CrmState,
  type CrmStudent,
  type DirectoryConfig,
  type FilterOperator,
  type PropertyFilter,
  type PropertyValue,
} from "./model.ts";
export function operatorsFor(
  p: CrmProperty,
): { value: FilterOperator; label: string }[] {
  const empty: { value: FilterOperator; label: string }[] = [
    { value: "is_empty", label: "Non compilato" },
    { value: "is_not_empty", label: "Compilato" },
  ];
  const equality: { value: FilterOperator; label: string }[] = [
    { value: "equals", label: "È uguale a" },
    { value: "not_equals", label: "È diverso da" },
  ];
  if (p.type === "number")
    return [
      ...equality,
      { value: "gt", label: "Maggiore di" },
      { value: "lt", label: "Minore di" },
      ...empty,
    ];
  if (p.type === "date")
    return [
      ...equality,
      { value: "before", label: "Prima del" },
      { value: "after", label: "Dopo il" },
      ...empty,
    ];
  if (p.type === "multiselect")
    return [
      { value: "has_any", label: "Contiene almeno una" },
      { value: "has_all", label: "Contiene tutte" },
      ...empty,
    ];
  if (["boolean", "select", "radio"].includes(p.type))
    return [...equality, ...empty];
  return [{ value: "contains", label: "Contiene" }, ...equality, ...empty];
}
export function matchesFilter(
  value: PropertyValue | undefined,
  filter: PropertyFilter,
  p: CrmProperty,
) {
  if (!operatorsFor(p).some((o) => o.value === filter.operator)) return false;
  if (filter.operator === "is_empty") return emptyValue(value);
  if (filter.operator === "is_not_empty") return !emptyValue(value);
  // Missing operands never silently match all records.
  if (emptyValue(value)) return false;
  if (p.type === "multiselect") {
    const wanted = filter.values ?? [];
    if (!wanted.length || !Array.isArray(value)) return false;
    return filter.operator === "has_all"
      ? wanted.every((x) => value.includes(x))
      : wanted.some((x) => value.includes(x));
  }
  if (!filter.value.trim()) return false;
  if (p.type === "boolean") {
    if (!["true", "false"].includes(filter.value)) return false;
    const equal = value === (filter.value === "true");
    return filter.operator === "not_equals" ? !equal : equal;
  }
  if (p.type === "number") {
    const n = Number(filter.value);
    if (!Number.isFinite(n) || typeof value !== "number") return false;
    return filter.operator === "gt"
      ? value > n
      : filter.operator === "lt"
        ? value < n
        : filter.operator === "not_equals"
          ? value !== n
          : value === n;
  }
  if (p.type === "date") {
    if (typeof value !== "string" || !validDate(filter.value)) return false;
    return filter.operator === "before"
      ? value < filter.value
      : filter.operator === "after"
        ? value > filter.value
        : filter.operator === "not_equals"
          ? value !== filter.value
          : value === filter.value;
  }
  const a = normalize(String(value)),
    b = normalize(filter.value);
  return filter.operator === "contains"
    ? a.includes(b)
    : filter.operator === "not_equals"
      ? a !== b
      : a === b;
}
export function sanitizeDirectory(
  config: DirectoryConfig,
  state: Pick<CrmState, "properties" | "tiers">,
): DirectoryConfig {
  const ids = new Set(
    state.properties.filter((p) => !p.archived).map((p) => p.id),
  );
  return {
    ...config,
    status: "all",
    tier:
      config.tier === "all" || state.tiers.some((t) => t.id === config.tier)
        ? config.tier
        : "all",
    columns: [
      ...new Set(config.columns.map((id) => (id === "status" ? "access" : id))),
    ].filter(
      (id) =>
        ["email", "tier", "access", "joinedAt", "phone", "coach"].includes(
          id,
        ) ||
        (id.startsWith("property:") && ids.has(id.slice(9))),
    ),
    ...(config.columnWidths
      ? {
          columnWidths: Object.fromEntries(
            Object.entries(config.columnWidths)
              .map(
                ([id, width]) =>
                  [id === "status" ? "access" : id, width] as const,
              )
              .filter(
                ([id]) =>
                  [
                    "name",
                    "email",
                    "tier",
                    "access",
                    "joinedAt",
                    "phone",
                    "coach",
                  ].includes(id) ||
                  (id.startsWith("property:") && ids.has(id.slice(9))),
              ),
          ),
        }
      : {}),
    ...(config.groupBy !== undefined
      ? {
          groupBy:
            ["tier", "access", "coach", "email", "phone", "joinedAt"].includes(
              config.groupBy,
            ) ||
            (config.groupBy.startsWith("property:") &&
              ids.has(config.groupBy.slice(9)))
              ? config.groupBy
              : "",
        }
      : {}),
    filters: config.filters.filter((f) => ids.has(f.propertyId)),
    sortKey:
      config.sortKey.startsWith("property:") &&
      !ids.has(config.sortKey.slice(9))
        ? "joinedAt"
        : config.sortKey === "status"
          ? "access"
          : config.sortKey,
  };
}
export function selectStudents(
  students: readonly CrmStudent[],
  config: DirectoryConfig,
  properties: readonly CrmProperty[],
  tiers: CrmState["tiers"],
): CrmStudent[] {
  const active = properties.filter((p) => !p.archived),
    query = normalize(config.query);
  const result = students.filter(
    (s) =>
      Boolean(s.archived) === config.archived &&
      (config.tier === "all" || studentTierIds(s).includes(config.tier)) &&
      active.every(
        (p) =>
          !config.filters.some(
            (f) =>
              f.propertyId === p.id && !matchesFilter(s.properties[p.id], f, p),
          ),
      ) &&
      (!query ||
        normalize(
          [
            s.firstName,
            s.lastName,
            s.email,
            s.phone ?? "",
            s.coach,
            studentTierLabel(s, tiers),
            ...active.flatMap((p) => {
              const v = s.properties[p.id];
              return v === undefined
                ? []
                : Array.isArray(v)
                  ? v
                  : [typeof v === "boolean" ? (v ? "Sì" : "No") : String(v)];
            }),
          ].join(" "),
        ).includes(query)),
  );
  const key = (s: CrmStudent): PropertyValue | undefined =>
    config.sortKey.startsWith("property:")
      ? s.properties[config.sortKey.slice(9)]
      : config.sortKey === "name"
        ? `${s.lastName} ${s.firstName}`
        : config.sortKey === "tier"
          ? studentTierLabel(s, tiers)
          : config.sortKey === "coach"
            ? s.coach
            : config.sortKey === "access"
              ? studentAccessLabel(s)
              : config.sortKey === "email"
                ? s.email
                : config.sortKey === "phone"
                  ? s.phone
                  : s.joinedAt;
  const collator = new Intl.Collator("it", {
    numeric: true,
    sensitivity: "base",
  });
  return result.sort((a, b) => {
    const av = key(a),
      bv = key(b);
    if (emptyValue(av) && emptyValue(bv)) return a.id.localeCompare(b.id);
    if (emptyValue(av)) return 1;
    if (emptyValue(bv)) return -1;
    const n =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : collator.compare(String(av), String(bv));
    return (
      (config.sortDirection === "asc" ? n : -n) || a.id.localeCompare(b.id)
    );
  });
}
const email = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function unique(
  items: { id: string }[],
  key: (item: (typeof items)[number]) => string,
  label: string,
) {
  const values = items.map(key);
  if (new Set(values).size !== values.length)
    throw new Error(`${label}: sono presenti duplicati.`);
}
export function assertCrmTransition(previous: CrmState, next: CrmState) {
  unique(
    next.students,
    (s) => normalize((s as CrmStudent).email),
    "Email studenti",
  );
  unique(
    next.admins,
    (a) => normalize((a as CrmState["admins"][number]).email),
    "Email amministratori",
  );
  const contactEmails = [...next.students, ...next.admins].map((person) =>
    normalize(person.email),
  );
  if (new Set(contactEmails).size !== contactEmails.length)
    throw new Error(
      "Questa email è già utilizzata da uno studente o amministratore.",
    );
  unique(
    next.tiers,
    (t) => normalize((t as CrmState["tiers"][number]).name),
    "Nome tier",
  );
  for (const tier of next.tiers) {
    if (!tier.name.trim()) throw new Error("Il nome del tier è obbligatorio.");
    if (
      tier.archived &&
      next.students.some(
        (s) => !s.archived && studentTierIds(s).includes(tier.id),
      )
    )
      throw new Error(
        "Riassegna prima gli studenti non archiviati a un altro tier.",
      );
  }
  for (const member of next.admins)
    if (!member.name.trim() || !email(member.email))
      throw new Error("Nome ed email amministratore non validi.");
  for (const p of next.properties) {
    if (p.deleted && !p.archived)
      throw new Error("Una proprietà rimossa non può essere visibile.");
    if (!p.name.trim() || !p.group.trim())
      throw new Error("Nome e gruppo della proprietà sono obbligatori.");
    if (
      choiceTypes.includes(p.type) &&
      (p.options.length < 2 ||
        new Set(p.options.map(normalize)).size !== p.options.length ||
        p.options.some((o) => !o.trim()))
    )
      throw new Error("Inserisci almeno due opzioni distinte e non vuote.");
    const before = previous.properties.find((x) => x.id === p.id);
    if (before && before.type !== p.type)
      throw new Error("Il tipo della proprietà non può essere cambiato.");
    for (const s of next.students) {
      const v = s.properties[p.id];
      if (!emptyValue(v) && !validPropertyValue({ ...p, required: false }, v))
        throw new Error(
          `La proprietà “${p.name}” contiene valori incompatibili nella scheda ${s.firstName} ${s.lastName}.`,
        );
    }
  }
  for (const s of next.students) {
    const old = previous.students.find((x) => x.id === s.id);
    if (s.phone && !/^[+0-9(). \-]{6,30}$/.test(s.phone.trim()))
      throw new Error("Inserisci un numero di telefono valido.");
    if (
      !s.firstName.trim() ||
      !s.lastName.trim() ||
      !email(s.email) ||
      !validDate(s.joinedAt)
    )
      throw new Error("Anagrafica studente non valida.");
    const assigned = studentTierIds(s);
    if (
      !assigned.length ||
      new Set(assigned).size !== assigned.length ||
      assigned[0] !== s.tierId ||
      assigned.some(
        (id) =>
          !next.tiers.some((t) => t.id === id && (s.archived || !t.archived)),
      )
    )
      throw new Error("Seleziona un tier non archiviato.");
    if (old && JSON.stringify(old) === JSON.stringify(s)) continue;
    // Archive/restore and notes do not force unrelated missing required fields.
    const fields = (v: CrmStudent) =>
      JSON.stringify([
        v.firstName,
        v.lastName,
        v.email,
        v.phone,
        v.tierId,
        v.tierIds,
        v.status,
        v.coach,
        v.properties,
      ]);
    if (
      (!old || fields(old) !== fields(s)) &&
      !(old && Boolean(old.archived) !== Boolean(s.archived))
    )
      for (const p of next.properties.filter((p) => !p.archived))
        if (!validPropertyValue(p, s.properties[p.id]))
          throw new Error(
            `Controlla la proprietà “${p.name}”: valore mancante o non valido.`,
          );
  }
  const views = next.views ?? [];
  if (
    new Set(views.map((v) => normalize(v.name))).size !== views.length ||
    views.some(
      (v) => !v.name.trim() || normalize(v.name) === "tutti gli studenti",
    )
  )
    throw new Error("Usa nomi univoci per le viste.");
  assertFitnessTransition(previous, next);
}
export function bulkUpdate(
  state: CrmState,
  ids: readonly string[],
  patch: Pick<Partial<CrmStudent>, "status" | "tierId" | "archived">,
): CrmState {
  if (!ids.length) throw new Error("Seleziona almeno uno studente.");
  return {
    ...state,
    students: state.students.map((s) =>
      ids.includes(s.id)
        ? {
            ...s,
            ...patch,
            ...(patch.tierId ? { tierIds: [patch.tierId] } : {}),
          }
        : s,
    ),
  };
}
