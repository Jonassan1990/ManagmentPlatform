/**
 * M4C-C — Home experience helpers (presentation / navigation only).
 * No new attention aggregation engine; no AuthZ grants.
 */
import type { ShellNavCapabilities } from "@/modules/navigation/types";

export type HomeQuickLink = {
  id: string;
  label: string;
  href: string;
  /** Primary filled style when true. */
  primary?: boolean;
};

export type AuthorizedPiEntryCandidate = {
  id: string;
  status: string;
  startDate: string | Date;
  referenceKey: string;
  name: string;
};

export type AuthorizedPiEntry = {
  id: string;
  status: string;
  referenceKey: string;
  name: string;
  /** Preferred deep link into the PI workspace. */
  href: string;
};

/** Entry-worthy lifecycle states (newest preferred within the same rank). */
const ENTRY_RANK: Record<string, number> = {
  ACTIVE: 0,
  REVIEW: 1,
  BASELINED: 2,
};

/**
 * Pick the latest authorized PI for entry shortcuts.
 * Prefer ACTIVE → REVIEW → BASELINED, then newer startDate.
 * Candidates must already be AuthZ-filtered by the caller.
 */
export function selectAuthorizedPiEntry(
  candidates: AuthorizedPiEntryCandidate[],
): AuthorizedPiEntry | null {
  const eligible = candidates.filter((p) => p.status in ENTRY_RANK);
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const byStatus = (ENTRY_RANK[a.status] ?? 99) - (ENTRY_RANK[b.status] ?? 99);
    if (byStatus !== 0) return byStatus;
    const aTime = new Date(a.startDate).getTime();
    const bTime = new Date(b.startDate).getTime();
    return bTime - aTime;
  });

  const pick = eligible[0]!;
  const href =
    pick.status === "REVIEW" ? `/pi/${pick.id}/review` : `/pi/${pick.id}/board`;
  return {
    id: pick.id,
    status: pick.status,
    referenceKey: pick.referenceKey,
    name: pick.name,
    href,
  };
}

/**
 * Capability-aware Home quick links. Visibility only — pages still AuthZ.
 */
export function buildHomeQuickLinks(input: {
  capabilities: ShellNavCapabilities;
  organizationId: string | null;
  piEntry?: AuthorizedPiEntry | null;
}): HomeQuickLink[] {
  const { capabilities: caps, organizationId, piEntry } = input;
  const links: HomeQuickLink[] = [
    { id: "portfolio", label: "Portfolio", href: "/portfolio" },
    { id: "explorer", label: "Explorer", href: "/portfolio/explorer" },
    { id: "health", label: "Delivery health", href: "/portfolio/health" },
    { id: "capacity", label: "PI & capacity", href: "/portfolio/capacity" },
  ];

  if (caps.canViewInitiatives) {
    links.push({
      id: "initiatives",
      label: "Initiatives",
      href: "/initiatives",
      primary: true,
    });
  }
  if (caps.canCreateInitiative) {
    links.push({
      id: "initiative-new",
      label: "Create initiative",
      href: "/initiatives/new",
    });
  }
  if (caps.canViewApprovals) {
    links.push({ id: "approvals", label: "Approvals", href: "/approvals" });
  }
  if (caps.canViewDecisions) {
    links.push({ id: "decisions", label: "Decisions", href: "/decisions" });
  }
  if (caps.canViewPi) {
    links.push({ id: "pi-list", label: "PI Planning", href: "/pi" });
    if (piEntry) {
      links.push({
        id: "pi-entry",
        label: `Open ${piEntry.referenceKey}`,
        href: piEntry.href,
        primary: !caps.canViewInitiatives,
      });
    }
    if (caps.canCreatePi) {
      links.push({ id: "pi-new", label: "Create PI", href: "/pi/new" });
    }
  }
  links.push({ id: "organization", label: "Organization", href: "/organization" });
  if (caps.canManageAccess && organizationId) {
    links.push({
      id: "access",
      label: "Access & roles",
      href: `/organization/${organizationId}/access`,
    });
  }
  if (caps.canManageGovernancePolicy && organizationId) {
    links.push({
      id: "policy",
      label: "Governance policy",
      href: `/organization/${organizationId}/governance-policy`,
    });
  }

  return links;
}

/** Footer CTAs — subset of quick links with governance emphasis when allowed. */
export function buildHomeFooterLinks(input: {
  capabilities: ShellNavCapabilities;
  organizationId: string | null;
  piEntry?: AuthorizedPiEntry | null;
}): HomeQuickLink[] {
  const quick = buildHomeQuickLinks(input);
  const order = [
    "approvals",
    "decisions",
    "policy",
    "pi-entry",
    "pi-list",
    "portfolio",
    "initiatives",
  ];
  const byId = new Map(quick.map((l) => [l.id, l]));
  const out: HomeQuickLink[] = [];
  for (const id of order) {
    const link = byId.get(id);
    if (link) out.push(link);
  }
  return out;
}
