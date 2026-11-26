import type { Metadata } from "next";
import { CoachingClient } from "@/modules/crm/coaching-client";
export const metadata: Metadata = { title: "Cliente · Coaching online" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CoachingClient id={id} />;
}
