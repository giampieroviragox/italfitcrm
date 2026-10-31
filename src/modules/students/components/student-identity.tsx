import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import type { Student } from "@/types/domain";

const avatarColors = [
  "bg-[#e8eee6] text-[#52644c]",
  "bg-[#eee8e3] text-[#806352]",
  "bg-[#e8eaf0] text-[#596482]",
  "bg-[#efe6e8] text-[#8b5b65]",
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
          large ? "size-16 text-lg" : "size-9",
        )}
      >
        {getInitials(student.firstName, student.lastName)}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-medium text-foreground",
            large ? "text-xl" : "text-xs",
          )}
        >
          {student.firstName} {student.lastName}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {student.email}
        </span>
      </span>
    </span>
  );
}
