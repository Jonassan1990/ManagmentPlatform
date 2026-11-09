import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHELL_CAPABILITIES,
  listVisibleHrefs,
} from "@/modules/navigation/nav-definition";

const APP_ROOT = path.join(process.cwd(), "src/app");

function hrefToPageFile(href: string): string | null {
  const clean = href.split("?")[0] ?? href;
  if (!clean.startsWith("/")) return null;
  if (clean.includes("[")) return null; // dynamic templates checked separately
  const segments = clean.split("/").filter(Boolean);
  // Dynamic org-scoped destinations from nav use a real uuid in tests — skip file map.
  if (segments.some((s) => /^[0-9a-f-]{36}$/i.test(s))) return null;

  if (segments.length === 0) {
    return path.join(APP_ROOT, "page.tsx");
  }
  return path.join(APP_ROOT, ...segments, "page.tsx");
}

describe("sidebar destinations have App Router pages", () => {
  it("every static visible href maps to a page.tsx", () => {
    const hrefs = listVisibleHrefs({
      capabilities: {
        ...DEFAULT_SHELL_CAPABILITIES,
        canManageGovernancePolicy: true,
        canManageAccess: true,
        canCreatePi: true,
        canCreateInitiative: true,
        canReviewVacation: true,
        canViewOnboarding: true,
        canManageOnboarding: true,
        canManageAdminConfig: true,
      },
      organizationId: null,
      activePiId: null,
    });

    const missing: string[] = [];
    for (const href of hrefs) {
      const file = hrefToPageFile(href);
      if (!file) continue;
      if (!existsSync(file)) missing.push(`${href} → ${file}`);
    }
    expect(missing).toEqual([]);
  });

  it("known static sidebar routes exist", () => {
    const required = [
      "/",
      "/portfolio",
      "/portfolio/explorer",
      "/portfolio/health",
      "/portfolio/capacity",
      "/portfolio/reports",
      "/delivery",
      "/initiatives",
      "/initiatives/new",
      "/pi",
      "/pi/new",
      "/approvals",
      "/decisions",
      "/organization",
      "/vacation",
      "/vacation/inbox",
      "/vacation/cover",
      "/vacation/calendar",
      "/vacation/year",
      "/onboarding",
      "/admin",
      "/guide",
    ];
    for (const href of required) {
      const file = hrefToPageFile(href);
      expect(file && existsSync(file), `${href} missing`).toBe(true);
    }
  });
});
