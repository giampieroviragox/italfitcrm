import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuidedProgram } from "@/modules/crm/guided-programs";
import { PermissionGate } from "@/modules/crm/permission-gate";
import { isGuidedCategory } from "@/modules/crm/plan-cycles";
export const metadata: Metadata = { title: "Programma guidato" };
export default async function Page({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;
  if (!isGuidedCategory(categoria)) notFound();
  return (
    <PermissionGate permission="plans">
      <GuidedProgram category={categoria} />
    </PermissionGate>
  );
}
