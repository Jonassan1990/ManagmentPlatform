/**
 * M4C-A — Typed navigation model (presentation only).
 * Hiding a nav item is not authorization; assertCan remains authoritative.
 */

export type NavCapabilityKey =
  | "always"
  | "canViewApprovals"
  | "canViewDecisions"
  | "canManageGovernancePolicy"
  | "canManageAccess"
  | "canViewPi"
  | "canCreatePi"
  | "canViewInitiatives"
  | "canCreateInitiative";

export type ShellNavCapabilities = {
  canViewApprovals: boolean;
  canViewDecisions: boolean;
  canManageGovernancePolicy: boolean;
  canManageAccess: boolean;
  canViewPi: boolean;
  canCreatePi: boolean;
  canViewInitiatives: boolean;
  canCreateInitiative: boolean;
};

export type NavMatch =
  | { type: "exact"; path: string }
  | { type: "prefix"; path: string }
  | {
      type: "prefixExclude";
      path: string;
      excludePrefixes?: string[];
      /** Path segments that disqualify a match (e.g. "access"). */
      excludeSegments?: string[];
    }
  | { type: "includesSegment"; segment: string };

export type NavItemDefinition = {
  id: string;
  label: string;
  /** Static href, or resolver using shell context (org-scoped links). */
  href: string | ((ctx: NavResolveContext) => string | null);
  match: NavMatch;
  capability: NavCapabilityKey;
  /** Optional short description for hub cards / docs. */
  description?: string;
};

export type NavGroupDefinition = {
  id: string;
  label: string;
  /** When set, the group header itself is a link (hub). */
  hubHref?: string;
  hubMatch?: NavMatch;
  items: NavItemDefinition[];
};

export type NavResolveContext = {
  capabilities: ShellNavCapabilities;
  /** Preferred organization for org-scoped destinations. */
  organizationId: string | null;
  /** PI id from the current path when under /pi/[piId]/… */
  activePiId: string | null;
};

export type ResolvedNavItem = {
  id: string;
  label: string;
  href: string;
  active: boolean;
  description?: string;
};

export type ResolvedNavGroup = {
  id: string;
  label: string;
  hubHref?: string;
  hubActive: boolean;
  items: ResolvedNavItem[];
  /** True when any child (or hub) is active — UI should expand. */
  containsActive: boolean;
};
