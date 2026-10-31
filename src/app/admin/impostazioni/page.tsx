import type { Metadata } from "next";
import { TeamManager } from "@/modules/crm/team-tier-manager";
export const metadata: Metadata = { title: "Impostazioni · Amministratori" };
export default function SettingsPage() {
  return <TeamManager />;
}
