"use client";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import { Button } from "./button";
export interface ActionMenuItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}
export function ActionMenu({
  items,
  label = "Altre azioni",
}: {
  items: ActionMenuItem[];
  label?: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={label}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[80] min-w-48 rounded-xl border bg-card p-1 text-sm shadow-[0_4px_24px_rgba(0,0,0,0.08)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {items.map((item, index) => (
            <DropdownMenu.Item
              key={index}
              asChild={!!item.href}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={`flex h-9 cursor-pointer items-center rounded-lg px-2.5 outline-none focus:bg-muted data-disabled:pointer-events-none data-disabled:opacity-40 ${item.destructive ? "text-red-700 dark:text-red-400" : ""}`}
            >
              {item.href ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                item.label
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
