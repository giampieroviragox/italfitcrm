"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import {
  CalendarDays,
  Dumbbell,
  Home,
  Settings2,
  Users,
  PanelLeft,
  ChevronDown,
  ExternalLink,
  Info,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { navigation } from "@/config/site";
import { cn } from "@/lib/utils";
import {
  useCrm,
  useRemoteMode,
  useSaving,
  useViewer,
  useSyncStatus,
} from "@/modules/crm/store";
import { signOut } from "@/modules/auth/actions";
import { CommandSearch } from "./command-search";
import { SyncNotice } from "./sync-notice";
const icons = {
  overview: Home,
  students: Users,
  plans: Dumbbell,
  calendar: CalendarDays,
};
function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-[#fafafa]">
      <Link
        href="/admin"
        onClick={onNavigate}
        aria-label="Team Italfit, Home"
        className={cn(
          "flex h-20 items-center",
          collapsed ? "justify-center" : "px-5",
        )}
      >
        <Brand compact={collapsed} />
      </Link>
      <nav aria-label="Navigazione principale" className="space-y-1 px-3">
        {navigation.map((item) => {
          const Icon = icons[item.icon],
            active =
              item.href === "/admin"
                ? pathname === item.href
                : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl text-[13px] transition-colors",
                collapsed ? "justify-center" : "px-3",
                active
                  ? "bg-[#ededee] font-medium text-foreground"
                  : "text-muted-foreground hover:bg-[#f0f0f1] hover:text-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={1.7} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 p-3">
        <Link
          href="/admin/impostazioni"
          onClick={onNavigate}
          title={collapsed ? "Impostazioni" : undefined}
          aria-label={collapsed ? "Impostazioni" : undefined}
          aria-current={
            pathname.startsWith("/admin/impostazioni") ? "page" : undefined
          }
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl text-[13px]",
            collapsed ? "justify-center" : "px-3",
            pathname.startsWith("/admin/impostazioni")
              ? "bg-[#ededee] font-medium"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Settings2 className="size-[18px]" strokeWidth={1.7} />
          {!collapsed && "Impostazioni"}
        </Link>
        {!collapsed && (
          <div className="px-3 py-3 text-[10px] text-muted-foreground">
            Team Italfit · Workspace
          </div>
        )}
      </div>
    </div>
  );
}
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    state = useCrm();
  const remote = useRemoteMode(),
    saving = useSaving(),
    viewer = useViewer();
  const sync = useSyncStatus();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [info, setInfo] = useState(false);
  const current = navigation.find(
    (i) => i.href !== "/admin" && pathname.startsWith(i.href),
  );
  const title = pathname.startsWith("/admin/impostazioni")
    ? "Impostazioni"
    : (current?.label ?? "Home");
  const owner = state.admins.find((a) =>
    viewer ? a.id === viewer.recordId : a.role === "owner",
  );
  return (
    <div className="min-h-dvh bg-white">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded bg-white p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Vai al contenuto
      </a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r transition-[width] duration-150 lg:block",
          collapsed ? "w-[72px]" : "w-[232px]",
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>
      <div
        className={cn(
          "min-w-0 transition-[padding] duration-150",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[232px]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-white/95 px-4 backdrop-blur-md sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                collapsed ? "Espandi navigazione" : "Riduci navigazione"
              }
              className="hidden text-muted-foreground lg:flex"
              onClick={() => setCollapsed((v) => !v)}
            >
              <PanelLeft className="size-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Apri navigazione"
              className="lg:hidden"
              onClick={() => setMobile(true)}
            >
              <PanelLeft className="size-[18px]" />
            </Button>
            <span className="truncate text-[13px] font-medium">{title}</span>
          </div>
          <div className="ml-auto w-9 sm:mx-auto sm:w-[min(38vw,360px)]">
            <CommandSearch />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setInfo(true)}
              aria-label="Stato del workspace"
              className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  remote && sync?.online && !sync.error
                    ? "bg-emerald-600"
                    : "bg-amber-600",
                )}
              />
              <span role="status" className="hidden sm:inline">
                {saving
                  ? "Salvataggio…"
                  : remote
                    ? !sync?.online
                      ? "Offline"
                      : sync.error
                        ? "Da verificare"
                        : sync.refreshing
                          ? "Aggiornamento…"
                          : "Workspace online"
                    : "Demo locale"}
              </span>
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 px-1.5"
                  aria-label="Menu amministratore"
                >
                  <span className="flex size-7 items-center justify-center rounded-full border bg-muted text-[10px] font-medium">
                    TI
                  </span>
                  <ChevronDown className="hidden size-3 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={12}
                  className="z-50 w-60 rounded-xl border bg-white p-1.5 shadow-lg"
                >
                  <div className="border-b px-3 py-3">
                    <p className="truncate text-sm font-medium">
                      {owner?.name ?? "Amministratore"}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {owner?.email ?? "Workspace locale"}
                    </p>
                  </div>
                  {[
                    { href: "/admin/impostazioni", label: "Impostazioni" },
                    { href: "/area-studente", label: "Anteprima studente" },
                    { href: "/login", label: "Pagina di accesso" },
                  ].map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm outline-none focus:bg-muted"
                      >
                        {item.label}
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                  {remote && (
                    <DropdownMenu.Item
                      className="rounded-lg px-3 py-2.5 text-sm outline-none focus:bg-muted"
                      onSelect={() => {
                        void signOut();
                      }}
                    >
                      Esci
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item
                    className="rounded-lg px-3 py-2.5 text-sm outline-none focus:bg-muted"
                    onSelect={() => setInfo(true)}
                  >
                    Informazioni workspace
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
        >
          <SyncNotice />
          {children}
        </main>
      </div>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[272px] gap-0 bg-[#fafafa] p-0">
          <SheetTitle className="sr-only">Navigazione Team Italfit</SheetTitle>
          <SheetDescription className="sr-only">
            Pagine del workspace.
          </SheetDescription>
          <SidebarContent onNavigate={() => setMobile(false)} />
        </SheetContent>
      </Sheet>
      <Dialog.Root open={info} onOpenChange={setInfo}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/20" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[71] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-xl">
            <Info className="mb-4 size-5 text-muted-foreground" />
            <Dialog.Title className="text-lg font-medium">
              {remote ? "Workspace condiviso" : "Workspace locale"}
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
              {remote
                ? "Le modifiche sono condivise con gli amministratori del team. Ogni studente accede al proprio piano e alle lezioni con un account personale."
                : "I dati restano in questo browser. Account e inviti non sono attivi nella demo."}
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button className="mt-6 w-full">Ho capito</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
