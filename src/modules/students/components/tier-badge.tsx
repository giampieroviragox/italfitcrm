import { cn } from "@/lib/utils";
import type { CrmTier } from "@/modules/crm/model";

const dots: Record<string, string> = {
  online: "bg-violet-500",
  studio: "bg-sky-500",
};

export function TierBadge({ tier }: { tier?: Pick<CrmTier, "id" | "name"> }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-foreground/[.045] px-2.5 text-xs font-medium",
        tier ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {tier && (
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            dots[tier.id] ?? "bg-neutral-400",
          )}
        />
      )}
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
