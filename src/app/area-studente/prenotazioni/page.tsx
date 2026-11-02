import type { Metadata } from "next";
import { StudentAreaPage } from "@/modules/crm/student-area-page";
export const metadata: Metadata = { title: "Prenotazioni" };
export default function Page() {
  return <StudentAreaPage view="prenotazioni" />;
}
