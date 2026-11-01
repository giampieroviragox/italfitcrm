"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/admin/impostazioni", label: "Utenti" },
  { href: "/admin/impostazioni/proprieta", label: "Proprietà" },
];

export function SettingsNavigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sezioni impostazioni"
      className="mb-8 flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-white p-1.5 sm:w-fit"
    >
      {sections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          aria-current={pathname === section.href ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            pathname === section.href
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
