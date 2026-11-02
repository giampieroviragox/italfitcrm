import { notFound } from "next/navigation";
import { proposals } from "@/modules/proposals/proposal-data";
import { StudentExperiencePreview } from "@/modules/proposals/proposals-gallery";

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ concept: string }>;
}) {
  const { concept } = await params;
  const proposal = proposals.find((item) => item.id === concept);
  if (!proposal) notFound();
  return <StudentExperiencePreview proposal={proposal} />;
}
