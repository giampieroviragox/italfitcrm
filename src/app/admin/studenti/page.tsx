import type { Metadata } from "next";
import { StudentsWorkspace } from "@/modules/crm/students-workspace";
export const metadata: Metadata = { title: "Studenti" };
export default function StudentsPage() {
  return <StudentsWorkspace />;
}
