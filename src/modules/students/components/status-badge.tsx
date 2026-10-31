import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusLabels } from "../config";
import type { StudentStatus } from "@/types/domain";

const classes: Record<StudentStatus, string> = {
  active: "border-[#dfebe0] bg-[#f0f6ef] text-[#466542]",
  invited: "border-[#f0e3cd] bg-[#fbf5e9] text-[#8a692b]",
  paused: "border-[#e7e7e7] bg-[#f3f3f2] text-[#73736f]",
};

export function StatusBadge({ status }: { status: StudentStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium",
        classes[status],
      )}
    >
      <span className="size-1 rounded-full bg-current" />
      {statusLabels[status]}
    </Badge>
  );
}
