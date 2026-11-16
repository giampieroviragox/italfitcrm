"use client";
import { SelectControl } from "@/components/ui/select-control";
import { formatMonth } from "@/lib/format";
import { todayRome } from "./fitness-logic";
import { control } from "./ui";

export function PlanMonthSelect({
  value,
  months,
  onChange,
  student = false,
  ...aria
}: {
  value: string;
  months: readonly string[];
  onChange: (month: string) => void;
  student?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const current = todayRome().slice(0, 7);
  const available = [...new Set([current, value, ...months])].sort().reverse();
  return (
    <SelectControl
      {...aria}
      className={
        student
          ? "min-h-11 gap-2 rounded-full bg-card px-3 capitalize sm:px-4"
          : control
      }
      contentClassName={student ? "student-area dark" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {available.map((month) => (
        <option key={month} value={month}>
          {formatMonth(month)}
          {month === current && !student ? " · Mese corrente" : ""}
        </option>
      ))}
    </SelectControl>
  );
}
