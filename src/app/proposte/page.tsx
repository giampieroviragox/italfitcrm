import type { Metadata } from "next";
import { ProposalsGallery } from "@/modules/proposals/proposals-gallery";
import { proposals } from "@/modules/proposals/proposal-data";
export const metadata: Metadata = {
  title: "Sei esperienze studente · Proposte",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string; device?: string }>;
}) {
  const params = await searchParams;
  const initial = proposals.find((p) => p.id === params.concept)?.id ?? "oggi";
  return (
    <ProposalsGallery
      initial={initial}
      initialDevice={params.device === "desktop" ? "desktop" : "mobile"}
    />
  );
}
