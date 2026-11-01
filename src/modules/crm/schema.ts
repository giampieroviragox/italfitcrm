import { propertyTypes, type CrmState, type PropertyValue } from "./model.ts";
import { isFitnessData } from "./fitness-logic.ts";
import { isTierAccess } from "./tier-access.ts";
import { isAvailability } from "./availability.ts";
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const value = (v: unknown): v is PropertyValue =>
  typeof v === "string" ||
  typeof v === "boolean" ||
  (typeof v === "number" && Number.isFinite(v)) ||
  strings(v);
function validDirectory(c: unknown): boolean {
  if (!isObject(c)) return false;
  return (
    typeof c.query === "string" &&
    ["all", "active", "invited", "paused"].includes(String(c.status)) &&
    typeof c.tier === "string" &&
    typeof c.archived === "boolean" &&
    strings(c.columns) &&
    ["table", "grid"].includes(String(c.layout)) &&
    typeof c.sortKey === "string" &&
    ["asc", "desc"].includes(String(c.sortDirection)) &&
    typeof c.pageSize === "number" &&
    [10, 25, 50].includes(c.pageSize) &&
    Array.isArray(c.filters) &&
    c.filters.every(
      (f) =>
        isObject(f) &&
        typeof f.id === "string" &&
        typeof f.propertyId === "string" &&
        typeof f.value === "string" &&
        [
          "contains",
          "equals",
          "not_equals",
          "gt",
          "lt",
          "before",
          "after",
          "has_any",
          "has_all",
          "is_empty",
          "is_not_empty",
        ].includes(String(f.operator)) &&
        (f.values === undefined || strings(f.values)),
    )
  );
}
export function isCrmState(v: unknown): v is CrmState {
  if (
    !isObject(v) ||
    v.version !== 1 ||
    !Array.isArray(v.students) ||
    !Array.isArray(v.tiers) ||
    !Array.isArray(v.properties) ||
    !Array.isArray(v.admins)
  )
    return false;
  const unique = (items: unknown[]) =>
    items.every(
      (x) => isObject(x) && typeof x.id === "string" && x.id.trim().length > 0,
    ) &&
    new Set(items.map((x) => (x as Record<string, unknown>).id)).size ===
      items.length;
  return (
    isFitnessData(v) &&
    (v.directory === undefined || validDirectory(v.directory)) &&
    (v.activeViewId === undefined || typeof v.activeViewId === "string") &&
    (v.views === undefined ||
      (Array.isArray(v.views) &&
        unique(v.views) &&
        v.views.every(
          (view) =>
            isObject(view) &&
            typeof view.id === "string" &&
            typeof view.name === "string" &&
            validDirectory(view.config),
        ))) &&
    [v.students, v.tiers, v.properties, v.admins].every(unique) &&
    v.tiers.every(
      (t) =>
        isObject(t) &&
        ["id", "name", "description"].every((k) => typeof t[k] === "string") &&
        typeof t.archived === "boolean" &&
        (t.entitlements === undefined || isTierAccess(t.entitlements)),
    ) &&
    v.properties.every(
      (p) =>
        isObject(p) &&
        ["id", "name", "description", "group"].every(
          (k) => typeof p[k] === "string",
        ) &&
        typeof p.type === "string" &&
        Object.hasOwn(propertyTypes, p.type) &&
        typeof p.required === "boolean" &&
        typeof p.archived === "boolean" &&
        strings(p.options),
    ) &&
    v.students.every(
      (s) =>
        isObject(s) &&
        [
          "id",
          "firstName",
          "lastName",
          "email",
          "tierId",
          "joinedAt",
          "coach",
        ].every((k) => typeof s[k] === "string") &&
        ["active", "invited", "paused"].includes(String(s.status)) &&
        (s.phone === undefined || typeof s.phone === "string") &&
        (s.archived === undefined || typeof s.archived === "boolean") &&
        (s.revision === undefined ||
          (Number.isSafeInteger(s.revision) && Number(s.revision) >= 0)) &&
        ["notes", "history"].every(
          (k) =>
            s[k] === undefined ||
            (Array.isArray(s[k]) &&
              s[k].every(
                (n: unknown) =>
                  isObject(n) &&
                  typeof n.id === "string" &&
                  typeof n.text === "string" &&
                  (n.actorId === undefined || typeof n.actorId === "string") &&
                  (n.actorName === undefined ||
                    typeof n.actorName === "string") &&
                  (n.details === undefined || strings(n.details)) &&
                  typeof n.createdAt === "string" &&
                  Number.isFinite(Date.parse(n.createdAt)),
              )),
        ) &&
        isObject(s.properties) &&
        Object.values(s.properties).every(value) &&
        (v.tiers as Record<string, unknown>[]).some((t) => t.id === s.tierId),
    ) &&
    v.admins.every(
      (a) =>
        isObject(a) &&
        ["id", "name", "email"].every((k) => typeof a[k] === "string") &&
        ["owner", "admin"].includes(String(a.role)) &&
        ["draft", "active"].includes(String(a.status)) &&
        (a.availability === undefined || isAvailability(a.availability)),
    ) &&
    v.admins.some((a) => isObject(a) && a.role === "owner")
  );
}
