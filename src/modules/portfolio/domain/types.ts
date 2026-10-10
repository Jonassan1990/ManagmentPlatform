/**
 * M2A Portfolio Query contracts — typed read models for later UI consumption.
 * All metrics are derived from authoritative domain tables (no Portfolio persistence).
 */

export type PortfolioMetricUnavailable = {
  available: false;
  reason: string;
};

export type PortfolioMetricAvailable<T> = {
  available: true;
  value: T;
};

export type PortfolioMetric<T> =
  | PortfolioMetricAvailable<T>
  | PortfolioMetricUnavailable;

/** How the query was scoped after authorization. */
export type PortfolioQueryScopeApplied =
  | {
      mode: "organization";
      organizationId: string;
    }
  | {
      mode: "departments";
      organizationId: string;
      departmentIds: string[];
    };

export type PortfolioQueryInput = {
  organizationId: string;
  /**
   * Optional explicit department filter.
   * Caller must have INITIATIVE_VIEW (or PROJECT_VIEW) on that department.
   * Cannot be used to expand beyond the principal's authorized departments.
   */
  departmentId?: string;
  /** Point-in-time for delayed classification (default: now). */
  asOf?: Date;
};

export type InitiativeLifecycleDistribution = {
  total: number;
  byStage: Record<
    "DEMAND" | "REQUIREMENTS" | "PRE_STUDY" | "POC" | "PILOT" | "PROJECT",
    number
  >;
  byStatus: Record<"ACTIVE" | "ON_HOLD" | "CANCELLED", number>;
};

export type ProjectStatusCounts = {
  active: number;
  onHold: number;
  completed: number;
  cancelled: number;
  /** ARCHIVED excluded from portfolio totals (historical retention). */
};

export type GovernancePendingCounts = {
  /** Submissions in SUBMITTED or IN_REVIEW (awaiting approvals). */
  waitingForApproval: number;
  /** Submissions in APPROVALS_COMPLETE (awaiting DecisionRecord). */
  waitingForDecision: number;
  /** ApprovalRequest rows with status PENDING. */
  pendingApprovalRequests: number;
};

export type ExperimentationCounts = {
  activePocs: number;
  activePilots: number;
};

export type IssuePortfolioCounts = {
  openIssues: number;
  criticalOpenIssues: number;
  activeBlockers: number;
};

export type DelayedProjectCounts = {
  delayedProjects: number;
  /**
   * Definition (M2A):
   * Project status ∈ {ACTIVE, ON_HOLD} AND (
   *   any milestone.status === MISSED
   *   OR (plannedEnd != null AND plannedEnd < asOf)
   * ).
   * COMPLETED / CANCELLED / ARCHIVED are never delayed.
   */
  definition: "milestone_missed_or_planned_end_past";
};

export type OwnershipReference = {
  resourceId: string;
  displayName: string | null;
  initiativeBusinessOwnerCount: number;
  projectOwnerCount: number;
  pocOwnerCount: number;
  pilotOwnerCount: number;
};

export type PiCapacityTeamSummary = {
  teamId: string;
  teamName: string;
  departmentId: string;
  piId: string;
  iterationId: string;
  effectiveCapacityHours: number;
  plannedLoadHours: number;
  utilization: number | null;
  band: "none" | "under" | "ok" | "near" | "overload";
};

export type PiCapacityPortfolioSummary = {
  /** Live capacity via existing capacity-policy (not baseline payloads). */
  source: "live_capacity_policy";
  piCountConsidered: number;
  teamIterationRows: number;
  overloadedTeamIterations: number;
  nearCapacityTeamIterations: number;
  teams: PiCapacityTeamSummary[];
};

export type DependencyExposureCounts = {
  openDependencies: number;
  criticalOpenDependencies: number;
};

export type PortfolioSnapshot = {
  asOf: string; // ISO
  scope: PortfolioQueryScopeApplied;
  initiatives: PortfolioMetric<InitiativeLifecycleDistribution>;
  projects: PortfolioMetric<ProjectStatusCounts>;
  governance: PortfolioMetric<GovernancePendingCounts>;
  experimentation: PortfolioMetric<ExperimentationCounts>;
  issues: PortfolioMetric<IssuePortfolioCounts>;
  delayedProjects: PortfolioMetric<DelayedProjectCounts>;
  ownership: PortfolioMetric<OwnershipReference[]>;
  dependencies: PortfolioMetric<DependencyExposureCounts>;
  piCapacity: PortfolioMetric<PiCapacityPortfolioSummary>;
};

// ---------------------------------------------------------------------------
// M2C — Portfolio Explorer contracts
// ---------------------------------------------------------------------------

export type PortfolioExplorerEntityKind = "INITIATIVE" | "PROJECT";

/** Delivery signals derived only from existing milestone/issue policies. */
export type PortfolioDeliveryFilter =
  | "DELAYED"
  | "ACTIVE_BLOCKER"
  | "CRITICAL_ISSUE";

export type PortfolioExplorerSortBy =
  | "name"
  | "updatedAt"
  | "status"
  | "targetDate";

export type PortfolioExplorerInput = {
  organizationId: string;
  departmentId?: string;
  sectionId?: string;
  /** Case-insensitive match on title/name or reference key. */
  q?: string;
  /** Default: both INITIATIVE and PROJECT. */
  entityKinds?: PortfolioExplorerEntityKind[];
  initiativeStage?:
    | "DEMAND"
    | "REQUIREMENTS"
    | "PRE_STUDY"
    | "POC"
    | "PILOT"
    | "PROJECT";
  projectStatus?: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  ownerResourceId?: string;
  /**
   * When set, only PROJECT rows that match the signal are returned
   * (initiatives are excluded — delivery is project-derived).
   */
  delivery?: PortfolioDeliveryFilter;
  /**
   * M2D-B — when set, only PROJECT rows whose M2D-A classification matches.
   * Evaluated server-side via delivery-health classifier (initiatives excluded).
   * Mutually composable with `delivery` (both must match when both set).
   */
  deliveryHealth?:
    | "BLOCKED"
    | "AT_RISK"
    | "ON_TRACK"
    | "COMPLETED"
    | "CANCELLED"
    | "UNKNOWN";
  sortBy?: PortfolioExplorerSortBy;
  sortDir?: "asc" | "desc";
  /** 1-based page index. */
  page?: number;
  /** Default 25, max 100. */
  pageSize?: number;
  asOf?: Date;
};

export type PortfolioExplorerOwner = {
  resourceId: string | null;
  displayName: string;
  source: "resource" | "legacy";
};

export type PortfolioExplorerDeliverySignals = {
  /**
   * true/false for projects; null for initiatives (not applicable).
   * Definition matches M2A delayedProjects.
   */
  delayed: boolean | null;
  activeBlocker: boolean | null;
  criticalOpenIssue: boolean | null;
  /**
   * M2D-A classification for projects; null for initiatives.
   * Set server-side — never recomputed in the browser.
   */
  health:
    | "BLOCKED"
    | "AT_RISK"
    | "ON_TRACK"
    | "COMPLETED"
    | "CANCELLED"
    | "UNKNOWN"
    | null;
};

export type PortfolioExplorerRow = {
  kind: PortfolioExplorerEntityKind;
  id: string;
  initiativeId: string;
  referenceKey: string;
  title: string;
  href: string;
  statusLabel: string;
  departmentId: string;
  departmentName: string;
  sectionId: string;
  sectionName: string;
  owner: PortfolioExplorerOwner;
  updatedAt: string;
  targetDate: string | null;
  delivery: PortfolioExplorerDeliverySignals;
};

export type PortfolioExplorerResult = {
  asOf: string;
  scope: PortfolioQueryScopeApplied;
  page: number;
  pageSize: number;
  total: number;
  sortBy: PortfolioExplorerSortBy;
  sortDir: "asc" | "desc";
  rows: PortfolioExplorerRow[];
};

// ---------------------------------------------------------------------------
// M2D-A — Delivery Health Classification contracts
// ---------------------------------------------------------------------------

/**
 * Deterministic delivery-health classifications for Projects.
 * CANCELLED is distinct from COMPLETED (never conflated with successful delivery).
 * ARCHIVED projects are out of portfolio scope and are never classified here.
 */
export type DeliveryHealthClassification =
  | "BLOCKED"
  | "AT_RISK"
  | "ON_TRACK"
  | "COMPLETED"
  | "CANCELLED"
  | "UNKNOWN";

export type DeliveryHealthReasonCode =
  | "ACTIVE_BLOCKER_ISSUE"
  | "CRITICAL_OPEN_ISSUE"
  | "MISSED_MILESTONE"
  | "OVERDUE_CRITICAL_MILESTONE"
  | "OVERDUE_PROJECT_END"
  | "CRITICAL_DEPENDENCY"
  | "INSUFFICIENT_SCHEDULE_DATA"
  | "PROJECT_COMPLETED"
  | "PROJECT_CANCELLED"
  | "SCHEDULE_EVIDENCE_PRESENT";

export type DeliveryHealthReasonSeverity =
  | "blocker"
  | "critical"
  | "warning"
  | "info";

export type DeliveryHealthReasonSourceType =
  | "PROJECT"
  | "PROJECT_ISSUE"
  | "PROJECT_MILESTONE"
  | "PLANNING_DEPENDENCY"
  | "PROJECT_CLOSURE"
  | "EVALUATION";

export type DeliveryHealthReason = {
  code: DeliveryHealthReasonCode;
  severity: DeliveryHealthReasonSeverity;
  message: string;
  sourceType: DeliveryHealthReasonSourceType;
  /** Null when the reason is evaluation-level (no single source row). */
  sourceId: string | null;
  /** ISO date or status string when applicable. */
  relevantAt: string | null;
  relevantStatus: string | null;
};

export type DeliveryHealthClosureOutcome =
  | "DELIVERED"
  | "PARTIALLY_DELIVERED"
  | "CANCELLED"
  | null;

export type DeliveryHealthEvaluation = {
  projectId: string;
  classification: DeliveryHealthClassification;
  asOf: string;
  projectStatus: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  closureOutcome: DeliveryHealthClosureOutcome;
  reasons: DeliveryHealthReason[];
  href: string;
};

export type DeliveryHealthCounts = Record<DeliveryHealthClassification, number>;

export type DeliveryHealthSummaryInput = {
  organizationId: string;
  departmentId?: string;
  sectionId?: string;
  asOf?: Date;
};

export type DeliveryHealthSummary = {
  asOf: string;
  scope: PortfolioQueryScopeApplied;
  counts: DeliveryHealthCounts;
  /**
   * Projects requiring management attention: BLOCKED + AT_RISK.
   * Does not include CANCELLED / COMPLETED / UNKNOWN / ON_TRACK.
   */
  attentionCount: number;
  totalProjects: number;
};

export type DeliveryHealthAttentionSortBy =
  | "classification"
  | "name"
  | "updatedAt"
  | "plannedEnd";

export type DeliveryHealthAttentionInput = {
  organizationId: string;
  departmentId?: string;
  sectionId?: string;
  /**
   * Default: BLOCKED and AT_RISK.
   * COMPLETED / CANCELLED / ON_TRACK / UNKNOWN may be requested explicitly.
   */
  classifications?: DeliveryHealthClassification[];
  sortBy?: DeliveryHealthAttentionSortBy;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  asOf?: Date;
};

export type DeliveryHealthAttentionRow = {
  projectId: string;
  initiativeId: string;
  referenceKey: string;
  name: string;
  href: string;
  projectStatus: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  classification: DeliveryHealthClassification;
  closureOutcome: DeliveryHealthClosureOutcome;
  departmentId: string;
  departmentName: string;
  sectionId: string;
  sectionName: string;
  /** Project owner reference (Resource FK or legacy name snapshot). */
  owner: PortfolioExplorerOwner;
  plannedEnd: string | null;
  updatedAt: string;
  reasons: DeliveryHealthReason[];
};

export type DeliveryHealthAttentionResult = {
  asOf: string;
  scope: PortfolioQueryScopeApplied;
  page: number;
  pageSize: number;
  total: number;
  sortBy: DeliveryHealthAttentionSortBy;
  sortDir: "asc" | "desc";
  classifications: DeliveryHealthClassification[];
  attentionCount: number;
  rows: DeliveryHealthAttentionRow[];
};

export type DeliveryHealthProjectInput = {
  organizationId: string;
  projectId: string;
  asOf?: Date;
};

// ---------------------------------------------------------------------------
// M2E-A — Portfolio PI & Capacity query contracts
// ---------------------------------------------------------------------------

export type PortfolioPiLifecycleBucket =
  | "ACTIVE"
  | "UPCOMING"
  | "COMPLETED"
  | "OTHER";

export type PortfolioPiStatus =
  | "DRAFT"
  | "PLANNING"
  | "REVIEW"
  | "BASELINED"
  | "ACTIVE"
  | "CLOSED";

export type PortfolioPiListInput = {
  organizationId: string;
  departmentId?: string;
  sectionId?: string;
  /** When set, only this PI (still must be authorized). */
  piId?: string;
  /** Filter by lifecycle bucket (derived). Default: all. */
  lifecycle?: PortfolioPiLifecycleBucket[];
  asOf?: Date;
  page?: number;
  pageSize?: number;
};

export type PortfolioPiListItem = {
  piId: string;
  referenceKey: string;
  name: string;
  status: PortfolioPiStatus;
  lifecycle: PortfolioPiLifecycleBucket;
  sectionId: string | null;
  startDate: string;
  endDate: string;
  href: string;
  hasCurrentRevision: boolean;
  baselineCount: number;
  latestBaselineVersion: number | null;
};

export type PortfolioPiListResult = {
  asOf: string;
  scope: PortfolioQueryScopeApplied;
  page: number;
  pageSize: number;
  total: number;
  rows: PortfolioPiListItem[];
};

export type PortfolioPiCapacityInput = {
  organizationId: string;
  /** Required for detailed capacity; without it → no PI selected. */
  piId?: string;
  departmentId?: string;
  sectionId?: string;
  asOf?: Date;
  /** Include resource-level rows (bounded). Default true when permitted. */
  includeResources?: boolean;
  /** Include project commitments. Default true. */
  includeProjectCommitments?: boolean;
  /** Include derived conflicts. Default true. */
  includeConflicts?: boolean;
  resourcePage?: number;
  resourcePageSize?: number;
};

export type PortfolioCapacityHours = {
  availableHours: number;
  committedHours: number;
  remainingHours: number;
  utilization: number | null;
  band: "none" | "under" | "ok" | "near" | "overload";
};

export type PortfolioPiCapacityMeta = {
  piId: string;
  referenceKey: string;
  name: string;
  status: PortfolioPiStatus;
  startDate: string;
  endDate: string;
  revision: {
    id: string;
    key: string;
    version: number;
    isCurrent: true;
  };
  source: "live_capacity_policy";
};

export type PortfolioPiDepartmentCapacityRow = {
  departmentId: string;
  departmentName: string;
} & PortfolioCapacityHours;

export type PortfolioPiTeamCapacityRow = {
  teamId: string;
  teamName: string;
  departmentId: string;
  iterationId: string;
  iterationName: string;
} & PortfolioCapacityHours;

/** Real WorkAllocation → Project hours for stacked commitment bars (M5E-A). */
export type PortfolioPiResourceProjectSegment = {
  projectId: string;
  initiativeId: string;
  referenceKey: string;
  name: string;
  href: string;
  committedHours: number;
};

export type PortfolioPiResourceCapacityRow = {
  resourceId: string;
  resourceName: string;
  teamId: string;
  iterationId: string;
  /** Membership allocation % — not committed project load. */
  membershipAllocationPercent: number;
  /**
   * Per-project committed hours on this resource×team×iteration from CURRENT
   * WorkAllocation rows. Empty when no project load. Not FTE / workstream %.
   */
  projectSegments: PortfolioPiResourceProjectSegment[];
} & PortfolioCapacityHours;

export type PortfolioPiProjectCommitmentRow = {
  projectId: string;
  initiativeId: string;
  referenceKey: string;
  name: string;
  href: string;
  committedHours: number;
  workItemCount: number;
  allocationCount: number;
};

export type PortfolioPiConflictRow = {
  type: string;
  severity: "INFO" | "WARNING" | "BLOCKER";
  message: string;
  subjectType: string;
  subjectId: string;
  relatedIds: string[];
};

export type PortfolioPiBaselineComparison =
  | {
      available: true;
      baselineId: string;
      versionNumber: number;
      capturedAt: string;
      revisionIdCaptured: string | null;
      /** Sum of plannedHours in immutable baseline payload. */
      baselineCommittedHours: number;
      /** Live CURRENT revision committed hours. */
      liveCommittedHours: number;
      deltaHours: number;
    }
  | {
      available: false;
      reason: string;
    };

export type PortfolioPiCapacityDataQuality = {
  /** True when ≥1 in-scope membership has null capacityHoursPerWeek and no override. */
  missingCapacityInputs: boolean;
  notes: string[];
};

export type PortfolioPiCapacityResult = {
  asOf: string;
  scope: PortfolioQueryScopeApplied;
  /**
   * Discriminated: no PI / unavailable / ready.
   * Zero hours are valid when calculation succeeds with empty load/capacity.
   */
  capacity:
    | { state: "no_pi_selected"; reason: string }
    | { state: "unavailable"; reason: string }
    | {
        state: "ready";
        meta: PortfolioPiCapacityMeta;
        totals: PortfolioCapacityHours;
        departments: PortfolioPiDepartmentCapacityRow[];
        teams: PortfolioPiTeamCapacityRow[];
        overloadedTeams: PortfolioPiTeamCapacityRow[];
        underutilizedTeams: PortfolioPiTeamCapacityRow[];
        resources: {
          page: number;
          pageSize: number;
          total: number;
          rows: PortfolioPiResourceCapacityRow[];
        };
        projectCommitments: PortfolioPiProjectCommitmentRow[];
        conflicts: PortfolioPiConflictRow[];
        baselineComparison: PortfolioPiBaselineComparison;
        dataQuality: PortfolioPiCapacityDataQuality;
      };
};
