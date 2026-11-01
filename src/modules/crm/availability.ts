export interface AvailabilitySlot {
  start: string;
  end: string;
  /** Absent in legacy data, where each slot lasts one hour. */
  slotCount?: number;
}
const minuteMs = 60000;
export function availabilitySlotCount(slot: AvailabilitySlot): number {
  return (
    slot.slotCount ?? (Date.parse(slot.end) - Date.parse(slot.start)) / 3600000
  );
}
export function slotDurationMinutes(slot: AvailabilitySlot): number {
  return (
    (Date.parse(slot.end) - Date.parse(slot.start)) /
    minuteMs /
    availabilitySlotCount(slot)
  );
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
    if (slotCount === undefined) {
      if (from % 3600000 !== 0 || to % 3600000 !== 0) return false;
    } else if (
      typeof slotCount !== "number" ||
      !Number.isInteger(slotCount) ||
      slotCount < 1 ||
      slotCount > 1440 ||
      (to - from) % (slotCount * minuteMs) !== 0
    )
      return false;
    totalSlots +=
      slotCount === undefined ? (to - from) / 3600000 : Number(slotCount);
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
      "Scegli un intervallo valido e un numero di slot che lo divida in minuti interi.",
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
