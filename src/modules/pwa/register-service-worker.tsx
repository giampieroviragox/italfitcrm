"use client";

import { useEffect } from "react";

/** Registers the offline-page service worker; production only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* The app works the same without it. */
      });
  }, []);
  return null;
}
