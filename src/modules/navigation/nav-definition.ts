import type {
  NavCapabilityKey,
  NavGroupDefinition,
  NavMatch,
  NavResolveContext,
  ResolvedNavGroup,
  ResolvedNavItem,
  ShellNavCapabilities,
} from "@/modules/navigation/types";

/**
 * Canonical workflow-oriented navigation tree.
 * Only destinations that exist as real App Router pages are included.
 * Contextual PI Board/Compare/Review remain in PiTabs (not global nav).
 */
export const NAV_GROUPS: NavGroupDefinition[] = [
  {
    id: "home",
    label: "Home",
    hubHref: "/",
    hubMatch: { type: "exact", path: "/" },
    items: [],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    hubHref: "/portfolio",
    hubMatch: {
      type: "prefixExclude",
      path: "/portfolio",
      excludePrefixes: [
        "/portfolio/explorer",
        "/portfolio/health",
        "/portfolio/capacity",
      ],
    },
    items: [
      {
        id: "portfolio-overview",
        label: "Executive overview",
        href: "/portfolio",
        match: {
          type: "prefixExclude",
          path: "/portfolio",
          excludePrefixes: [
            "/portfolio/explorer",
            "/portfolio/health",
            "/portfolio/capacity",
          ],
        },
        capability: "always",
        description: "Attention, lifecycle, and executive metrics",
      },
      {
        id: "portfolio-explorer",
        label: "Explorer",
        href: "/portfolio/explorer",
        match: { type: "prefix", path: "/portfolio/explorer" },
        capability: "always",
      },
      {
        id: "portfolio-health",
        label: "Delivery health",
        href: "/portfolio/health",
        match: { type: "prefix", path: "/portfolio/health" },
        capability: "always",
      },
      {
        id: "portfolio-capacity",
        label: "Resource Planning",
        href: "/portfolio/capacity",
        match: { type: "prefix", path: "/portfolio/capacity" },
        capability: "always",
        description: "Capacity, utilization, and project commitments",
      },
    ],
  },
  {
    id: "initiatives",
    label: "Initiatives",
    hubHref: "/initiatives",
    hubMatch: {
      type: "prefixExclude",
      path: "/initiatives",
      excludePrefixes: ["/initiatives/new"],
    },
    items: [
      {
        id: "initiatives-all",
        label: "All initiatives",
        href: "/initiatives",
        match: {
          type: "prefixExclude",
          path: "/initiatives",
          excludePrefixes: ["/initiatives/new"],
        },
        capability: "canViewInitiatives",
      },
      {
        id: "initiatives-create",
        label: "Create initiative",
        href: "/initiatives/new",
        match: { type: "exact", path: "/initiatives/new" },
        capability: "canCreateInitiative",
      },
    ],
  },
  {
    id: "pi-planning",
    label: "PI Planning",
    hubHref: "/pi",
    hubMatch: {
      type: "prefixExclude",
      path: "/pi",
      excludePrefixes: ["/pi/new"],
    },
    items: [
      {
        id: "pi-list",
        label: "Program increments",
        href: "/pi",
        match: {
          type: "prefixExclude",
          path: "/pi",
          excludePrefixes: ["/pi/new"],
        },
        capability: "canViewPi",
        description: "Open a PI for board, compare, review, and baselines",
      },
      {
        id: "pi-create",
        label: "Create PI",
        href: "/pi/new",
        match: { type: "exact", path: "/pi/new" },
        capability: "canCreatePi",
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      {
        id: "gov-approvals",
        label: "Approvals",
        href: "/approvals",
        match: { type: "prefix", path: "/approvals" },
        capability: "canViewApprovals",
      },
      {
        id: "gov-decisions",
        label: "Decisions",
        href: "/decisions",
        match: { type: "prefix", path: "/decisions" },
        capability: "canViewDecisions",
      },
      {
        id: "gov-policy",
        label: "Governance policy",
        href: (ctx) =>
          ctx.organizationId
            ? `/organization/${ctx.organizationId}/governance-policy`
            : null,
        match: { type: "includesSegment", segment: "governance-policy" },
        capability: "canManageGovernancePolicy",
      },
    ],
  },
  {
    id: "organization",
    label: "Organization",
    hubHref: "/organization",
    hubMatch: {
      type: "prefixExclude",
      path: "/organization",
      excludePrefixes: ["/organization/setup"],
      excludeSegments: ["access", "governance-policy"],
    },
    items: [
      {
        id: "org-hub",
        label: "Organizations",
        href: "/organization",
        match: {
          type: "prefixExclude",
          path: "/organization",
          excludePrefixes: ["/organization/setup"],
          excludeSegments: ["access", "governance-policy"],
        },
        capability: "always",
        description: "Sections, departments, teams, and resources",
      },
      {
        id: "org-access",
        label: "Access & roles",
        href: (ctx) =>
          ctx.organizationId
            ? `/organization/${ctx.organizationId}/access`
            : null,
        match: { type: "includesSegment", segment: "access" },
        capability: "canManageAccess",
      },
    ],
  },
];

export function matchNavPath(pathname: string, match: NavMatch): boolean {
  const path = normalizePath(pathname);
  switch (match.type) {
    case "exact":
      return path === normalizePath(match.path);
    case "prefix": {
      const base = normalizePath(match.path);
      return path === base || path.startsWith(`${base}/`);
    }
    case "prefixExclude": {
      const base = normalizePath(match.path);
      if (!(path === base || path.startsWith(`${base}/`))) return false;
      for (const ex of match.excludePrefixes ?? []) {
        const e = normalizePath(ex);
        if (path === e || path.startsWith(`${e}/`)) return false;
      }
      for (const seg of match.excludeSegments ?? []) {
        if (pathIncludesSegment(path, seg)) return false;
      }
      return true;
    }
    case "includesSegment":
      return pathIncludesSegment(path, match.segment);
    default:
      return false;
  }
}

function pathIncludesSegment(path: string, segment: string): boolean {
  const seg = segment.replace(/^\/+|\/+$/g, "");
  return path.split("/").includes(seg);
}

export function capabilityAllowed(
  key: NavCapabilityKey,
  caps: ShellNavCapabilities,
): boolean {
  if (key === "always") return true;
  return Boolean(caps[key]);
}

export function extractActivePiId(pathname: string): string | null {
  const m = pathname.match(/^\/pi\/([^/]+)/);
  if (!m) return null;
  if (m[1] === "new") return null;
  return m[1] ?? null;
}

export function resolveNavGroups(
  pathname: string,
  ctx: NavResolveContext,
): ResolvedNavGroup[] {
  const groups: ResolvedNavGroup[] = [];

  for (const group of NAV_GROUPS) {
    const items: ResolvedNavItem[] = [];
    for (const item of group.items) {
      if (!capabilityAllowed(item.capability, ctx.capabilities)) continue;
      const href =
        typeof item.href === "function" ? item.href(ctx) : item.href;
      if (!href) continue;
      items.push({
        id: item.id,
        label: item.label,
        href,
        active: matchNavPath(pathname, item.match),
        description: item.description,
      });
    }

    const hubHref = group.hubHref;
    const hubActive = group.hubMatch
      ? matchNavPath(pathname, group.hubMatch)
      : false;

    if (group.id === "governance" && items.length === 0) continue;

    if (group.id === "initiatives") {
      const showHub = capabilityAllowed("canViewInitiatives", ctx.capabilities);
      if (!showHub && items.length === 0) continue;
      groups.push({
        id: group.id,
        label: group.label,
        hubHref: showHub ? hubHref : undefined,
        hubActive,
        items,
        containsActive: hubActive || items.some((i) => i.active),
      });
      continue;
    }

    if (group.id === "pi-planning") {
      const showHub = capabilityAllowed("canViewPi", ctx.capabilities);
      if (!showHub && items.length === 0) continue;
      groups.push({
        id: group.id,
        label: group.label,
        hubHref: showHub ? hubHref : undefined,
        hubActive,
        items,
        containsActive: hubActive || items.some((i) => i.active),
      });
      continue;
    }

    groups.push({
      id: group.id,
      label: group.label,
      hubHref,
      hubActive,
      items,
      containsActive: hubActive || items.some((i) => i.active),
    });
  }

  return groups;
}

/** All concrete hrefs currently visible — for broken-link tests. */
export function listVisibleHrefs(ctx: NavResolveContext): string[] {
  const hrefs: string[] = [];
  for (const g of resolveNavGroups("/", ctx)) {
    if (g.hubHref) hrefs.push(g.hubHref);
    for (const i of g.items) hrefs.push(i.href);
  }
  return [...new Set(hrefs)];
}

function normalizePath(path: string): string {
  if (!path) return "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export const DEFAULT_SHELL_CAPABILITIES: ShellNavCapabilities = {
  canViewApprovals: true,
  canViewDecisions: true,
  canManageGovernancePolicy: false,
  canManageAccess: false,
  canViewPi: true,
  canCreatePi: false,
  canViewInitiatives: true,
  canCreateInitiative: false,
};
