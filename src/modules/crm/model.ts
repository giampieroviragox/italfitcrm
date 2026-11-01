import type { AvailabilitySlot } from "./availability.ts";
import type { Student } from "@/types/domain";
export const propertyTypes = {
  text: "Testo su una riga",
  textarea: "Testo multiriga",
  number: "Numero",
  date: "Data",
  select: "Menu a tendina",
  radio: "Scelta singola",
  multiselect: "Scelta multipla",
  boolean: "Sì / No",
  url: "Link",
  email: "Email",
  phone: "Telefono",
} as const;
export type PropertyType = keyof typeof propertyTypes;
export type PropertyValue = string | number | boolean | string[];
export interface CrmProperty {
  id: string;
  name: string;
  type: PropertyType;
  description: string;
  group: string;
  required: boolean;
  options: string[];
  archived: boolean;
}
export interface CrmTier {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  entitlements?: TierAccess;
}
export interface TierAccess {
  plans: boolean;
  lessons: boolean;
  monthlyBookingLimit: number | null;
}
export interface AccountAccess {
  status: "invited" | "active";
  invitedAt: string;
}
export interface CrmStudent extends Omit<Student, "tierId"> {
  access?: AccountAccess | null;
  tierId: string;
  properties: Record<string, PropertyValue>;
  archived?: boolean;
  notes?: CrmNote[];
  history?: CrmActivity[];
  revision?: number;
}
export interface AdminMember {
  access?: AccountAccess | null;
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin";
  status: "draft" | "active";
  availability?: AvailabilitySlot[];
}
export interface CrmState {
  version: 1;
  plans?: import("./fitness-model").WorkoutPlan[];
  assignments?: import("./fitness-model").PlanAssignment[];
  lessons?: import("./fitness-model").Lesson[];
  bookings?: import("./fitness-model").LessonBooking[];
  views?: CrmView[];
  directory?: DirectoryConfig;
  activeViewId?: string;
  students: CrmStudent[];
  tiers: CrmTier[];
  properties: CrmProperty[];
  admins: AdminMember[];
}
export function displayValue(value: PropertyValue | undefined) {
  return value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && !value.length)
    ? "—"
    : Array.isArray(value)
      ? value.join(", ")
      : typeof value === "boolean"
        ? value
          ? "Sì"
          : "No"
        : String(value);
}
export const choiceTypes: PropertyType[] = ["select", "radio", "multiselect"];
export function validPropertyValue(
  p: CrmProperty,
  value: PropertyValue | undefined,
): boolean {
  const empty =
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);
  if (empty) return !p.required;
  if (p.type === "boolean") return typeof value === "boolean";
  if (p.type === "number")
    return typeof value === "number" && Number.isFinite(value);
  if (p.type === "multiselect")
    return (
      Array.isArray(value) &&
      new Set(value).size === value.length &&
      value.every((v) => p.options.includes(v))
    );
  if (typeof value !== "string") return false;
  if (p.type === "select" || p.type === "radio")
    return p.options.includes(value);
  if (p.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (p.type === "url") {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }
  if (p.type === "date")
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(value);
  return true;
}

export interface CrmNote {
  actorId?: string;
  actorName?: string;
  id: string;
  text: string;
  createdAt: string;
}
export interface CrmActivity {
  actorId?: string;
  actorName?: string;
  id: string;
  text: string;
  createdAt: string;
}
export type FilterOperator =
  | "contains"
  | "equals"
  | "not_equals"
  | "gt"
  | "lt"
  | "before"
  | "after"
  | "has_any"
  | "has_all"
  | "is_empty"
  | "is_not_empty";
export interface PropertyFilter {
  id: string;
  propertyId: string;
  operator: FilterOperator;
  value: string;
  values?: string[];
}
export interface DirectoryConfig {
  query: string;
  status: "all" | CrmStudent["status"];
  tier: string;
  archived: boolean;
  columns: string[];
  layout: "table" | "grid";
  sortKey: string;
  sortDirection: "asc" | "desc";
  filters: PropertyFilter[];
  pageSize: 10 | 25 | 50;
}
export interface CrmView {
  id: string;
  name: string;
  config: DirectoryConfig;
}
export const defaultDirectory: DirectoryConfig = {
  query: "",
  status: "all",
  tier: "all",
  archived: false,
  columns: ["tier", "status", "joinedAt"],
  layout: "table",
  sortKey: "joinedAt",
  sortDirection: "desc",
  filters: [],
  pageSize: 25,
};

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function emptyValue(value: PropertyValue | undefined) {
  return (
    value === undefined ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && value.length === 0)
  );
}
export function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("it");
}
export function uniqueOptions(options: string[]) {
  const seen = new Set<string>();
  return options
    .map((o) => o.trim())
    .filter((o) => {
      if (!o || seen.has(normalize(o))) return false;
      seen.add(normalize(o));
      return true;
    });
}

export function formatPropertyValue(
  p: CrmProperty,
  value: PropertyValue | undefined,
): string {
  if (emptyValue(value)) return "—";
  if (p.type === "date" && typeof value === "string" && validDate(value))
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Rome",
    }).format(new Date(value + "T12:00:00Z"));
  if (p.type === "number" && typeof value === "number")
    return new Intl.NumberFormat("it-IT", {
      maximumFractionDigits: 12,
      useGrouping: "always",
    }).format(value);
  return displayValue(value);
}
