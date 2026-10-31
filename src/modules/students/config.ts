import type { StudentStatus, Tier, TierId } from "@/types/domain";

// Example tiers only. The client's actual commercial offering is still to be defined.
export const tiers: Record<TierId, Tier> = {
  online: {
    id: "online",
    name: "Coaching online",
    description: "Un percorso di allenamento personalizzato, ovunque.",
  },
  studio: {
    id: "studio",
    name: "Allenamento in sede",
    description: "Lezioni e allenamenti insieme, in struttura.",
  },
};

export const statusLabels: Record<StudentStatus, string> = {
  active: "Attivo",
  invited: "Da attivare",
  paused: "In pausa",
};
