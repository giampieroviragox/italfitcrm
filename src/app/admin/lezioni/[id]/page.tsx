import { PermissionGate } from "@/modules/crm/permission-gate";
import { LessonDetail } from "@/modules/crm/lessons-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PermissionGate permission="lessons">
      <LessonDetail id={id} />
    </PermissionGate>
  );
}
