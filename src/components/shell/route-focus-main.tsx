"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const MAIN_ID = "main-content";

/**
 * M4F-A: Move keyboard focus to main content after client navigations so
 * screen-reader and keyboard users are not left on chrome-only controls.
 */
export function RouteFocusMain() {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const main = document.getElementById(MAIN_ID);
    if (!main) return;
    if (!main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
    }
    main.focus({ preventScroll: false });
  }, [pathname]);

  return null;
}

export { MAIN_ID };
