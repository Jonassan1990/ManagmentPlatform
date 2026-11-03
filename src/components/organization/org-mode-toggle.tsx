"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { OrgUiMode } from "@/modules/organization/application/org-ui-mode";

/**
 * Separates browse (View) from structure setup (Config).
 * Only shown when the user may manage org structure; everyone else stays in View.
 */
export function OrgModeToggle({ canConfigure }: { canConfigure: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!canConfigure) return null;

  const mode: OrgUiMode =
    searchParams.get("mode") === "config" ? "config" : "view";

  function hrefFor(next: OrgUiMode): string {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "view") params.delete("mode");
    else params.set("mode", "config");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="mp-org-mode-toggle" role="group" aria-label="Organization mode">
      <Link
        href={hrefFor("view")}
        className={mode === "view" ? "is-active" : undefined}
        aria-current={mode === "view" ? "page" : undefined}
      >
        View
      </Link>
      <Link
        href={hrefFor("config")}
        className={mode === "config" ? "is-active" : undefined}
        aria-current={mode === "config" ? "page" : undefined}
      >
        Config
      </Link>
    </div>
  );
}
