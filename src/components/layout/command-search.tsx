"use client";
import { useEffect, useState } from "react";
import { useGuardedNavigation } from "@/modules/crm/use-unsaved-changes";
import { Dialog } from "radix-ui";
import { Search, UserRound, Command } from "lucide-react";
import { useCrm } from "@/modules/crm/store";
import { normalize } from "@/modules/crm/model";
const actions = [
  { label: "Aggiungi studente", hint: "Azione", href: "/admin/studenti/nuovo" },
  { label: "Home", hint: "Navigazione", href: "/admin" },
  { label: "Studenti", hint: "Navigazione", href: "/admin/studenti" },
  { label: "Piani e percorsi", hint: "Navigazione", href: "/admin/piani" },
  { label: "Calendario", hint: "Navigazione", href: "/admin/lezioni" },
  {
    label: "Proprietà",
    hint: "Impostazioni",
    href: "/admin/impostazioni/proprieta",
  },
  {
    label: "Team",
    hint: "Impostazioni",
    href: "/admin/impostazioni",
  },
];
export function CommandSearch() {
  const state = useCrm(),
    navigate = useGuardedNavigation();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const q = normalize(query);
  const results = [
    ...actions.filter((a) => !q || normalize(a.label).includes(q)),
    ...state.students
      .filter(
        (s) =>
          !s.archived &&
          (!q ||
            normalize(
              `${s.firstName} ${s.lastName} ${s.email} ${s.phone ?? ""}`,
            ).includes(q)),
      )
      .slice(0, 6)
      .map((s) => ({
        label: `${s.firstName} ${s.lastName}`,
        hint: s.email,
        href: `/admin/studenti/${encodeURIComponent(s.id)}`,
      })),
  ].slice(0, 14);
  const selected = Math.min(index, results.length - 1);
  const show = () => {
    setQuery("");
    setIndex(0);
    setOpen(true);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (
          document.querySelector('[role="dialog"],[role="alertdialog"]') &&
          !open
        )
          return;
        e.preventDefault();
        setQuery("");
        setIndex(0);
        setOpen((v) => !v);
      }
      if (
        e.key === "n" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest('input,textarea,select,[contenteditable="true"]')
        ) &&
        !document.querySelector('[role="dialog"],[role="alertdialog"]')
      ) {
        e.preventDefault();
        navigate("/admin/studenti/nuovo");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, navigate]);
  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };
  return (
    <>
      <button
        type="button"
        onClick={show}
        className="flex size-8 items-center justify-center gap-2 rounded-xl text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted sm:w-full sm:justify-start sm:border sm:border-input sm:bg-background sm:pr-1.5 sm:pl-2.5"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate sm:inline">Cerca…</span>
        <span className="sr-only sm:hidden">Cerca nel workspace</span>
        <span className="ml-auto hidden shrink-0 gap-1 sm:flex" aria-hidden>
          <kbd className="flex size-5 items-center justify-center rounded-md border font-sans text-[11px]">
            ⌘
          </kbd>
          <kbd className="flex size-5 items-center justify-center rounded-md border font-sans text-[11px]">
            K
          </kbd>
        </span>
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/20 dark:bg-black/60" />
          <Dialog.Content className="fixed top-[12dvh] left-1/2 z-[81] w-[calc(100%-32px)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-2xl border bg-card shadow-[0_16px_60px_rgba(0,0,0,0.16)]">
            <Dialog.Title className="sr-only">Cerca nel workspace</Dialog.Title>
            <Dialog.Description className="sr-only">
              Cerca studenti, apri una pagina o avvia un’azione. Usa le frecce e
              Invio.
            </Dialog.Description>
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                role="combobox"
                aria-label="Cerca nel workspace"
                aria-expanded
                aria-controls="command-results"
                aria-activedescendant={
                  results[selected] ? `command-${selected}` : undefined
                }
                autoComplete="off"
                className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Cerca studenti, pagine e azioni…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndex(
                      results.length ? (selected + 1) % results.length : 0,
                    );
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndex(
                      results.length
                        ? (selected + results.length - 1) % results.length
                        : 0,
                    );
                  }
                  if (e.key === "Enter" && results[selected]) {
                    e.preventDefault();
                    go(results[selected].href);
                  }
                }}
              />
              <Dialog.Close asChild>
                <button
                  className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  aria-label="Chiudi ricerca"
                >
                  Esc
                </button>
              </Dialog.Close>
            </div>
            <div
              id="command-results"
              role="listbox"
              aria-label="Risultati"
              className="max-h-[55dvh] overflow-y-auto p-1.5"
            >
              {!results.length && (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nessun risultato per “{query}”.
                </p>
              )}
              {results.map((a, i) => (
                <button
                  key={a.href}
                  id={`command-${i}`}
                  role="option"
                  aria-selected={i === selected}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(a.href)}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left ${i === selected ? "bg-muted" : ""}`}
                >
                  {a.hint.includes("@") ? (
                    <UserRound className="size-4 text-muted-foreground" />
                  ) : (
                    <Command className="size-4 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{a.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-between border-t px-4 py-2.5 text-[11px] text-muted-foreground">
              <span>↑ ↓ per navigare · Invio per aprire</span>
              <span>N · nuovo studente</span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
