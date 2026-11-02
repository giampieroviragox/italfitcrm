import { cn } from "@/lib/utils";
import type { CrmTier } from "@/modules/crm/model";

const colors: Record<string, string> = {
  online: "bg-violet-50 text-violet-800",
  studio: "bg-sky-50 text-sky-800",
};

export function TierBadge({ tier }: { tier?: Pick<CrmTier, "id" | "name"> }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded px-2 py-1 text-[11px] font-medium",
        colors[tier?.id ?? ""] ?? "bg-muted text-muted-foreground",
      )}
    >
      <span className="truncate">{tier?.name ?? "Nessun tier"}</span>
    </span>
  );
}

export function StudentTierBadges({
  student,
  tiers,
}: {
  student: { tierId: string; tierIds?: string[] };
  tiers: readonly Pick<CrmTier, "id" | "name">[];
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {(student.tierIds ?? [student.tierId]).map((id) => (
        <TierBadge key={id} tier={tiers.find((t) => t.id === id)} />
      ))}
    </span>
  );
}
