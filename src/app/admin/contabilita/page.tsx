import type { Metadata } from "next";
import { AccountingWorkspace } from "@/modules/crm/accounting-workspace";
export const metadata: Metadata = { title: "Contabilità" };
export default function Page() {
  return <AccountingWorkspace />;
}
