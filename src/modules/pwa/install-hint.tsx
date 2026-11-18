"use client";

import { useSyncExternalStore } from "react";

type Navigator = typeof window.navigator & { standalone?: boolean };

/** iPhone and iPad have no install prompt: show how to add the app instead. */
function needsIosHint() {
  const nav = window.navigator as Navigator;
  const ios =
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const installed =
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return ios && !installed;
}
const subscribe = () => () => {};

export function InstallHint() {
  const show = useSyncExternalStore(subscribe, needsIosHint, () => false);
  if (!show) return null;
  return (
    <p className="mt-5 rounded-[10px] bg-muted px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
      Per usare Team Italfit come app: apri il menu{" "}
      <strong className="font-medium text-foreground">Condividi</strong> di
      Safari e scegli{" "}
      <strong className="font-medium text-foreground">
        Aggiungi alla schermata Home
      </strong>
      .
    </p>
  );
}
