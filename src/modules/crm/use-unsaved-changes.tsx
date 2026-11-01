"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./confirm-dialog";

interface NavigationEvent extends Event {
  navigationType: string;
  destination: { sameDocument: boolean; key: string; url: string };
}
interface NavigationTarget extends EventTarget {
  traverseTo: (key: string) => unknown;
}
interface Guard {
  register: (discard: () => void) => () => void;
  request: (action: () => void) => void;
}
const UnsavedContext = createContext<Guard>({
  register: () => () => {},
  request: (action) => action(),
});

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Set<() => void>());
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const register = useCallback((discard: () => void) => {
    drafts.current.add(discard);
    setDirty(true);
    return () => {
      drafts.current.delete(discard);
      setDirty(drafts.current.size > 0);
    };
  }, []);
  const request = useCallback((action: () => void) => {
    if (drafts.current.size) setPending(() => action);
    else action();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    let replayingClick = false;
    const click = (event: MouseEvent) => {
      if (
        replayingClick ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        (link.target && link.target !== "_self") ||
        link.hasAttribute("download")
      )
        return;
      const url = new URL(link.href);
      // Document exits use beforeunload; hashes keep the current draft.
      if (
        url.origin !== location.origin ||
        (url.pathname === location.pathname && url.search === location.search)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      request(() => {
        // Replay the link so its own handlers, mobile menu and Next.js options
        // still run after the draft is explicitly discarded.
        replayingClick = true;
        try {
          link.click();
        } finally {
          replayingClick = false;
        }
      });
    };
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigation = (window as Window & { navigation?: NavigationTarget })
      .navigation;
    let replaying = false;
    const traverse = (event: Event) => {
      const nav = event as NavigationEvent;
      if (
        replaying ||
        nav.navigationType !== "traverse" ||
        !nav.destination.sameDocument ||
        !nav.cancelable
      )
        return;
      const url = new URL(nav.destination.url);
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      event.preventDefault();
      request(() => {
        replaying = true;
        navigation?.traverseTo(nav.destination.key);
      });
    };
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    navigation?.addEventListener("navigate", traverse);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("beforeunload", unload);
      navigation?.removeEventListener("navigate", traverse);
    };
  }, [dirty, request]);
  return (
    <UnsavedContext.Provider value={{ register, request }}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        title="Uscire senza salvare?"
        description="Hai modifiche non salvate. Se continui, verranno scartate."
        confirmLabel="Scarta e continua"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          for (const discard of drafts.current) discard();
          action?.();
        }}
      />
    </UnsavedContext.Provider>
  );
}

export function useUnsavedChanges(dirty: boolean, onDiscard: () => void) {
  const { register } = useContext(UnsavedContext);
  const discard = useEffectEvent(onDiscard);
  useEffect(() => {
    if (dirty) return register(() => discard());
  }, [dirty, register]);
}

export function useGuardedNavigation() {
  const { request } = useContext(UnsavedContext);
  const router = useRouter();
  return useCallback(
    (href: string) => request(() => router.push(href)),
    [request, router],
  );
}

export function useNavigationRequest() {
  return useContext(UnsavedContext).request;
}
