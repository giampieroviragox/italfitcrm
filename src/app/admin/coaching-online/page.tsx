import type { Metadata } from "next";
import { OnlineCoachingWorkspace } from "@/modules/crm/online-coaching-workspace";
export const metadata: Metadata = { title: "Coaching online" };
export default function Page() {
  return <OnlineCoachingWorkspace />;
}
