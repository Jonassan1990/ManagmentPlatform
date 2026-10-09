/**
 * M3D-B — Controlled promote of selected scenario allocations into CURRENT.
 * Promotion is not approval and does not create a PiBaseline.
 */

import type {
  ScenarioReadinessClassification,
  ScenarioReadinessIssue,
  ScenarioReadinessMetrics,
  ScenarioReadinessResult,
  ScenarioSelectionRef,
} from "./scenario-selection-types";

export type PromotionAllocationSummary = {
  allocationCount: number;
  totalCommittedHours: number;
  workItemIds: string[];
};

export type ScenarioPromotionPreview = {
  piId: string;
  piVersion: number;
  piStatus: string;
  selectedRevision: ScenarioSelectionRef | null;
  currentRevision: {
    id: string;
    key: string;
    version: number;
  } | null;
  readiness: ScenarioReadinessResult | null;
  currentAllocations: PromotionAllocationSummary;
  selectedAllocations: PromotionAllocationSummary;
  /** True when auth + selection + readiness allow promote (warnings may still need ack). */
  canPromote: boolean;
  requiresWarningAcknowledgement: boolean;
  disabledReasons: string[];
  promotionDisclaimer: "Changes the authoritative plan — does not create an approved baseline";
};

export type ScenarioPromotionResult = {
  piId: string;
  piVersion: number;
  currentRevisionId: string;
  currentRevisionVersion: number;
  sourceRevisionId: string;
  sourceRevisionVersion: number;
  previousCurrentVersion: number;
  allocationCount: number;
  totalCommittedHours: number;
  promotedAt: string;
  idempotentReplay: boolean;
  promotionDisclaimer: "Changes the authoritative plan — does not create an approved baseline";
};

export type ScenarioPromotionReadinessGate = {
  classification: ScenarioReadinessClassification;
  blockers: ScenarioReadinessIssue[];
  warnings: ScenarioReadinessIssue[];
  metrics: ScenarioReadinessMetrics | null;
};
