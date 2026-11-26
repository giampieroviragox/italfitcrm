"use client";
import { SelectControl } from "@/components/ui/select-control";
import { todayRome } from "./fitness-logic";
import type { PlanAssignment } from "./fitness-model";
import { assignmentPeriod, guidedLabel, periodLabel } from "./plan-cycles";
import { control } from "./ui";

/** One option per assigned plan, newest cycle first; the running ones are marked. */
export function PlanSelect({
  value,
  assignments,
  onChange,
  student = false,
  ...aria
}: {
  value: string;
  assignments: readonly PlanAssignment[];
  onChange: (assignmentId: string) => void;
  student?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const today = todayRome();
  const options = assignments.toSorted((a, b) =>
    assignmentPeriod(b).startsOn.localeCompare(assignmentPeriod(a).startsOn),
  );
  return (
    <SelectControl
      {...aria}
      className={
        student ? "min-h-11 gap-2 rounded-full bg-card px-3 sm:px-4" : control
      }
      contentClassName={student ? "student-area dark" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((a) => {
        const p = assignmentPeriod(a);
        const running = p.startsOn <= today && today <= p.endsOn;
        return (
          <option key={a.id} value={a.id}>
            {a.guidedCategory ? `${guidedLabel(a.guidedCategory)} · ` : ""}
            {periodLabel(a)}
            {running ? " · In corso" : ""}
          </option>
        );
      })}
    </SelectControl>
  );
}
