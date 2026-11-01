import type { Student } from "../../types/domain.ts";
import {
  formatPropertyValue,
  type CrmProperty,
  type CrmTier,
} from "./model.ts";
export function csvCell(value: string | number | boolean): string {
  const raw = String(value);
  // Text cells beginning with spreadsheet formula characters must remain text.
  const safe =
    typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(raw)
      ? `'${raw}`
      : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function studentsCsv(
  students: readonly Student[],
  tiers: readonly CrmTier[],
  properties: readonly CrmProperty[],
  columns: readonly string[],
): string {
  const labels: Record<string, string> = {
    tier: "Tier",
    status: "Stato",
    joinedAt: "Aggiunto il",
    coach: "Coach",
    phone: "Telefono",
  };
  const headers = [
    "Nome",
    "Cognome",
    "Email",
    "Telefono",
    ...columns
      .filter((c) => c !== "phone" && c !== "tags")
      .map((c) =>
        c.startsWith("property:")
          ? (properties.find((p) => `property:${p.id}` === c)?.name ?? c)
          : (labels[c] ?? c),
      ),
  ];
  const statuses = {
    active: "Attivo",
    paused: "In pausa",
    invited: "Da attivare",
  };
  const rows = students.map((s) => [
    s.firstName,
    s.lastName,
    s.email,
    s.phone ?? "",
    ...columns
      .filter((c) => c !== "phone" && c !== "tags")
      .map((c) => {
        const p = properties.find((p) => `property:${p.id}` === c);
        if (p) return formatPropertyValue(p, s.properties?.[p.id]);
        switch (c) {
          case "tier":
            return tiers.find((t) => t.id === s.tierId)?.name ?? "";
          case "status":
            return statuses[s.status];
          case "joinedAt":
            return s.joinedAt;
          case "coach":
            return s.coach;
          default:
            return "";
        }
      }),
  ]);
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
  );
}
