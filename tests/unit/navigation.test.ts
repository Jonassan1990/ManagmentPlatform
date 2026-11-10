import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHELL_CAPABILITIES,
  listVisibleHrefs,
  matchNavPath,
  resolveNavGroups,
} from "@/modules/navigation/nav-definition";
import type { NavResolveContext } from "@/modules/navigation/types";

const fullCtx: NavResolveContext = {
  capabilities: {
    ...DEFAULT_SHELL_CAPABILITIES,
    canManageGovernancePolicy: true,
    canManageAccess: true,
    canCreatePi: true,
    canCreateInitiative: true,
    canManageAdminConfig: true,
  },
  organizationId: "org-1",
  activePiId: null,
};

const viewerCtx: NavResolveContext = {
  capabilities: {
    canViewApprovals: false,
    canViewDecisions: false,
    canManageGovernancePolicy: false,
    canManageAccess: false,
    canViewPi: true,
    canCreatePi: false,
    canViewInitiatives: true,
    canCreateInitiative: false,
    canViewVacation: true,
    canReviewVacation: false,
    canViewOnboarding: false,
    canManageOnboarding: false,
    canManageAdminConfig: false,
  },
  organizationId: "org-1",
  activePiId: null,
};

describe("M4C-A navigation matching", () => {
  it("matches home exactly", () => {
    expect(matchNavPath("/", { type: "exact", path: "/" })).toBe(true);
    expect(matchNavPath("/portfolio", { type: "exact", path: "/" })).toBe(
      false,
    );
  });

  it("nests portfolio children without activating hub", () => {
    const hub = {
      type: "prefixExclude" as const,
      path: "/portfolio",
      excludePrefixes: [
        "/portfolio/explorer",
        "/portfolio/health",
        "/portfolio/capacity",
        "/portfolio/reports",
      ],
    };
    expect(matchNavPath("/portfolio", hub)).toBe(true);
    expect(matchNavPath("/portfolio/explorer", hub)).toBe(false);
    expect(matchNavPath("/portfolio/reports", hub)).toBe(false);
  });

  it("matches org-scoped access and policy segments", () => {
    expect(
      matchNavPath("/organization/abc/access", {
        type: "includesSegment",
        segment: "access",
      }),
    ).toBe(true);
  });
});

describe("clear product sections navigation", () => {
  it("resolves Approvals as a top sidebar item beside People and Delivery", () => {
    const groups = resolveNavGroups("/portfolio/health", fullCtx);
    const ids = groups.map((g) => g.id);
    expect(ids).toContain("home");
    expect(ids).toContain("approvals");
    expect(ids).toContain("people");
    expect(ids).toContain("delivery");
    expect(ids).toContain("planning");
    expect(ids).toContain("organization");
    expect(ids.indexOf("approvals")).toBeLessThan(ids.indexOf("people"));

    const planning = groups.find((g) => g.id === "planning")!;
    expect(planning.containsActive).toBe(true);
    expect(
      planning.items.find((i) => i.id === "portfolio-health")?.active,
    ).toBe(true);

    const hrefs = listVisibleHrefs(fullCtx);
    expect(hrefs).toContain("/approvals");
    expect(hrefs).toContain("/delivery");
    expect(hrefs).toContain("/portfolio/health");
    expect(hrefs).toContain("/onboarding");
    expect(hrefs).toContain("/organization/org-1/access");
    expect(hrefs).toContain("/guide");
    expect(hrefs).not.toContain("/pi/board");
    expect(
      groups.find((g) => g.id === "delivery")!.items.some((i) => i.id === "gov-approvals"),
    ).toBe(false);
  });

  it("activates top Approvals without marking Delivery active", () => {
    const groups = resolveNavGroups("/approvals", fullCtx);
    expect(groups.find((g) => g.id === "approvals")?.hubActive).toBe(true);
    expect(groups.find((g) => g.id === "delivery")?.containsActive).toBe(false);
  });

  it("hides Approvals and create actions for viewer capabilities", () => {
    const groups = resolveNavGroups("/", viewerCtx);
    expect(groups.some((g) => g.id === "approvals")).toBe(false);
    const delivery = groups.find((g) => g.id === "delivery")!;
    expect(delivery.items.map((i) => i.id)).toEqual([
      "delivery-hub",
      "initiatives-all",
    ]);
    const planning = groups.find((g) => g.id === "planning")!;
    expect(planning.items.some((i) => i.id === "pi-create")).toBe(false);
    expect(
      groups.find((g) => g.id === "organization")!.items.map((i) => i.id),
    ).toEqual(["org-hub"]);
  });

  it("hides Access for portfolio-manager-shaped capabilities", () => {
    const portfolioMgr: NavResolveContext = {
      capabilities: {
        canViewApprovals: false,
        canViewDecisions: false,
        canManageGovernancePolicy: false,
        canManageAccess: false,
        canViewPi: true,
        canCreatePi: false,
        canViewInitiatives: true,
        canCreateInitiative: true,
        canViewVacation: true,
        canReviewVacation: false,
        canViewOnboarding: false,
        canManageOnboarding: false,
        canManageAdminConfig: false,
      },
      organizationId: "org-1",
      activePiId: null,
    };
    const groups = resolveNavGroups("/", portfolioMgr);
    const org = groups.find((g) => g.id === "organization")!;
    expect(org.items.some((i) => i.id === "org-access")).toBe(false);
    expect(listVisibleHrefs(portfolioMgr)).toContain("/initiatives/new");
  });

  it("keeps PI list but not create for team-manager-shaped capabilities", () => {
    const teamMgr: NavResolveContext = {
      capabilities: {
        canViewApprovals: false,
        canViewDecisions: false,
        canManageGovernancePolicy: false,
        canManageAccess: false,
        canViewPi: true,
        canCreatePi: false,
        canViewInitiatives: true,
        canCreateInitiative: false,
        canViewVacation: true,
        canReviewVacation: false,
        canViewOnboarding: false,
        canManageOnboarding: false,
        canManageAdminConfig: false,
      },
      organizationId: "org-1",
      activePiId: null,
    };
    const groups = resolveNavGroups("/", teamMgr);
    const planning = groups.find((g) => g.id === "planning")!;
    expect(planning.items.some((i) => i.id === "pi-list")).toBe(true);
    expect(planning.items.some((i) => i.id === "pi-create")).toBe(false);
  });

  it("does not invent broken global PI contextual routes", () => {
    const hrefs = listVisibleHrefs(fullCtx);
    for (const bad of [
      "/pi/board",
      "/pi/compare",
      "/pi/review",
      "/pi/baseline",
      "/access",
    ]) {
      expect(hrefs).not.toContain(bad);
    }
  });

  it("keeps PI list active for nested PI workspace routes", () => {
    const groups = resolveNavGroups(
      "/pi/960860ac-c3e0-46b2-84a5-5cde50647584/review",
      fullCtx,
    );
    const planning = groups.find((g) => g.id === "planning")!;
    expect(planning.containsActive).toBe(true);
    expect(planning.items.find((i) => i.id === "pi-list")?.active).toBe(true);
  });
});
