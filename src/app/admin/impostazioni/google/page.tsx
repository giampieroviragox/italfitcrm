import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleCalendarSettings } from "@/modules/crm/google-calendar-settings";
export const metadata: Metadata = { title: "Impostazioni · Google Calendar" };
export default function Page() {
  return (
    <Suspense>
      <GoogleCalendarSettings />
    </Suspense>
  );
}
