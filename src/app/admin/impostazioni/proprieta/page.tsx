import type { Metadata } from "next";
import { PropertyManager } from "@/modules/crm/property-manager";
export const metadata: Metadata = { title: "Impostazioni · Proprietà" };
export default function Page() {
  return <PropertyManager />;
}
