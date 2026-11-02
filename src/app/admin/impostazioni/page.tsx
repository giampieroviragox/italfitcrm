import type { Metadata } from "next";
import { UsersManager } from "@/modules/crm/users-manager";
export const metadata: Metadata = { title: "Impostazioni · Team" };
export default function SettingsPage() {
  return <UsersManager />;
}
