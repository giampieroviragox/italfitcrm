"use client";
import Link from "next/link";
import { CalendarDays, Dumbbell, Home, TrendingUp } from "lucide-react";
import { Brand } from "@/components/brand";
import "./student-area.css";
import { cn } from "@/lib/utils";
import type { StudentView } from "./student-home";

export interface StudentNavItem {
  view: StudentView;
  label: string;
}
const icons = {
  home: Home,
  piano: Dumbbell,
  progressi: TrendingUp,
  prenotazioni: CalendarDays,
};
const paths = {
  home: "/area-studente",
  piano: "/area-studente/piano",
  progressi: "/area-studente/progressi",
  prenotazioni: "/area-studente/prenotazioni",
};

/** Student area frame: top navigation on desktop, tab bar on phones. */
export function StudentShell({
  view,
  items,
  actions,
  children,
}: {
  view: StudentView;
  items: StudentNavItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const href = (item: StudentNavItem) => paths[item.view];
  return (
    <div className="student-area dark min-h-dvh min-w-0 bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:h-[72px] sm:px-8">
          <Link href={paths.home} aria-label="Team Italfit, Home">
            <Brand className="[&>span:first-child]:ring-white/15" />
          </Link>
          <nav
            aria-label="Area studente"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border bg-card p-1 sm:flex"
          >
            {items.map((item) => (
              <Link
                key={item.view}
                href={href(item)}
                aria-current={item.view === view ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                  item.view === view
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center">{actions}</div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-6xl px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-9 sm:pb-14">
        {children}
      </main>
      {items.length > 1 && (
        <nav
          aria-label="Area studente"
          className="fixed inset-x-0 bottom-0 z-20 grid border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
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
                  "flex h-[62px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                  item.view === view
                    ? "text-[var(--workspace-accent)]"
                    : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "rounded-full px-4 py-1",
                    item.view === view && "bg-muted",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
                </span>
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
    ...(services.plans
      ? [
          { view: "piano" as const, label: "Piano" },
          { view: "progressi" as const, label: "Progressi" },
        ]
      : []),
    ...(services.lessons || hasBookings
      ? [{ view: "prenotazioni" as const, label: "Prenotazioni" }]
      : []),
  ];
}
