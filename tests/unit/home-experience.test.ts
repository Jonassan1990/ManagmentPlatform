import { describe, expect, it } from "vitest";
import {
  buildHomeFooterLinks,
  buildHomeQuickLinks,
  selectAuthorizedPiEntry,
} from "@/modules/navigation/home-experience";
import { DEFAULT_SHELL_CAPABILITIES } from "@/modules/navigation/nav-definition";

describe("selectAuthorizedPiEntry", () => {
  it("prefers ACTIVE over REVIEW and newer startDate", () => {
    const pick = selectAuthorizedPiEntry([
      {
        id: "r1",
        status: "REVIEW",
        startDate: "2026-06-01",
        referenceKey: "PI-OLD-R",
        name: "Old review",
      },
      {
        id: "a1",
        status: "ACTIVE",
        startDate: "2026-01-01",
        referenceKey: "PI-OLD-A",
        name: "Old active",
      },
      {
        id: "a2",
        status: "ACTIVE",
        startDate: "2026-09-01",
        referenceKey: "PI-NEW-A",
        name: "New active",
      },
      {
        id: "d1",
        status: "DRAFT",
        startDate: "2026-10-01",
        referenceKey: "PI-DRAFT",
        name: "Draft",
      },
    ]);
    expect(pick?.id).toBe("a2");
    expect(pick?.href).toBe("/pi/a2/board");
  });

  it("falls back to latest REVIEW when no ACTIVE", () => {
    const pick = selectAuthorizedPiEntry([
      {
        id: "r1",
        status: "REVIEW",
        startDate: "2026-01-01",
        referenceKey: "PI-R1",
        name: "R1",
      },
      {
        id: "r2",
        status: "REVIEW",
        startDate: "2026-08-01",
        referenceKey: "PI-R2",
        name: "R2",
      },
    ]);
    expect(pick?.id).toBe("r2");
    expect(pick?.href).toBe("/pi/r2/review");
  });

  it("falls back to BASELINED when no ACTIVE/REVIEW", () => {
    const pick = selectAuthorizedPiEntry([
      {
        id: "b1",
        status: "BASELINED",
        startDate: "2026-05-01",
        referenceKey: "PI-B1",
        name: "Baselined",
      },
      {
        id: "d1",
        status: "DRAFT",
        startDate: "2026-09-01",
        referenceKey: "PI-D",
        name: "Draft",
      },
    ]);
    expect(pick?.id).toBe("b1");
    expect(pick?.href).toBe("/pi/b1/board");
  });

  it("returns null when no entry statuses", () => {
    expect(
      selectAuthorizedPiEntry([
        {
          id: "d",
          status: "DRAFT",
          startDate: "2026-01-01",
          referenceKey: "PI-D",
          name: "D",
        },
      ]),
    ).toBeNull();
  });
});

describe("buildHomeQuickLinks", () => {
  it("hides governance and create actions for viewer capabilities", () => {
    const links = buildHomeQuickLinks({
      capabilities: {
        ...DEFAULT_SHELL_CAPABILITIES,
        canViewApprovals: false,
        canViewDecisions: false,
        canCreateInitiative: false,
        canCreatePi: false,
        canManageAccess: false,
        canManageGovernancePolicy: false,
      },
      organizationId: "org-1",
      piEntry: null,
    });
    const ids = links.map((l) => l.id);
    expect(ids).toContain("portfolio");
    expect(ids).toContain("initiatives");
    expect(ids).toContain("pi-list");
    expect(ids).not.toContain("approvals");
    expect(ids).not.toContain("decisions");
    expect(ids).not.toContain("access");
    expect(ids).not.toContain("policy");
    expect(ids).not.toContain("initiative-new");
  });

  it("includes PI entry and admin destinations when permitted", () => {
    const links = buildHomeQuickLinks({
      capabilities: {
        ...DEFAULT_SHELL_CAPABILITIES,
        canViewApprovals: true,
        canManageAccess: true,
        canManageGovernancePolicy: true,
        canCreatePi: true,
      },
      organizationId: "org-1",
      piEntry: {
        id: "pi-1",
        status: "ACTIVE",
        referenceKey: "PI-100",
        name: "Q4",
        href: "/pi/pi-1/board",
      },
    });
    const ids = links.map((l) => l.id);
    expect(ids).toContain("pi-entry");
    expect(ids).toContain("approvals");
    expect(ids).toContain("access");
    expect(ids).toContain("policy");
    expect(ids).toContain("pi-new");
    expect(links.find((l) => l.id === "pi-entry")?.href).toBe(
      "/pi/pi-1/board",
    );
  });

  it("scopes Portfolio / Explorer / Health / Capacity quick links to organizationId", () => {
    const links = buildHomeQuickLinks({
      capabilities: DEFAULT_SHELL_CAPABILITIES,
      organizationId: "org-42",
      piEntry: null,
    });
    expect(links.find((l) => l.id === "portfolio")?.href).toBe(
      "/portfolio?organizationId=org-42",
    );
    expect(links.find((l) => l.id === "explorer")?.href).toBe(
      "/portfolio/explorer?organizationId=org-42",
    );
    expect(links.find((l) => l.id === "health")?.href).toBe(
      "/portfolio/health?organizationId=org-42",
    );
    expect(links.find((l) => l.id === "capacity")?.href).toBe(
      "/portfolio/capacity?organizationId=org-42",
    );
  });

  it("footer links are a capability-filtered subset", () => {
    const footer = buildHomeFooterLinks({
      capabilities: {
        ...DEFAULT_SHELL_CAPABILITIES,
        canViewApprovals: true,
        canViewDecisions: false,
      },
      organizationId: null,
    });
    const ids = footer.map((l) => l.id);
    expect(ids).toContain("approvals");
    expect(ids).not.toContain("decisions");
    expect(ids).toContain("portfolio");
  });
});
