"use client";
import Link from "next/link";
import {
  UnsavedChangesProvider,
  useNavigationRequest,
} from "@/modules/crm/use-unsaved-changes";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import { DropdownMenu } from "radix-ui";
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Eye,
  Home,
  LogOut,
  PanelLeft,
  Settings2,
  Users,
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
import type { CrmState } from "@/modules/crm/model";
import { signOut } from "@/modules/auth/actions";
import { CommandSearch } from "./command-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncNotice } from "./sync-notice";
const icons = {
  overview: Home,
  students: Users,
  plans: Dumbbell,
  calendar: CalendarDays,
};
const footerLinks = [
  { href: "/admin/impostazioni", label: "Impostazioni", icon: Settings2 },
  { href: "/area-studente", label: "Anteprima studente", icon: Eye },
];
const itemClass = (active: boolean, collapsed: boolean) =>
  cn(
    "flex h-8 items-center gap-2.5 rounded-[10px] text-sm font-medium transition-colors",
    collapsed ? "w-8 justify-center" : "px-2",
    active
      ? "bg-foreground/[.045] text-foreground"
      : "text-muted-foreground hover:bg-foreground/[.03] hover:text-foreground",
  );
function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <Link
        href="/admin"
        onClick={onNavigate}
        aria-label="Team Italfit, Home"
        className={cn(
          "flex h-[50px] shrink-0 items-center",
          collapsed ? "justify-center" : "px-4",
        )}
      >
        <Brand compact={collapsed} />
      </Link>
      <nav
        aria-label="Navigazione principale"
        className={cn("mt-1 space-y-0.5", collapsed ? "px-3.5" : "px-3")}
      >
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
              className={itemClass(active, collapsed)}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "mt-auto space-y-0.5 pb-3",
          collapsed ? "px-3.5" : "px-3",
        )}
      >
        {footerLinks.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={itemClass(active, collapsed)}
            >
              <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
const settingsSections: Record<string, string> = {
  "/admin/impostazioni": "Team",
  "/admin/impostazioni/proprieta": "Proprietà",
};
/** Section plus, on nested pages, the record the page is about. */
function breadcrumbs(pathname: string, state: CrmState) {
  if (pathname.startsWith("/admin/impostazioni"))
    return [
      { label: "Impostazioni", href: "/admin/impostazioni" },
      { label: settingsSections[pathname] ?? "Team" },
    ];
  const section = navigation.find(
    (i) => i.href !== "/admin" && pathname.startsWith(i.href),
  );
  if (!section) return [{ label: "Home" }];
  const rest = decodeURIComponent(pathname.slice(section.href.length + 1))
    .split("/")
    .filter(Boolean);
  if (!rest.length) return [{ label: section.label }];
  const id = rest[0];
  const detail =
    id === "nuovo"
      ? "Nuovo studente"
      : section.icon === "students"
        ? (() => {
            const s = state.students.find((x) => x.id === id);
            return s ? `${s.firstName} ${s.lastName}` : "Scheda";
          })()
        : section.icon === "plans"
          ? (state.plans?.find((p) => p.id === id)?.title ?? "Piano")
          : (state.lessons?.find((l) => l.id === id)?.title ?? "Lezione");
  return [{ label: section.label, href: section.href }, { label: detail }];
}
function initials(name?: string) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "TI"
  );
}
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <AdminShellContent>{children}</AdminShellContent>
    </UnsavedChangesProvider>
  );
}
// Pages that need the full width of the viewport (data grid, week calendar).
const wideRoutes = ["/admin/studenti", "/admin/lezioni"];
function AdminShellContent({ children }: { children: React.ReactNode }) {
  const requestNavigation = useNavigationRequest();
  const pathname = usePathname(),
    state = useCrm();
  const remote = useRemoteMode(),
    saving = useSaving(),
    viewer = useViewer();
  const sync = useSyncStatus();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false);
  const crumbs = breadcrumbs(pathname, state);
  const owner = state.admins.find((a) =>
    viewer ? a.id === viewer.recordId : a.role === "owner",
  );
  // Healthy remote sessions stay silent; anything else is worth a glance.
  const status = saving
    ? "Salvataggio…"
    : !remote
      ? "Demo locale"
      : !sync?.online
        ? "Offline"
        : sync.error
          ? "Da verificare"
          : sync.refreshing
            ? "Aggiornamento…"
            : null;
  const wide = wideRoutes.includes(pathname);
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded bg-background p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Vai al contenuto
      </a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r transition-[width] duration-150 lg:block",
          collapsed ? "w-[60px]" : "w-[256px]",
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>
      <div
        className={cn(
          "min-w-0 transition-[padding] duration-150",
          collapsed ? "lg:pl-[60px]" : "lg:pl-[256px]",
        )}
      >
        <header className="sticky top-0 z-20 grid h-[50px] grid-cols-[1fr_auto_1fr] items-center gap-3 border-b bg-background/90 px-3 backdrop-blur-md sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={
                collapsed ? "Espandi navigazione" : "Riduci navigazione"
              }
              className="hidden text-muted-foreground lg:flex"
              onClick={() => setCollapsed((v) => !v)}
            >
              <PanelLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Apri navigazione"
              className="text-muted-foreground lg:hidden"
              onClick={() => setMobile(true)}
            >
              <PanelLeft className="size-4" />
            </Button>
            <nav
              aria-label="Percorso"
              className="flex min-w-0 items-center gap-1 text-sm font-medium"
            >
              {crumbs.map((crumb, i) => (
                <Fragment key={crumb.label}>
                  {i > 0 && (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {"href" in crumb && crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hidden shrink-0 rounded-md px-1 text-muted-foreground hover:text-foreground sm:block"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current="page"
                      className="truncate px-1 text-foreground"
                    >
                      {crumb.label}
                    </span>
                  )}
                </Fragment>
              ))}
            </nav>
          </div>
          <div className="sm:w-[256px]">
            <CommandSearch />
          </div>
          <div className="flex items-center justify-end gap-2">
            {status && (
              <span
                role="status"
                className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    saving || sync?.refreshing
                      ? "bg-sky-500"
                      : remote
                        ? "bg-amber-500"
                        : "bg-neutral-400",
                  )}
                />
                {status}
              </span>
            )}
            <ThemeToggle />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Menu account"
                  className="flex size-8 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-background outline-none ring-offset-2 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-foreground/20"
                >
                  {initials(owner?.name)}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 w-64 rounded-xl border bg-card p-1 text-sm shadow-[0_4px_24px_rgba(0,0,0,0.08)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                  <div className="m-1 mb-1.5 rounded-[10px] border px-3 py-2.5">
                    <p className="truncate font-medium">
                      {owner?.name ?? "Amministratore"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {owner?.email ?? "Demo locale"}
                    </p>
                  </div>
                  {footerLinks.map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                      <Link
                        href={item.href}
                        className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 outline-none focus:bg-muted"
                      >
                        <item.icon className="size-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                  {remote && (
                    <>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 outline-none focus:bg-muted"
                        onSelect={() => {
                          requestNavigation(() => void signOut());
                        }}
                      >
                        <LogOut className="size-4 text-muted-foreground" />
                        Esci
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <main
          id="main-content"
          className={cn(
            "mx-auto w-full px-4 pt-8 pb-12 sm:px-8 lg:pt-12",
            wide ? "max-w-[1480px]" : "max-w-[1216px]",
            pathname === "/admin/studenti" &&
              "flex h-[calc(100dvh-50px)] min-h-[480px] flex-col pb-6 lg:pb-8",
          )}
        >
          <SyncNotice />
          {children}
        </main>
      </div>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          className="w-[272px] gap-0 bg-sidebar p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Navigazione Team Italfit</SheetTitle>
          <SheetDescription className="sr-only">
            Pagine del workspace.
          </SheetDescription>
          <SidebarContent onNavigate={() => setMobile(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
