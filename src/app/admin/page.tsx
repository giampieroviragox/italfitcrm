import type { Metadata } from "next";
export const metadata: Metadata = { title: "Home" };
import { default as Overview } from "@/modules/crm/overview";
export default function Page() {
  return <Overview />;
}
