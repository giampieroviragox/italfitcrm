import { PermissionGate } from "@/modules/crm/permission-gate";
import { PlanDetail } from "@/modules/crm/plans-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PermissionGate permission="plans">
      <PlanDetail id={id} />
    </PermissionGate>
  );
}
