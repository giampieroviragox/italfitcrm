import type { Metadata } from "next";
import { AgendaWorkspace } from "@/modules/crm/agenda-workspace";
import { PermissionGate } from "@/modules/crm/permission-gate";
export const metadata: Metadata = { title: "Agenda" };
export default function Page() {
  return (
    <PermissionGate permission="agenda">
      <AgendaWorkspace />
    </PermissionGate>
  );
}
