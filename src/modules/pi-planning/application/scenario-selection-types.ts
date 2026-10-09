/**
 * M3D-A — Scenario selection & readiness contract (read evaluation + selection writes).
 * Selection is not approval and never mutates WorkAllocation rows.
 */

import type { DerivedConflict } from "./conflict-engine";

export type ScenarioReadinessClassification =
  | "READY"
  | "READY_WITH_WARNINGS"
  | "NOT_READY"
  | "UNAVAILABLE";

export type ScenarioSelectionRef = {
  id: string;
  key: string;
  label: string | null;
  status: string;
  isCurrent: boolean;
  version: number;
  selectedAt: string | null;
  selectedByPrincipalId: string | null;
  createdAt: string;
};

export type ScenarioReadinessMetrics = {
  availableHours: number;
  committedHours: number;
  remainingHours: number;
  utilization: number | null;
  utilizationPercent: number | null;
  overloadedTeamCount: number;
  conflictCount: number;
  blockerConflictCount: number;
  warningConflictCount: number;
};

export type ScenarioReadinessIssue = {
  code: string;
  severity: "blocker" | "warning" | "info";
  message: string;
};

export type SharedInputFreshness = {
  /** ISO timestamp of the revision used as the freshness baseline (createdAt). */
  baselineAt: string;
  /**
   * Proven stale signals only — see docs/PI-SCENARIO-SELECTION-READINESS.md.
   * We do not invent historical snapshots for join tables without updatedAt.
   */
  signals: Array<{
    code: string;
    message: string;
    detectedAt: string;
  }>;
  notes: string[];
};

export type ScenarioReadinessResult = {
  piId: string;
  revision: ScenarioSelectionRef | null;
  classification: ScenarioReadinessClassification;
  metrics: ScenarioReadinessMetrics | null;
  blockers: ScenarioReadinessIssue[];
  warnings: ScenarioReadinessIssue[];
  conflicts: DerivedConflict[];
  dataQuality: {
    missingCapacityInputs: boolean;
    notes: string[];
  };
  freshness: SharedInputFreshness | null;
  evaluatedAt: string;
};

export type ScenarioSelectionState = {
  piId: string;
  piVersion: number;
  selectedRevision: ScenarioSelectionRef | null;
  /** Banner copy constant for UI. */
  selectionDisclaimer: "Selected for review — not approved";
};

export type ScenarioSelectionHistoryEntry = {
  id: string;
  actionType: string;
  actorPrincipalId: string | null;
  createdAt: string;
  payload: unknown;
};
