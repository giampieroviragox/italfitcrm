import { PermissionGate } from "@/modules/crm/permission-gate";
import type { Metadata } from "next";
import { PlansWorkspace } from "@/modules/crm/plans-workspace";
export const metadata: Metadata = { title: "Piani e percorsi" };
export default function Page() {
  return (
    <PermissionGate permission="plans">
      <PlansWorkspace />
    </PermissionGate>
  );
}
