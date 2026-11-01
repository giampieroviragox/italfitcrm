import { addDays, romeLocal, romeToIso } from "./fitness-logic.ts";
import { createAvailability, type AvailabilitySlot } from "./availability.ts";
export function clockLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function durationLabel(minutes: number) {
  return minutes === 60
    ? "1 ora"
    : minutes % 60 === 0
      ? `${minutes / 60} ore`
      : `${minutes} min`;
}
export function periodFromFields(
  date: string,
  start: string,
  end: string,
  count: number,
) {
  return createAvailability(
    romeToIso(`${date}T${start}`),
    romeToIso(end === "24:00" ? `${addDays(date, 1)}T00:00` : `${date}T${end}`),
    count,
  );
}
export interface AvailabilitySelection {
  date: string;
  start: string;
  end: string;
  existing?: AvailabilitySlot;
}
export function selectionForPeriod(
  slot: AvailabilitySlot,
): AvailabilitySelection {
  const start = romeLocal(slot.start),
    end = romeLocal(slot.end);
  return {
    date: start.slice(0, 10),
    start: start.slice(11),
    end:
      end.slice(0, 10) !== start.slice(0, 10) && end.endsWith("T00:00")
        ? "24:00"
        : end.slice(11),
    existing: slot,
  };
}
