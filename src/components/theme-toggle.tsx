"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";
const KEY = "italfit.theme";
const EVENT = "italfit-theme";

/** Runs before paint in the root layout so the page never flashes the wrong theme. */
export const themeScript = `(()=>{try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

/** The theme actually on screen, whether chosen or inherited from the system. */
function isDark() {
  return document.documentElement.classList.contains("dark");
}
function subscribe(callback: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const system = () => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      /* Without storage the system preference wins. */
    }
    if (stored !== "light" && stored !== "dark")
      document.documentElement.classList.toggle("dark", media.matches);
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
    localStorage.setItem(KEY, theme);
  } catch {
    /* The choice still applies to this page. */
  }
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(EVENT));
}

/** One click switches between light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const label = dark ? "Passa al tema chiaro" : "Passa al tema scuro";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => choose(dark ? "light" : "dark")}
      className={cn(
        "flex size-8 items-center justify-center rounded-[10px] text-muted-foreground outline-none transition-colors hover:bg-foreground/[.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/20",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
