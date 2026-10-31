"use client";
import { AlertDialog } from "radix-ui";
import { useSaving } from "./store";
import { Button } from "@/components/ui/button";
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Conferma",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const saving = useSaving();
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v && !saving) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[71] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialog.Description>
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
