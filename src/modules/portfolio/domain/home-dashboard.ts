/**
 * M5B-A — Role-aware Home dashboard query contracts.
 *
 * Single typed response composed from existing Portfolio / Initiative / PI /
 * Governance / Organization services. No second KPI engine. No schema changes.
 */

import type { PortfolioQueryScopeApplied } from "./types";
import type { ShellNavCapabilities } from "@/modules/navigation/types";

/** How a Home section was scoped after authorization. */
export type HomeAuthorizedScope =
  | { mode: "none"; reason: string }
  | { mode: "platform"; note?: string }
  | {
      mode: "organization";
      organizationId: string;
      organizationName: string;
    }
  | {
      mode: "organizations";
      organizations: Array<{ id: string; name: string }>;
      /** Preferred org used for org-scoped manager sections. */
      preferredOrganizationId: string | null;
    }
  | {
      mode: "portfolio";
      scope: PortfolioQueryScopeApplied;
      organizationName: string;
    };

export type HomeAvailabilityState =
  | "available"
  | "empty"
  | "unavailable"
  | "forbidden"
  | "no_linked_resource"
  | "no_permission"
  | "no_organization";

export type HomeSectionAvailability = {
  state: HomeAvailabilityState;
  /**
   * Human-readable explanation. Required when state !== "available".
   * Never use "zero" language for unavailable/forbidden states.
   */
  reason?: string;
};

export type HomeDrillDownLink = {
  id: string;
  label: string;
  href: string;
};

export type HomeSectionMeta = {
  authorizedScope: HomeAuthorizedScope;
  /** Authoritative service / table family this section reads from. */
  sourceOfTruth: string;
  availability: HomeSectionAvailability;
  drillDown: HomeDrillDownLink[];
  /** ISO timestamp when underlying data was evaluated, when known. */
  asOf: string | null;
};

/** UX packaging mode — not a new ROLE_KEY. */
export type HomeDashboardMode = "manager" | "employee" | "mixed";

export type HomeRoleBindingSummary = {
  roleKey: string;
  roleName: string;
  scopeType: string;
  organizationId: string | null;
  scopeId: string | null;
};

export type HomeLinkedResourceSummary = {
  resourceId: string;
  name: string;
  organizationId: string;
  type: string;
};

export type HomeOrganizationContext = {
  id: string;
  name: string;
  /** Role keys bound in this organization (active bindings only). */
  roleKeys: string[];
};

export type HomeUserContext = HomeSectionMeta & {
  principalId: string;
  displayName: string | null;
  mode: HomeDashboardMode;
  capabilities: ShellNavCapabilities;
  organizations: HomeOrganizationContext[];
  preferredOrganizationId: string | null;
  roleBindings: HomeRoleBindingSummary[];
  linkedResource: HomeLinkedResourceSummary | null;
  /**
   * True when manager-capable RoleBindings or mutate/governance shell caps
   * are present (not inferred from display name / email / Resource title).
   */
  managerSignals: boolean;
  /** True when an ACTIVE PERSON Resource is linked via linkedPrincipalId. */
  hasLinkedResource: boolean;
};

export type HomeQuickAction = {
  id: string;
  label: string;
  href: string;
  /** Permission or capability that authorized this action. */
  authorizationBasis: string;
  primary?: boolean;
};

export type HomeAvailableActions = HomeSectionMeta & {
  actions: HomeQuickAction[];
};

/** Proven My Work relationship — never free-text owner names. */
export type HomeMyWorkAttribution =
  | {
      basis: "resource_link";
      resourceId: string;
      relationship:
        | "INITIATIVE_BUSINESS_OWNER"
        | "INITIATIVE_REQUESTER"
        | "INITIATIVE_SPONSOR"
        | "PROJECT_OWNER"
        | "WORK_ITEM_OWNER"
        | "POC_OWNER"
        | "PILOT_OWNER"
        | "RISK_OWNER"
        | "MILESTONE_OWNER"
        | "PLANNING_DEPENDENCY_OWNER";
    }
  | {
      basis: "role_permission";
      permission: string;
      relationship: "PENDING_APPROVAL" | "PENDING_DECISION";
    };

export type HomeMyWorkItem = {
  id: string;
  kind:
    | "initiative"
    | "project"
    | "work_item"
    | "poc"
    | "pilot"
    | "risk"
    | "milestone"
    | "dependency"
    | "approval"
    | "decision";
  referenceKey: string | null;
  title: string;
  status: string | null;
  href: string;
  organizationId: string | null;
  attribution: HomeMyWorkAttribution;
};

export type HomeMyWorkSection = HomeSectionMeta & {
  items: HomeMyWorkItem[];
  /** Counts by kind before UI truncation (bounded query totals). */
  totals: {
    initiatives: number;
    projects: number;
    workItems: number;
    approvals: number;
    decisions: number;
    other: number;
  };
  truncated: boolean;
};

export type HomeAttentionItem = {
  id: string;
  kind: "delivery_health" | "initiative" | "pi" | "governance";
  label: string;
  detail: string | null;
  severity: "blocker" | "warning" | "info";
  href: string;
  organizationId: string | null;
};

export type HomeNeedsAttentionSection = HomeSectionMeta & {
  items: HomeAttentionItem[];
  counts: {
    blockedOrAtRiskProjects: number | null;
    initiativesNeedingAttention: number | null;
    waitingForApproval: number | null;
    pisNeedingAttention: number | null;
  };
};

export type HomeMetricValue = {
  key: string;
  label: string;
  /** Present only when available; never coerce unavailable → 0. */
  value: number | null;
  available: boolean;
  unavailableReason?: string;
  href: string | null;
  source: string;
};

export type HomePortfolioSummarySection = HomeSectionMeta & {
  metrics: HomeMetricValue[];
};

export type HomeActiveProjectRow = {
  projectId: string;
  initiativeId: string;
  referenceKey: string;
  name: string;
  href: string;
  classification: string;
  departmentName: string;
};

export type HomeActiveProjectsSection = HomeSectionMeta & {
  /** Attention-ranked sample (bounded); not full portfolio. */
  rows: HomeActiveProjectRow[];
  activeProjectCount: number | null;
  blockedOrAtRiskCount: number | null;
};

export type HomeCurrentPiSection = HomeSectionMeta & {
  pi: {
    id: string;
    referenceKey: string;
    name: string;
    status: string;
    href: string;
  } | null;
  metrics: HomeMetricValue[];
};

export type HomeResourceCapacitySection = HomeSectionMeta & {
  piId: string | null;
  piReferenceKey: string | null;
  overloadedTeamCount: number | null;
  underutilizedTeamCount: number | null;
  conflictCount: number | null;
  totals: {
    effectiveCapacityHours: number | null;
    plannedLoadHours: number | null;
    utilization: number | null;
  } | null;
};

export type HomeDashboardWarning = {
  code: string;
  message: string;
  organizationId?: string | null;
};

export type HomeDashboardQueryInput = {
  /** Optional preferred organization; must be within the principal's authority. */
  organizationId?: string;
  /** Bound for My Work item lists (default 25). */
  myWorkLimit?: number;
  /** Bound for attention sample rows (default 5). */
  attentionLimit?: number;
};

/**
 * Single Home dashboard response. Same route for manager and employee;
 * composition switches by persona resolution — not two disconnected systems.
 */
export type HomeDashboardResponse = {
  asOf: string;
  userContext: HomeUserContext;
  availableActions: HomeAvailableActions;
  myWork: HomeMyWorkSection;
  needsAttention: HomeNeedsAttentionSection;
  portfolioSummary: HomePortfolioSummarySection;
  activeProjects: HomeActiveProjectsSection;
  currentPi: HomeCurrentPiSection;
  resourceCapacity: HomeResourceCapacitySection;
  warnings: HomeDashboardWarning[];
};
