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
