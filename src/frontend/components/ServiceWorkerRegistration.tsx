"use client";

import { useEffect } from "react";

// Registered once, app-wide, from the root layout — see public/sw.js for
// what it actually does (installability + an offline navigation fallback,
// nothing more; no API/data caching).
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed", err);
      });
    }
  }, []);

  return null;
}
