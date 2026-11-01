export interface AvailabilitySlot {
  start: string;
  end: string;
}
export const cellMinutes = 60;
const cellMs = cellMinutes * 60000;
export function isAvailability(value: unknown): value is AvailabilitySlot[] {
  if (!Array.isArray(value) || value.length > 5000) return false;
  let previousEnd = -Infinity;
  for (const slot of value) {
    if (typeof slot !== "object" || slot === null) return false;
    const { start, end } = slot as Record<string, unknown>;
    if (typeof start !== "string" || typeof end !== "string") return false;
    const from = Date.parse(start),
      to = Date.parse(end);
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      to <= from ||
      from % cellMs !== 0 ||
      to % cellMs !== 0 ||
      from <= previousEnd
    )
      return false;
    previousEnd = to;
  }
  return true;
}
export function slotCells(slots: AvailabilitySlot[]): Set<number> {
  const cells = new Set<number>();
  for (const slot of slots)
    for (
      let at = Date.parse(slot.start);
      at < Date.parse(slot.end);
      at += cellMs
    )
      cells.add(at);
  return cells;
}
export function cellsToSlots(cells: Iterable<number>): AvailabilitySlot[] {
  const slots: { start: number; end: number }[] = [];
  for (const at of [...new Set(cells)].sort((a, b) => a - b)) {
    const last = slots.at(-1);
    if (last?.end === at) last.end = at + cellMs;
    else slots.push({ start: at, end: at + cellMs });
  }
  return slots.map((slot) => ({
    start: new Date(slot.start).toISOString(),
    end: new Date(slot.end).toISOString(),
  }));
}
export function paintCells(
  slots: AvailabilitySlot[],
  cells: number[],
  available: boolean,
): AvailabilitySlot[] {
  const next = slotCells(slots);
  for (const at of cells) {
    if (available) next.add(at);
    else next.delete(at);
  }
  return cellsToSlots(next);
}
