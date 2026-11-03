/**
 * Home experience helpers (presentation / navigation only).
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
 * Short capability-aware Home quick links.
 * Prefer a few clear starts over a long menu — deeper pages stay in the sidebar.
 */
export function buildHomeQuickLinks(input: {
  capabilities: ShellNavCapabilities;
  organizationId: string | null;
  piEntry?: AuthorizedPiEntry | null;
}): HomeQuickLink[] {
  const { capabilities: caps, organizationId, piEntry } = input;
  const orgQ = organizationId ? `?organizationId=${organizationId}` : "";
  const links: HomeQuickLink[] = [
    {
      id: "guide",
      label: "User guide",
      href: "/guide",
      primary: true,
    },
    {
      id: "organization",
      label: "Organization",
      href: "/organization",
    },
    {
      id: "portfolio",
      label: "Portfolio",
      href: organizationId ? `/portfolio${orgQ}` : "/portfolio",
    },
  ];

  if (caps.canViewInitiatives) {
    links.push({
      id: "initiatives",
      label: "Initiatives",
      href: "/initiatives",
    });
  }
  if (caps.canCreateInitiative) {
    links.push({
      id: "initiative-new",
      label: "New initiative",
      href: "/initiatives/new",
    });
  }
  if (caps.canViewPi) {
    links.push({ id: "pi-list", label: "PI Planning", href: "/pi" });
    if (piEntry) {
      links.push({
        id: "pi-entry",
        label: `Open ${piEntry.referenceKey}`,
        href: piEntry.href,
      });
    }
  }
  if (caps.canViewApprovals) {
    links.push({ id: "approvals", label: "Approvals", href: "/approvals" });
  }
  if (caps.canViewDecisions) {
    links.push({ id: "decisions", label: "Decisions", href: "/decisions" });
  }
  if (caps.canManageAccess && organizationId) {
    links.push({
      id: "access",
      label: "Access",
      href: `/organization/${organizationId}/access`,
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
    "guide",
    "approvals",
    "decisions",
    "pi-entry",
    "pi-list",
    "portfolio",
    "initiatives",
    "organization",
  ];
  const byId = new Map(quick.map((l) => [l.id, l]));
  const out: HomeQuickLink[] = [];
  for (const id of order) {
    const link = byId.get(id);
    if (link) out.push(link);
  }
  return out;
}
