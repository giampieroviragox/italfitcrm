export function placeCalendarItems<T extends { from: number; to: number }>(
  items: T[],
) {
  const ordered = items.toSorted((a, b) => a.from - b.from || b.to - a.to);
  const positioned: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number; lanes: number })[] = [];
  let ends: number[] = [];
  let groupEnd = -Infinity;

  for (const item of ordered) {
    if (item.from >= groupEnd) {
      for (const member of group) member.lanes = ends.length;
      group = [];
      ends = [];
    }
    let lane = ends.findIndex((end) => end <= item.from);
    if (lane < 0) lane = ends.length;
    ends[lane] = item.to;
    groupEnd = Math.max(...ends);
    const event = { ...item, lane, lanes: ends.length };
    group.push(event);
    positioned.push(event);
  }
  for (const member of group) member.lanes = ends.length;
  return positioned;
}
