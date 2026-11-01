import type { Metadata } from "next";
import { LessonsWorkspace } from "@/modules/crm/lessons-workspace";
export const metadata: Metadata = { title: "Calendario" };
export default function Page() {
  return <LessonsWorkspace />;
}
