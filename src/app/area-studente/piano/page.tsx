import type { Metadata } from "next";
import { StudentAreaPage } from "@/modules/crm/student-area-page";
export const metadata: Metadata = { title: "Il mio piano" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ studente?: string }>;
}) {
  const { studente } = await searchParams;
  return <StudentAreaPage view="piano" studentId={studente} />;
}
