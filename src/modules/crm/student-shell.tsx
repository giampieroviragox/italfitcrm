"use client";
import Link from "next/link";
import { CalendarDays, Dumbbell, Home } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { StudentView } from "./student-home";

export interface StudentNavItem {
  view: StudentView;
  label: string;
}
const icons = { home: Home, piano: Dumbbell, prenotazioni: CalendarDays };
const paths = {
  home: "/area-studente",
  piano: "/area-studente/piano",
  prenotazioni: "/area-studente/prenotazioni",
};

/** Student area frame: top navigation on desktop, tab bar on phones. */
export function StudentShell({
  view,
  items,
  query = "",
  actions,
  children,
}: {
  view: StudentView;
  items: StudentNavItem[];
  query?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const href = (item: StudentNavItem) => paths[item.view] + query;
  return (
    <div className="min-h-dvh min-w-0 bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-8">
          <Link href={paths.home + query} aria-label="Team Italfit, Home">
            <Brand />
          </Link>
          <nav
            aria-label="Area studente"
            className="hidden flex-1 items-center gap-1 sm:flex"
          >
            {items.map((item) => (
              <Link
                key={item.view}
                href={href(item)}
                aria-current={item.view === view ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-[10px] px-3 text-sm font-medium transition-colors",
                  item.view === view
                    ? "bg-foreground/[.045] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {actions}
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-5xl px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-12 sm:pb-16">
        {children}
      </main>
      {items.length > 1 && (
        <nav
          aria-label="Area studente"
          className="fixed inset-x-0 bottom-0 z-20 grid border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
          style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
        >
          {items.map((item) => {
            const Icon = icons[item.view];
            return (
              <Link
                key={item.view}
                href={href(item)}
                aria-current={item.view === view ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  item.view === view
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function studentNavItems(
  services: { plans: boolean; lessons: boolean },
  hasBookings: boolean,
): StudentNavItem[] {
  return [
    { view: "home", label: "Home" },
    ...(services.plans ? [{ view: "piano" as const, label: "Piano" }] : []),
    ...(services.lessons || hasBookings
      ? [{ view: "prenotazioni" as const, label: "Prenotazioni" }]
      : []),
  ];
}
