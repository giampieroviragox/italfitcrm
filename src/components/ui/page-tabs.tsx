"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PageTab {
  value: string;
  label: React.ReactNode;
  href?: string;
  count?: number;
}

export const pageTabItem =
  "relative inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-foreground/10 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-[9px] after:h-px";
export const pageTabActive = "border-input text-foreground after:bg-foreground";
export const pageTabIdle =
  "border-transparent text-muted-foreground hover:text-foreground after:bg-transparent";

export const pageTabList =
  "flex max-w-full gap-1 overflow-x-auto border-b pt-px pb-2 [scrollbar-width:none]";

/** Underlined pill tabs, used for page sections, filters and sub-navigation. */
export function PageTabs({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: PageTab[];
  value: string;
  onChange?: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role={onChange ? "tablist" : undefined}
      aria-label={label}
      className={cn(pageTabList, className)}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        const content = (
          <>
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            )}
          </>
        );
        return tab.href ? (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(pageTabItem, selected ? pageTabActive : pageTabIdle)}
          >
            {content}
          </Link>
        ) : (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(pageTabItem, selected ? pageTabActive : pageTabIdle)}
            onClick={() => onChange?.(tab.value)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
