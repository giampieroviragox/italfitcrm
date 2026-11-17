import type { Metadata } from "next";
export const metadata: Metadata = { title: "Scheda studente" };
import { StudentProfile } from "@/modules/crm/student-profile";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return (
    <StudentProfile
      id={id}
      initialTab={typeof tab === "string" ? tab : undefined}
    />
  );
}
