"use client";
import {
  cloneElement,
  isValidElement,
  useId,
  useRef,
  type ReactElement,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { FormChangeContext } from "@/components/ui/form-change-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { SyncNotice } from "@/components/layout/sync-notice";
const CancelContext = createContext<() => void>(() => {});
export function EditorCancel() {
  const cancel = useContext(CancelContext);
  return (
    <Button type="button" variant="outline" onClick={cancel}>
      Annulla
    </Button>
  );
}
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  useStorageIssue,
  retryStorage,
  downloadBackup,
  useSaving,
  useRemoteMode,
} from "./store";
export const control =
  "crm-control block w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2.5 text-sm leading-5 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 aria-invalid:border-destructive read-only:bg-muted/40 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-muted-foreground";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const [error, setError] = useState("");
  const input = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{
          "aria-labelledby"?: string;
          "aria-describedby"?: string;
          "aria-invalid"?: boolean;
        }>,
        {
          "aria-labelledby": labelId,
          "aria-describedby":
            [hint ? hintId : "", error ? errorId : ""]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-invalid": error ? true : undefined,
        },
      )
    : children;
  return (
    <label
      className="flex min-w-0 flex-col gap-2 text-sm font-medium"
      onChangeCapture={() => setError("")}
      onInvalidCapture={(event) => {
        const target = event.target;
        if (
          !(
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement
          ) ||
          target.getAttribute("aria-hidden") === "true"
        )
          return;
        const validity = target.validity;
        setError(
          validity.valueMissing
            ? "Compila questo campo."
            : validity.typeMismatch && target.type === "email"
              ? "Inserisci un indirizzo email valido."
              : validity.typeMismatch && target.type === "url"
                ? "Inserisci un link completo, ad esempio https://esempio.it."
                : validity.rangeUnderflow
                  ? `Il valore minimo è ${target.getAttribute("min")}.`
                  : validity.rangeOverflow
                    ? `Il valore massimo è ${target.getAttribute("max")}.`
                    : validity.stepMismatch
                      ? "Inserisci un valore consentito."
                      : "Controlla il valore inserito.",
        );
      }}
    >
      <span id={labelId} className="block leading-5">
        {label}
      </span>
      {input}
      {error && (
        <span id={errorId} className="text-xs font-normal text-destructive">
          {error}
        </span>
      )}
      {hint && (
        <span
          id={hintId}
          className="block text-xs font-normal leading-5 text-muted-foreground"
        >
          {hint}
        </span>
      )}
    </label>
  );
}
export function Editor({
  title,
  description,
  close,
  children,
  dirty: explicitDirty,
}: {
  title: string;
  description: string;
  close: () => void;
  children: ReactNode;
  dirty?: boolean;
}) {
  const saving = useSaving();
  const firstInvalid = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [validationError, setValidationError] = useState("");
  const [localDirty, setDirty] = useState(false);
  const dirty = explicitDirty ?? localDirty;
  const [confirm, setConfirm] = useState(false);
  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirm(true);
    else close();
  };
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return (
    <CancelContext.Provider value={requestClose}>
      <FormChangeContext.Provider value={() => setDirty(true)}>
        <ConfirmDialog
          open={confirm}
          title="Scartare le modifiche?"
          description="Le modifiche non salvate andranno perse."
          confirmLabel="Scarta modifiche"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            close();
          }}
        />
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) requestClose();
          }}
        >
          <SheetContent
            onOpenAutoFocus={() => {
              previousFocus.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
            }}
            onCloseAutoFocus={(event) => {
              if (previousFocus.current?.isConnected) {
                event.preventDefault();
                previousFocus.current.focus();
              }
            }}
            className="crm-editor w-full gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]"
          >
            <SheetHeader className="shrink-0 gap-3 border-b px-6 pt-7 pb-6 sm:px-8 sm:pt-8">
              <SheetTitle className="pr-10 text-[22px] leading-7 font-semibold tracking-tight">
                {title}
              </SheetTitle>
              <SheetDescription className="pr-5 text-sm leading-6">
                {description}
              </SheetDescription>
            </SheetHeader>
            <div
              className="crm-editor-body min-h-0 flex-1 overflow-y-auto px-6 pt-6 sm:px-8"
              data-validation-error={validationError ? "true" : undefined}
              onInvalidCapture={(e) => {
                e.preventDefault();
                if (firstInvalid.current) return;
                firstInvalid.current = true;
                setValidationError(
                  "Controlla i campi evidenziati prima di salvare.",
                );
                const target = e.target;
                if (target instanceof HTMLElement) {
                  const visible =
                    target.getAttribute("aria-hidden") === "true"
                      ? (target.parentElement?.querySelector<HTMLElement>(
                          '[role="combobox"]',
                        ) ??
                        target
                          .closest('[role="radiogroup"]')
                          ?.querySelector<HTMLElement>('[role="radio"]') ??
                        target
                          .closest("label")
                          ?.querySelector<HTMLElement>('[role="checkbox"]'))
                      : target;
                  (visible ?? target).focus();
                }
                // Browsers flush microtasks between native invalid events.
                // Keep the first field focused for the entire validation pass.
                setTimeout(() => {
                  firstInvalid.current = false;
                }, 0);
              }}
              onChangeCapture={() => {
                setDirty(true);
                setValidationError("");
              }}
            >
              <SyncNotice />
              {validationError && (
                <p
                  role="alert"
                  className="mb-5 rounded-lg bg-red-50 p-3 text-xs text-red-700"
                >
                  {validationError}
                </p>
              )}
              <fieldset
                disabled={saving}
                className="contents"
                aria-busy={saving}
              >
                {children}
              </fieldset>
            </div>
          </SheetContent>
        </Sheet>
      </FormChangeContext.Provider>
    </CancelContext.Provider>
  );
}
export function LocalNotice() {
  const issue = useStorageIssue();
  const remote = useRemoteMode();
  return issue && !remote ? (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p>{issue}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={retryStorage}>
          Ricarica dati
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            try {
              downloadBackup();
            } catch {
              alert("Impossibile leggere i dati del browser.");
            }
          }}
        >
          Scarica copia dati
        </Button>
      </div>
    </div>
  ) : null;
}
export function FormError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
      {message}
    </p>
  ) : null;
}
