"use client";
import { SelectControl } from "@/components/ui/select-control";
import { formatMonth } from "@/lib/format";
import { todayRome } from "./fitness-logic";
import { control } from "./ui";

export function PlanMonthSelect({
  value,
  months,
  onChange,
  ...aria
}: {
  value: string;
  months: readonly string[];
  onChange: (month: string) => void;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const current = todayRome().slice(0, 7);
  const available = [...new Set([current, value, ...months])].sort().reverse();
  return (
    <SelectControl
      {...aria}
      className={control}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {available.map((month) => (
        <option key={month} value={month}>
          {formatMonth(month)}
          {month === current ? " · Mese corrente" : ""}
        </option>
      ))}
    </SelectControl>
  );
}
