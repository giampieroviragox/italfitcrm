"use client";
import { useSyncExternalStore } from "react";
import { DropdownMenu } from "radix-ui";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";
const KEY = "italfit.theme";
const EVENT = "italfit-theme";

/** Runs before paint in the root layout so the page never flashes the wrong theme. */
export const themeScript = `(()=>{try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function read(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}
function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
function subscribe(callback: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const system = () => {
    if (read() === "system") apply("system");
    callback();
  };
  media.addEventListener("change", system);
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", system);
  return () => {
    media.removeEventListener("change", system);
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", system);
  };
}
function choose(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* The choice still applies to this page. */
  }
  apply(theme);
  window.dispatchEvent(new Event(EVENT));
}

const options = [
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
  { value: "system", label: "Automatico", icon: Monitor },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  const current = options.find((o) => o.value === theme) ?? options[2];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Tema: ${current.label}`}
          className={cn(
            "flex size-8 items-center justify-center rounded-[10px] text-muted-foreground outline-none transition-colors hover:bg-foreground/[.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/20",
            className,
          )}
        >
          <current.icon className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-44 rounded-xl border bg-card p-1 text-sm text-foreground shadow-[0_4px_24px_rgba(0,0,0,0.08)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.RadioGroup
            value={theme}
            onValueChange={(value) => choose(value as Theme)}
          >
            {options.map((o) => (
              <DropdownMenu.RadioItem
                key={o.value}
                value={o.value}
                className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 outline-none focus:bg-muted"
              >
                <o.icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{o.label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-3.5" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
