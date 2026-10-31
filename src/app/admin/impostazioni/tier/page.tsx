import type { Metadata } from "next";
import { TierManager } from "@/modules/crm/team-tier-manager";
export const metadata: Metadata = { title: "Impostazioni · Tier studenti" };
export default function Page() {
  return <TierManager />;
}
