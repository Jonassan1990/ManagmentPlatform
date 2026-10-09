/**
 * M3C-A — Typed PI scenario comparison contract (read-only).
 * Metrics are derived; nothing here is persisted.
 */

import type { DerivedConflict } from "./conflict-engine";

export const SCENARIO_COMPARISON_LIMITS = {
  /** Inclusive min revisions in one compare call. */
  minRevisions: 2,
  /** Inclusive max revisions in one compare call. */
  maxRevisions: 3,
  /** Soft product guidance — not a hard DB constraint. */
  recommendedMaxScenariosPerPi: 10,
  /** Soft guidance for allocation rows loaded across all compared revisions. */
  recommendedMaxAllocationsTotal: 5000,
} as const;

export type ScenarioComparisonRevisionKind = "CURRENT" | "SCENARIO";

export type ScenarioComparisonRevisionRef = {
  id: string;
  key: string;
  label: string | null;
  status: string;
  isCurrent: boolean;
  kind: ScenarioComparisonRevisionKind;
  version: number;
  archivedAt: string | null;
  clonedFromRevisionId: string | null;
};

export type MetricScalar = {
  availableHours: number;
  committedHours: number;
  remainingHours: number;
  /** utilization = committed/available; null when available is 0 and committed is 0; Infinity serialized as null + overload flag */
  utilization: number | null;
  utilizationPercent: number | null;
  overloadedTeamCount: number;
  conflictCount: number;
  blockerConflictCount: number;
};

export type MetricDelta = {
  availableHours: number;
  committedHours: number;
  remainingHours: number;
  utilizationPercent: number | null;
  overloadedTeamCount: number;
  conflictCount: number;
  blockerConflictCount: number;
};

export type RevisionMetricColumn = {
  revisionId: string;
  metrics: MetricScalar;
  /** Delta vs reference revision (reference column has zeros). */
  deltaFromReference: MetricDelta;
};

export type TeamMetricRow = {
  teamId: string;
  teamName: string;
  departmentId: string;
  iterationId: string;
  columns: Array<{
    revisionId: string;
    availableHours: number;
    committedHours: number;
    remainingHours: number;
    utilization: number | null;
    band: string;
    overloaded: boolean;
  }>;
};

export type ProjectCommitmentRow = {
  projectId: string;
  projectReferenceKey: string;
  projectName: string;
  columns: Array<{
    revisionId: string;
    committedHours: number;
    allocationCount: number;
  }>;
  deltaFromReferenceHours: Array<{
    revisionId: string;
    deltaHours: number;
  }>;
};

export type ResourceAllocationDiffRow = {
  resourceId: string;
  resourceName: string;
  iterationId: string;
  columns: Array<{
    revisionId: string;
    committedHours: number;
    availableHours: number;
    band: string;
  }>;
};

export type WorkItemAllocationSide = {
  revisionId: string;
  allocationId: string | null;
  present: boolean;
  plannedHours: number | null;
  iterationId: string | null;
  teamId: string | null;
  resourceId: string | null;
};

export type WorkItemAllocationDiff = {
  workItemId: string;
  workItemReferenceKey: string | null;
  workItemTitle: string | null;
  projectId: string | null;
  change:
    | "unchanged"
    | "added"
    | "removed"
    | "hours_changed"
    | "placement_changed"
    | "hours_and_placement_changed";
  sides: WorkItemAllocationSide[];
};

export type ConflictDiffBucket = {
  revisionId: string;
  conflicts: DerivedConflict[];
};

export type ConflictComparison = {
  byRevision: ConflictDiffBucket[];
  /** Conflicts present on a revision but not on the reference (by type+subjectId+related key). */
  onlyOnRevision: Array<{
    revisionId: string;
    conflicts: DerivedConflict[];
  }>;
  onlyOnReference: DerivedConflict[];
};

export type ScenarioComparisonWarnings = {
  missingCapacityInputs: boolean;
  notes: string[];
};

export type ScenarioComparisonResult = {
  piId: string;
  asOf: string;
  referenceRevisionId: string;
  revisions: ScenarioComparisonRevisionRef[];
  capacityAssumptions: {
    iterationIds: string[];
    participatingTeamIds: string[];
    note: "SHARED_PI_CAPACITY_INPUTS";
    piStartDate: string;
    piEndDate: string;
  };
  totals: RevisionMetricColumn[];
  byTeam: TeamMetricRow[];
  byProject: ProjectCommitmentRow[];
  byResource: ResourceAllocationDiffRow[];
  workItemDiffs: WorkItemAllocationDiff[];
  allocationChanges: {
    added: WorkItemAllocationDiff[];
    removed: WorkItemAllocationDiff[];
    changed: WorkItemAllocationDiff[];
    unchangedCount: number;
  };
  conflicts: ConflictComparison;
  dataQuality: ScenarioComparisonWarnings;
  limits: typeof SCENARIO_COMPARISON_LIMITS;
};
