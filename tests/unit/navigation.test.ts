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
      ],
    };
    expect(matchNavPath("/portfolio", hub)).toBe(true);
    expect(matchNavPath("/portfolio/explorer", hub)).toBe(false);
    expect(
      matchNavPath("/portfolio/explorer", {
        type: "prefix",
        path: "/portfolio/explorer",
      }),
    ).toBe(true);
  });

  it("matches org-scoped access and policy segments", () => {
    expect(
      matchNavPath("/organization/abc/access", {
        type: "includesSegment",
        segment: "access",
      }),
    ).toBe(true);
    expect(
      matchNavPath("/organization/abc/governance-policy", {
        type: "includesSegment",
        segment: "governance-policy",
      }),
    ).toBe(true);
  });
});

describe("M4C-A navigation filtering", () => {
  it("resolves workflow groups with expected destinations", () => {
    const groups = resolveNavGroups("/portfolio/health", fullCtx);
    const ids = groups.map((g) => g.id);
    expect(ids).toContain("home");
    expect(ids).toContain("portfolio");
    expect(ids).toContain("governance");
    expect(ids).toContain("organization");

    const portfolio = groups.find((g) => g.id === "portfolio")!;
    expect(portfolio.containsActive).toBe(true);
    expect(portfolio.items.find((i) => i.id === "portfolio-health")?.active).toBe(
      true,
    );

    const hrefs = listVisibleHrefs(fullCtx);
    expect(hrefs).toContain("/portfolio/health");
    expect(hrefs).toContain("/organization/org-1/access");
    expect(hrefs).toContain("/organization/org-1/governance-policy");
    expect(hrefs).not.toContain("/pi/board");
  });

  it("hides governance and create actions for viewer capabilities", () => {
    const groups = resolveNavGroups("/", viewerCtx);
    expect(groups.find((g) => g.id === "governance")).toBeUndefined();
    const initiatives = groups.find((g) => g.id === "initiatives")!;
    expect(initiatives.items.map((i) => i.id)).toEqual(["initiatives-all"]);
    const pi = groups.find((g) => g.id === "pi-planning")!;
    expect(pi.items.some((i) => i.id === "pi-create")).toBe(false);
    expect(groups.find((g) => g.id === "organization")!.items.map((i) => i.id)).toEqual(
      ["org-hub"],
    );
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
    const pi = groups.find((g) => g.id === "pi-planning")!;
    expect(pi.containsActive).toBe(true);
    expect(pi.items.find((i) => i.id === "pi-list")?.active).toBe(true);
  });
});
