/**
 * M3D-C — Controlled approval of promoted CURRENT, then immutable baseline.
 * Approval ≠ selection ≠ promotion ≠ baseline.
 */

import type { ScenarioReadinessResult } from "./scenario-selection-types";

export type PlanApprovalStateLabel =
  | "NO_PROMOTION"
  | "PROMOTED_NOT_APPROVED"
  | "APPROVED"
  | "APPROVAL_STALE"
  | "BASELINED";

export type PlanApprovalSummary = {
  id: string;
  status: "VALID" | "INVALIDATED" | "CONSUMED";
  currentRevisionId: string;
  currentRevisionVersion: number;
  allocationFingerprint: string;
  promotedFromRevisionId: string | null;
  approvedByPrincipalId: string;
  approvedAt: string;
  readinessClassification: string;
  acknowledgeWarnings: boolean;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
  baselineId: string | null;
};

export type PlanApprovalPreview = {
  piId: string;
  piVersion: number;
  piStatus: string;
  currentRevision: { id: string; version: number } | null;
  promotedFromRevisionId: string | null;
  promotedAt: string | null;
  allocationFingerprint: string | null;
  allocationCount: number;
  committedHours: number;
  readiness: ScenarioReadinessResult | null;
  activeApproval: PlanApprovalSummary | null;
  latestApproval: PlanApprovalSummary | null;
  stateLabel: PlanApprovalStateLabel;
  stateMessage: string;
  canApprove: boolean;
  canBaseline: boolean;
  requiresWarningAcknowledgement: boolean;
  approveDisabledReasons: string[];
  baselineDisabledReasons: string[];
  disclaimerApprove: "Approve CURRENT plan — does not create an immutable baseline";
  disclaimerBaseline: "Create immutable baseline from the exact approved CURRENT state";
};

export type PlanApprovalResult = {
  approvalId: string;
  piId: string;
  piVersion: number;
  currentRevisionId: string;
  currentRevisionVersion: number;
  allocationFingerprint: string;
  approvedAt: string;
  idempotentReplay: boolean;
  disclaimer: "Approve CURRENT plan — does not create an immutable baseline";
};

export type PlanBaselineFromApprovalResult = {
  baselineId: string;
  approvalId: string;
  piId: string;
  versionNumber: number;
  currentRevisionId: string;
  currentRevisionVersion: number;
  allocationFingerprint: string;
  createdAt: string;
  idempotentReplay: boolean;
  firstBaseline: boolean;
};
