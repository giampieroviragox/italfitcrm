import { validDate, type CrmProperty, type PropertyValue } from "./model.ts";

/**
 * Age is never stored: it is computed from the "Data di nascita" property,
 * whose Key stays the same even if the field is renamed.
 */
export const birthDatePropertyId = "data-di-nascita";
export const ageColumn = "age";

const todayRome = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(),
  );

/** Whole years between a birth date and `today` (both YYYY-MM-DD). */
export function ageOn(
  birthDate: PropertyValue | undefined,
  today: string = todayRome(),
): number | null {
  if (typeof birthDate !== "string" || !validDate(birthDate)) return null;
  if (!validDate(today) || birthDate > today) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** True when the CRM has an active date field to compute ages from. */
export function hasBirthDate(properties: readonly CrmProperty[]): boolean {
  return properties.some(
    (p) => p.id === birthDatePropertyId && p.type === "date" && !p.archived,
  );
}

export function studentAge(
  student: { properties?: Record<string, PropertyValue> },
  today?: string,
): number | null {
  return ageOn(student.properties?.[birthDatePropertyId], today);
}

export function formatAge(age: number | null): string {
  return age === null ? "—" : age === 1 ? "1 anno" : `${age} anni`;
}
