import { LessonDetail } from "@/modules/crm/lessons-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LessonDetail id={id} />;
}
