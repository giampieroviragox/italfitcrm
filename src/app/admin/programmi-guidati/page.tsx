import type { Metadata } from "next";
import { GuidedPrograms } from "@/modules/crm/guided-programs";
import { PermissionGate } from "@/modules/crm/permission-gate";
export const metadata: Metadata = { title: "Programmi guidati" };
export default function Page() {
  return (
    <PermissionGate permission="plans">
      <GuidedPrograms />
    </PermissionGate>
  );
}
