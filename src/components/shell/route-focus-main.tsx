"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const MAIN_ID = "main-content";

/**
 * M4F-A: Move keyboard focus to main content after client navigations so
 * screen-reader and keyboard users are not left on chrome-only controls.
 *
 * M4F-D: Ignore the initial path (and React Strict Mode's double effect on
 * that same path) so the document-order skip link remains reachable on first Tab.
 */
export function RouteFocusMain() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (prevPath.current === null) {
      prevPath.current = pathname;
      return;
    }
    if (prevPath.current === pathname) {
      return;
    }
    prevPath.current = pathname;

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
