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
        <Button variant="ghost" size="icon" aria-label={label}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[80] min-w-48 rounded-xl border bg-white p-1.5 text-sm shadow-lg"
        >
          {items.map((item, index) => (
            <DropdownMenu.Item
              key={index}
              asChild={!!item.href}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={`flex cursor-pointer items-center rounded-lg px-3 py-2 outline-none focus:bg-muted data-disabled:pointer-events-none data-disabled:opacity-40 ${item.destructive ? "text-red-700" : ""}`}
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
