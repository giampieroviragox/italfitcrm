import type { CrmTier } from "@/modules/crm/model";
import type { StudentStatus, Tier, TierId } from "@/types/domain";

// Example tiers only. The client's actual commercial offering is still to be defined.
export const tiers: Record<TierId, Tier & Pick<CrmTier, "entitlements">> = {
  online: {
    id: "online",
    entitlements: { plans: true, lessons: false, monthlyBookingLimit: null },
    name: "Coaching online",
    description: "Un percorso di allenamento personalizzato, ovunque.",
  },
  studio: {
    id: "studio",
    entitlements: { plans: false, lessons: true, monthlyBookingLimit: null },
    name: "Allenamento in sede",
    description: "Lezioni e allenamenti insieme, in struttura.",
  },
};

export const statusLabels: Record<StudentStatus, string> = {
  active: "Attivo",
  invited: "Da attivare",
  paused: "In pausa",
};
