import { placeColumn } from "./student-grid.ts";

export function columnDragOffsets(
  columns: readonly string[],
  widths: Readonly<Record<string, number>>,
  from: string,
  to: string,
  side: "before" | "after",
): Record<string, number> {
  const positions = (ids: readonly string[]) => {
    let x = 0;
    return Object.fromEntries(
      ids.map((id) => {
        const position = x;
        x += widths[id] ?? 200;
        return [id, position];
      }),
    );
  };
  const before = positions(columns);
  const after = positions(placeColumn(columns, from, to, side));
  return Object.fromEntries(
    columns.map((id) => [id, (after[id] ?? 0) - (before[id] ?? 0)]),
  );
}

/** Pixels per second: continuous edge scrolling, independent of pointer events. */
export function columnDragScrollSpeed(
  x: number,
  left: number,
  right: number,
): number {
  const zone = Math.min(64, (right - left) / 3);
  if (zone <= 0 || x < left - 24 || x > right + 24) return 0;
  const strength =
    x < left + zone
      ? -Math.min(1, (left + zone - x) / zone)
      : x > right - zone
        ? Math.min(1, (x - right + zone) / zone)
        : 0;
  return Math.sign(strength) * strength * strength * 720;
}
