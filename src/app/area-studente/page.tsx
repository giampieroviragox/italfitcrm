import type { Metadata } from "next";
import { StudentAreaPage } from "@/modules/crm/student-area-page";
export const metadata: Metadata = { title: "Area studente" };
export default function Page() {
  return <StudentAreaPage view="home" />;
}
