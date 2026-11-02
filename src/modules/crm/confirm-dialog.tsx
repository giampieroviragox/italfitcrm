"use client";
import { AlertDialog } from "radix-ui";
import { useRef } from "react";
import { useSaving } from "./store";
import { Button } from "@/components/ui/button";
import { SyncNotice } from "@/components/layout/sync-notice";
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Conferma",
  onCancel,
  onConfirm,
  busy = false,
  error = "",
  fallbackFocus,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string;
  fallbackFocus?: () => HTMLElement | null;
}) {
  const storeSaving = useSaving();
  const saving = storeSaving || busy;
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v && !saving) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/20 dark:bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content
          onOpenAutoFocus={() => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            const target = previousFocus.current?.isConnected
              ? previousFocus.current
              : fallbackFocus?.();
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          className="fixed top-1/2 left-1/2 z-[71] max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-[0_8px_40px_rgba(0,0,0,0.12)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <AlertDialog.Title className="text-base font-medium">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-4">
            <SyncNotice />
          </div>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-[10px] bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-400"
            >
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={saving} onClick={onCancel}>
                Annulla
              </Button>
            </AlertDialog.Cancel>
            <Button disabled={saving} onClick={onConfirm}>
              {saving ? "Salvataggio…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
