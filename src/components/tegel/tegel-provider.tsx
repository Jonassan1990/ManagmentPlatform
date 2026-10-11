"use client";

import { useEffect } from "react";

/**
 * Registers Scania Tegel web components once in the browser.
 * Safe for Next.js App Router (no browser APIs during SSR).
 */
export function TegelProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    void import("@scania/tegel/loader").then(({ defineCustomElements }) => {
      if (cancelled || typeof window === "undefined") return;
      void defineCustomElements(window);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
