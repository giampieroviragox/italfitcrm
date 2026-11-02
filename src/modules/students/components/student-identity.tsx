import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import type { Student } from "@/types/domain";

const avatarColors = [
  "bg-foreground/[.07] text-foreground/80",
  "bg-indigo-500/10 text-indigo-900 dark:text-indigo-200",
  "bg-orange-500/10 text-orange-900 dark:text-orange-200",
  "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
];

export function StudentIdentity({
  student,
  index = 0,
  large = false,
}: {
  student: Student;
  index?: number;
  large?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
          avatarColors[index % avatarColors.length],
          large ? "size-14 text-base" : "size-8",
        )}
      >
        {getInitials(student.firstName, student.lastName)}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-medium text-foreground",
            large ? "text-xl tracking-[-0.02em]" : "text-sm",
          )}
        >
          {student.firstName} {student.lastName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {student.email}
        </span>
      </span>
    </span>
  );
}
