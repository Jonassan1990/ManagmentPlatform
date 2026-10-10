/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/shell/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

vi.mock("@/components/shell/route-focus-main", () => ({
  RouteFocusMain: () => null,
}));

describe("AppShell skip link (M4F-D)", () => {
  it("places Skip to main content as the first link in the shell", () => {
    const { container } = render(
      <AppShell
        nav={{
          capabilities: {
            canViewApprovals: true,
            canViewDecisions: true,
            canManageGovernancePolicy: false,
            canManageAccess: false,
            canViewPi: true,
            canCreatePi: false,
            canViewInitiatives: true,
            canCreateInitiative: false,
          },
          organizationId: "org-1",
        }}
        principal={{
          displayName: "TempOwner",
          email: null,
          source: "temp",
          hasAccess: true,
        }}
      >
        <main id="main-content">Content</main>
      </AppShell>,
    );

    const skip = screen.getByRole("link", { name: /Skip to main content/i });
    expect(skip).toHaveAttribute("href", "#main-content");
    const firstLink = container.querySelector("a[href]");
    expect(firstLink).toBe(skip);
  });
});
