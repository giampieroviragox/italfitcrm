export interface AvailabilitySlot {
  start: string;
  end: string;
  /** Stored as slotCount for compatibility. Each place covers the full period. */
  slotCount?: number;
}
const minuteMs = 60000;
export const maxAvailabilityCapacity = 1440;

export function availabilityCapacity(slot: AvailabilitySlot): number {
  return slot.slotCount ?? 1;
}

export function availabilityDurationMinutes(slot: AvailabilitySlot): number {
  return (Date.parse(slot.end) - Date.parse(slot.start)) / minuteMs;
}

export function isAvailability(value: unknown): value is AvailabilitySlot[] {
  if (!Array.isArray(value) || value.length > 5000) return false;
  let previousEnd = -Infinity;
  let totalSlots = 0;
  for (const slot of value) {
    if (typeof slot !== "object" || slot === null) return false;
    const { start, end, slotCount } = slot as Record<string, unknown>;
    if (typeof start !== "string" || typeof end !== "string") return false;
    const from = Date.parse(start),
      to = Date.parse(end);
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      to <= from ||
      from % minuteMs !== 0 ||
      to % minuteMs !== 0 ||
      from < previousEnd
    )
      return false;
    if (
      slotCount !== undefined &&
      (typeof slotCount !== "number" ||
        !Number.isInteger(slotCount) ||
        slotCount < 1 ||
        slotCount > maxAvailabilityCapacity)
    )
      return false;
    totalSlots += typeof slotCount === "number" ? slotCount : 1;
    if (totalSlots > 10000) return false;
    previousEnd = to;
  }
  return true;
}
export function createAvailability(
  start: string,
  end: string,
  slotCount: number,
): AvailabilitySlot {
  const slot = { start, end, slotCount };
  if (!isAvailability([slot]))
    throw new Error(
      `Scegli una fascia oraria valida e un numero di posti da 1 a ${maxAvailabilityCapacity}.`,
    );
  return slot;
}
export function changeAvailability(
  slots: AvailabilitySlot[],
  previous: AvailabilitySlot | undefined,
  next: AvailabilitySlot | undefined,
): AvailabilitySlot[] {
  const key = (slot: AvailabilitySlot) => JSON.stringify(slot);
  if (previous && !slots.some((slot) => key(slot) === key(previous)))
    throw new Error("La disponibilità è cambiata. Chiudi e riapri il modulo.");
  const result = slots.filter(
    (slot) => !previous || key(slot) !== key(previous),
  );
  if (next) result.push(next);
  result.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (!isAvailability(result))
    throw new Error(
      "Questa fascia si sovrappone a una disponibilità esistente.",
    );
  return result;
}
