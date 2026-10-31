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
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm" />
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
          className="fixed top-1/2 left-1/2 z-[71] max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-white p-6 shadow-xl"
        >
          <AlertDialog.Title className="text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-4">
            <SyncNotice />
          </div>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700"
            >
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
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
