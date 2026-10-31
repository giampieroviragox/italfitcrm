import type { Metadata } from "next";
export const metadata: Metadata = { title: "Scheda studente" };
import { StudentProfile } from "@/modules/crm/student-profile";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentProfile id={id} />;
}
