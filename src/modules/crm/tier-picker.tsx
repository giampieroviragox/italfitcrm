"use client";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { TierBadge } from "@/modules/students/components/tier-badge";
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
    <fieldset disabled={saving} className="space-y-3">
      <legend className="mb-3 text-sm font-medium">Tier *</legend>
      <p className="text-xs text-muted-foreground">
        Seleziona uno o entrambi i servizi.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiers
          .filter((t) => !t.archived || value.includes(t.id))
          .map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white p-3"
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
              <TierBadge tier={t} />
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
