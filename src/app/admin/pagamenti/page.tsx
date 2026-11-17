import { PermissionGate } from "@/modules/crm/permission-gate";
import type { Metadata } from "next";
import { PaymentsWorkspace } from "@/modules/crm/payments-workspace";
export const metadata: Metadata = { title: "Pagamenti" };
export default function Page() {
  return (
    <PermissionGate permission="payments">
      <PaymentsWorkspace />
    </PermissionGate>
  );
}
