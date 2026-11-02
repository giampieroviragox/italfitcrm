"use client";

import { usePathname } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { PageTabs } from "@/components/ui/page-tabs";

const sections = [
  { value: "/admin/impostazioni", label: "Team", href: "/admin/impostazioni" },
  {
    value: "/admin/impostazioni/proprieta",
    label: "Proprietà",
    href: "/admin/impostazioni/proprieta",
  },
];

export function SettingsNavigation() {
  const pathname = usePathname();
  return (
    <>
      <PageHeading
        title="Impostazioni"
        description="Gestisci il team e i campi delle schede studente."
      />
      <PageTabs
        label="Sezioni impostazioni"
        className="mb-8"
        value={pathname}
        tabs={sections}
      />
    </>
  );
}
