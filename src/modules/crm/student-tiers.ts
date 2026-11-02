import type { CrmTier } from "./model.ts";

export function studentTierIds(student: {
  tierId: string;
  tierIds?: string[];
}): string[] {
  return student.tierIds ?? [student.tierId];
}

export function studentTierLabel(
  student: { tierId: string; tierIds?: string[] },
  tiers: readonly Pick<CrmTier, "id" | "name">[],
): string {
  return studentTierIds(student)
    .map((id) => tiers.find((t) => t.id === id)?.name ?? "Tier non disponibile")
    .join(" + ");
}
