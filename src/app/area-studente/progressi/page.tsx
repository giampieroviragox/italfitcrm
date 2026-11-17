import type { Metadata } from "next";
import { StudentAreaPage } from "@/modules/crm/student-area-page";
export const metadata: Metadata = { title: "I miei progressi" };
export default function Page() {
  return <StudentAreaPage view="progressi" />;
}
