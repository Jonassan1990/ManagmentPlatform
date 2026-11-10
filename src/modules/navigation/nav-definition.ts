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
 * Clear product sections for the sidebar.
 * Only destinations that exist as real App Router pages are included.
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
    id: "people",
    label: "People",
    items: [
      {
        id: "vacation-mine",
        label: "Vacation",
        href: "/vacation",
        match: {
          type: "prefixExclude",
          path: "/vacation",
          excludePrefixes: [
            "/vacation/inbox",
            "/vacation/calendar",
            "/vacation/year",
            "/vacation/cover",
            "/vacation/plan",
          ],
        },
        capability: "canViewVacation",
        description: "Request time off and track status",
      },
      {
        id: "vacation-plan",
        label: "Vacation plan",
        href: "/vacation/plan",
        match: { type: "prefix", path: "/vacation/plan" },
        capability: "canViewVacation",
        description: "2026 plan, one department at a time",
      },
      {
        id: "vacation-cover",
        label: "Availability",
        href: "/vacation/cover",
        match: { type: "prefix", path: "/vacation/cover" },
        capability: "canViewVacation",
        description: "Green, yellow, and red days for who is in",
      },
      {
        id: "vacation-calendar",
        label: "Vacation calendar",
        href: "/vacation/calendar",
        match: { type: "prefix", path: "/vacation/calendar" },
        capability: "canViewVacation",
        description: "Approved vacations by month",
      },
      {
        id: "onboarding-list",
        label: "Onboarding",
        href: "/onboarding",
        match: { type: "prefix", path: "/onboarding" },
        capability: "canViewOnboarding",
        description:
          "Dual-check onboarding with optional AI plan help",
      },
    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    hubHref: "/delivery",
    hubMatch: { type: "prefix", path: "/delivery" },
    items: [
      {
        id: "delivery-hub",
        label: "Road map",
        href: "/delivery",
        match: { type: "exact", path: "/delivery" },
        capability: "canViewInitiatives",
        description: "Idea → product with Go / No go at each step",
      },
      {
        id: "initiatives-all",
        label: "Initiatives",
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
        label: "New initiative",
        href: "/initiatives/new",
        match: { type: "exact", path: "/initiatives/new" },
        capability: "canCreateInitiative",
      },
      {
        id: "gov-approvals",
        label: "Approvals",
        href: "/approvals",
        match: { type: "prefix", path: "/approvals" },
        capability: "canViewApprovals",
        description: "Vacation and delivery reviews waiting for you",
      },
      {
        id: "gov-decisions",
        label: "Decisions",
        href: "/decisions",
        match: { type: "prefix", path: "/decisions" },
        capability: "canViewDecisions",
      },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    hubHref: "/portfolio/capacity",
    hubMatch: {
      type: "prefixExclude",
      path: "/portfolio",
      excludePrefixes: [],
    },
    items: [
      {
        id: "portfolio-capacity",
        label: "Capacity & workload",
        href: "/portfolio/capacity",
        match: { type: "prefix", path: "/portfolio/capacity" },
        capability: "always",
        description: "People load and allocations",
      },
      {
        id: "portfolio-health",
        label: "Dependencies & health",
        href: "/portfolio/health",
        match: { type: "prefix", path: "/portfolio/health" },
        capability: "always",
        description: "Cross-functional blockers and risk",
      },
      {
        id: "portfolio-overview",
        label: "Portfolio overview",
        href: "/portfolio",
        match: {
          type: "prefixExclude",
          path: "/portfolio",
          excludePrefixes: [
            "/portfolio/explorer",
            "/portfolio/health",
            "/portfolio/capacity",
            "/portfolio/reports",
          ],
        },
        capability: "always",
      },
      {
        id: "portfolio-explorer",
        label: "Find work",
        href: "/portfolio/explorer",
        match: { type: "prefix", path: "/portfolio/explorer" },
        capability: "always",
      },
      {
        id: "pi-list",
        label: "PI Planning",
        href: "/pi",
        match: {
          type: "prefixExclude",
          path: "/pi",
          excludePrefixes: ["/pi/new"],
        },
        capability: "canViewPi",
      },
      {
        id: "pi-create",
        label: "New PI",
        href: "/pi/new",
        match: { type: "exact", path: "/pi/new" },
        capability: "canCreatePi",
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
      excludeSegments: ["access", "governance-policy", "admin"],
    },
    items: [
      {
        id: "org-hub",
        label: "Structure",
        href: "/organization",
        match: {
          type: "prefixExclude",
          path: "/organization",
          excludePrefixes: ["/organization/setup"],
          excludeSegments: ["access", "governance-policy", "admin"],
        },
        capability: "always",
        description: "Browse or configure org hierarchy",
      },
      {
        id: "org-access",
        label: "Access",
        href: (ctx) =>
          ctx.organizationId
            ? `/organization/${ctx.organizationId}/access`
            : null,
        match: { type: "includesSegment", segment: "access" },
        capability: "canManageAccess",
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
    id: "admin",
    label: "Admin",
    hubHref: "/admin",
    hubMatch: { type: "includesSegment", segment: "admin" },
    items: [
      {
        id: "admin-config",
        label: "Admin config",
        href: (ctx) =>
          ctx.organizationId
            ? `/organization/${ctx.organizationId}/admin`
            : "/admin",
        match: { type: "includesSegment", segment: "admin" },
        capability: "canManageAdminConfig",
        description:
          "Confirm users, roles, departments, and hierarchy in one place",
      },
    ],
  },
  {
    id: "help",
    label: "Help",
    hubHref: "/guide",
    hubMatch: { type: "prefix", path: "/guide" },
    items: [
      {
        id: "user-guide",
        label: "User guide",
        href: "/guide",
        match: { type: "prefix", path: "/guide" },
        capability: "always",
        description: "How to use the platform step by step",
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
      for (const prefix of match.excludePrefixes ?? []) {
        const excluded = normalizePath(prefix);
        if (path === excluded || path.startsWith(`${excluded}/`)) return false;
      }
      for (const segment of match.excludeSegments ?? []) {
        if (path.split("/").includes(segment)) return false;
      }
      return true;
    }
    case "includesSegment":
      return path.split("/").includes(match.segment);
    default:
      return false;
  }
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
      if (item.id === "gov-approvals") {
        if (
          !capabilityAllowed("canViewApprovals", ctx.capabilities) &&
          !capabilityAllowed("canReviewVacation", ctx.capabilities)
        ) {
          continue;
        }
      } else if (!capabilityAllowed(item.capability, ctx.capabilities)) {
        continue;
      }
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

    if (group.id === "people") {
      const showPeople =
        capabilityAllowed("canViewVacation", ctx.capabilities) ||
        capabilityAllowed("canViewOnboarding", ctx.capabilities) ||
        capabilityAllowed("canReviewVacation", ctx.capabilities);
      if (!showPeople && items.length === 0) continue;
      const peopleHub =
        items.find((i) => i.id === "vacation-mine")?.href ??
        items.find((i) => i.id === "onboarding-list")?.href;
      groups.push({
        id: group.id,
        label: group.label,
        hubHref: peopleHub,
        hubActive: false,
        items,
        containsActive: items.some((i) => i.active),
      });
      continue;
    }

    if (group.id === "delivery") {
      const showHub =
        capabilityAllowed("canViewInitiatives", ctx.capabilities) ||
        capabilityAllowed("canViewApprovals", ctx.capabilities) ||
        capabilityAllowed("canReviewVacation", ctx.capabilities) ||
        capabilityAllowed("canViewDecisions", ctx.capabilities);
      if (!showHub && items.length === 0) continue;
      // Hub active for /delivery, /initiatives*, /approvals, /decisions
      const deliveryActive =
        matchNavPath(pathname, { type: "prefix", path: "/delivery" }) ||
        matchNavPath(pathname, { type: "prefix", path: "/initiatives" }) ||
        matchNavPath(pathname, { type: "prefix", path: "/approvals" }) ||
        matchNavPath(pathname, { type: "prefix", path: "/decisions" });
      groups.push({
        id: group.id,
        label: group.label,
        hubHref: capabilityAllowed("canViewInitiatives", ctx.capabilities)
          ? hubHref
          : undefined,
        hubActive: deliveryActive && matchNavPath(pathname, { type: "exact", path: "/delivery" }),
        items,
        containsActive: deliveryActive || items.some((i) => i.active),
      });
      continue;
    }

    if (group.id === "planning") {
      const showPi = capabilityAllowed("canViewPi", ctx.capabilities);
      const planningActive =
        matchNavPath(pathname, { type: "prefix", path: "/portfolio" }) ||
        matchNavPath(pathname, { type: "prefix", path: "/pi" });
      groups.push({
        id: group.id,
        label: group.label,
        hubHref,
        hubActive: matchNavPath(pathname, {
          type: "prefix",
          path: "/portfolio/capacity",
        }),
        items: showPi
          ? items
          : items.filter((i) => i.id !== "pi-list" && i.id !== "pi-create"),
        containsActive: planningActive || items.some((i) => i.active),
      });
      continue;
    }

    if (group.id === "admin") {
      const showHub = capabilityAllowed(
        "canManageAdminConfig",
        ctx.capabilities,
      );
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
  canViewVacation: true,
  canReviewVacation: false,
  canViewOnboarding: true,
  canManageOnboarding: false,
  canManageAdminConfig: false,
};
