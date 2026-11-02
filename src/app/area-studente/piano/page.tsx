import type { Metadata } from "next";
import { StudentAreaPage } from "@/modules/crm/student-area-page";
export const metadata: Metadata = { title: "Il mio piano" };
export default function Page() {
  return <StudentAreaPage view="piano" />;
}
