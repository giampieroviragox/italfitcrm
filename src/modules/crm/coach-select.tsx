import { SelectControl } from "@/components/ui/select-control";
import { Field, control } from "./ui";
import { useCrm } from "./store";
import { coachName, defaultCoachName } from "./student-coach";

export function CoachSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { admins } = useCrm();
  const selected = coachName(value);
  const choices = [
    ...new Set([
      defaultCoachName,
      ...admins.map((admin) => coachName(admin.name)),
      selected,
    ]),
  ];

  return (
    <Field label="Coach di riferimento">
      <SelectControl
        className={control}
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {choices.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </SelectControl>
    </Field>
  );
}
