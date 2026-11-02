"use client";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { tierDots } from "@/modules/students/components/tier-badge";
import { useSaving } from "./store";
import type { CrmTier } from "./model";

export function TierPicker({
  tiers,
  value,
  onChange,
}: {
  tiers: readonly CrmTier[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const saving = useSaving();
  return (
    <fieldset disabled={saving}>
      <legend className="text-sm font-medium">Tier *</legend>
      <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
        Seleziona uno o entrambi i servizi.
      </p>
      <div className="divide-y overflow-hidden rounded-[10px] border">
        {tiers
          .filter((t) => !t.archived || value.includes(t.id))
          .map((t) => (
            <label
              key={t.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-foreground/[.03] has-[:disabled]:cursor-not-allowed"
            >
              <CheckboxControl
                checked={value.includes(t.id)}
                disabled={t.archived}
                aria-label={t.name}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, t.id]
                      : value.filter((id) => id !== t.id),
                  )
                }
              />
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${tierDots[t.id] ?? "bg-neutral-400"}`}
              />
              <span className="min-w-0 flex-1 text-sm">{t.name}</span>
              {t.archived && (
                <span className="text-xs text-muted-foreground">
                  Archiviato
                </span>
              )}
            </label>
          ))}
      </div>
    </fieldset>
  );
}
