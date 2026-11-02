import type { Metadata } from "next";
import { UsersManager } from "@/modules/crm/users-manager";
export const metadata: Metadata = { title: "Impostazioni · Utenti" };
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <UsersManager initialTab={tab === "students" ? "students" : "admins"} />
  );
}
