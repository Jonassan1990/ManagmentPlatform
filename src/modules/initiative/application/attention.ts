/**
 * Deterministic attention engine — derived only from persisted application state.
 * No AI, no demo alerts, no hardcoded initiative-specific warnings.
 */

import type {
  ApprovalRequest,
  DecisionCondition,
  DecisionRecord,
  Demand,
  GovernanceSubmission,
  Initiative,
  InitiativeStage,
  PoC,
  PoCSuccessCriterion,
  PreStudyAssessment,
  Requirement,
  Risk,
  SolutionAlternative,
} from "@prisma/client";
import {
  REQUIRED_ASSESSMENT_AREAS,
  RISK_READINESS_POLICY,
  assessmentAreaLabel,
  evaluatePreStudyReadiness,
  isDemandComplete,
} from "./readiness-policy";
import { evaluatePoCReadiness } from "@/modules/governance/application/poc-readiness-policy";

export type AttentionSeverity = "blocker" | "warning" | "info";

export type AttentionItem = {
  key: string;
  severity: AttentionSeverity;
  message: string;
  area:
    | "demand"
    | "requirements"
    | "prestudy"
    | "risk"
    | "ownership"
    | "readiness"
    | "governance"
    | "approval"
    | "decision"
    | "poc";
};

export type AttentionSnapshot = {
  initiative: Initiative;
  demand: Demand | null;
  requirements: Requirement[];
  assessments: PreStudyAssessment[];
  alternatives: SolutionAlternative[];
  risks: Risk[];
  documents: { id: string }[];
  governanceSubmissions?: GovernanceSubmission[];
  pendingApprovalRequests?: ApprovalRequest[];
  decisions?: (DecisionRecord & { conditions?: DecisionCondition[] })[];
  poc?: (PoC & { criteria?: PoCSuccessCriterion[] }) | null;
};

export function buildAttentionItems(
  snapshot: AttentionSnapshot,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { initiative, demand, requirements, assessments, alternatives, risks } =
    snapshot;

  if (!initiative.businessOwnerName?.trim()) {
    items.push({
      key: "missing-business-owner",
      severity: "blocker",
      message: "Business owner is missing",
      area: "ownership",
    });
  }
  if (!initiative.requesterName?.trim()) {
    items.push({
      key: "missing-requester",
      severity: "blocker",
      message: "Requester is missing",
      area: "ownership",
    });
  }

  if (initiative.currentStage === "DEMAND") {
    if (!isDemandComplete(demand)) {
      items.push({
        key: "demand-incomplete",
        severity: "blocker",
        message: "Demand information is incomplete",
        area: "demand",
      });
    }
  }

  if (
    initiative.currentStage === "REQUIREMENTS" ||
    initiative.currentStage === "PRE_STUDY"
  ) {
    const unresolved = requirements.filter(
      (r) => r.status === "DRAFT" || r.status === "PROPOSED",
    );
    if (unresolved.length > 0) {
      items.push({
        key: "requirements-unresolved",
        severity: "blocker",
        message: `${unresolved.length} unresolved requirement(s)`,
        area: "requirements",
      });
    }
    if (requirements.length === 0) {
      items.push({
        key: "requirements-empty",
        severity: "blocker",
        message: "No requirements have been captured",
        area: "requirements",
      });
    }
  }

  if (initiative.currentStage === "PRE_STUDY") {
    for (const area of REQUIRED_ASSESSMENT_AREAS) {
      const assessment = assessments.find((a) => a.area === area);
      if (!assessment || assessment.status !== "COMPLETE") {
        items.push({
          key: `assessment-incomplete:${area}`,
          severity: "blocker",
          message: `${assessmentAreaLabel(area)} incomplete`,
          area: "prestudy",
        });
      }
    }
    if (alternatives.length === 0) {
      items.push({
        key: "alternatives-missing",
        severity: "blocker",
        message: "No solution alternatives captured",
        area: "prestudy",
      });
    }
    if (risks.length === 0) {
      items.push({
        key: "risks-missing",
        severity:
          RISK_READINESS_POLICY.missingRisks === "blocker"
            ? "blocker"
            : "warning",
        message: "No risks recorded",
        area: "risk",
      });
    }

    const readiness = evaluatePreStudyReadiness({
      demand,
      requirements,
      assessments,
      alternatives,
      risks,
      documents: snapshot.documents as never[],
    });
    if (!readiness.ready) {
      items.push({
        key: "not-ready-for-governance",
        severity: "blocker",
        message: "Pre-study is not ready for governance review",
        area: "readiness",
      });
    }
  }

  const submissions = snapshot.governanceSubmissions ?? [];
  const activeSubmissions = submissions.filter(
    (s) =>
      s.status !== "SUPERSEDED" &&
      s.status !== "CANCELLED" &&
      s.status !== "DECISION_RECORDED",
  );

  for (const submission of activeSubmissions) {
    if (submission.status === "IN_REVIEW") {
      const pending = (snapshot.pendingApprovalRequests ?? []).filter(
        (r) => r.submissionId === submission.id && r.status === "PENDING",
      );
      if (pending.length > 0) {
        items.push({
          key: `pending-approval:${submission.id}`,
          severity: "warning",
          message: `${pending.length} approval(s) pending for governance revision ${submission.revision}`,
          area: "approval",
        });
      }
    }
    if (submission.status === "CHANGES_REQUESTED") {
      items.push({
        key: `changes-requested:${submission.id}`,
        severity: "blocker",
        message: `Governance revision ${submission.revision} has changes requested`,
        area: "governance",
      });
    }
    if (submission.status === "APPROVALS_COMPLETE") {
      items.push({
        key: `decision-required:${submission.id}`,
        severity: "blocker",
        message: `Decision required for governance revision ${submission.revision}`,
        area: "decision",
      });
    }
  }

  const decisions = snapshot.decisions ?? [];
  for (const decision of decisions) {
    const openConditions = (decision.conditions ?? []).filter(
      (c) => c.status === "OPEN" && c.requiredBeforeProgression,
    );
    if (openConditions.length > 0) {
      items.push({
        key: `open-conditions:${decision.id}`,
        severity: "blocker",
        message: `${openConditions.length} blocking decision condition(s) open`,
        area: "decision",
      });
    }
  }

  const poc = snapshot.poc ?? null;
  if (poc) {
    if (poc.status === "DRAFT") {
      items.push({
        key: "poc-draft",
        severity: "info",
        message: "PoC definition is still in draft",
        area: "poc",
      });
    }
    const criteria = poc.criteria ?? [];
    const requiredUnevaluated = criteria.filter(
      (c) => c.required && c.evaluationState === "NOT_EVALUATED",
    );
    if (
      (poc.status === "EVALUATION" || poc.status === "COMPLETED") &&
      requiredUnevaluated.length > 0
    ) {
      items.push({
        key: "poc-criteria-unevaluated",
        severity: "blocker",
        message: `${requiredUnevaluated.length} required PoC criterion(a) not evaluated`,
        area: "poc",
      });
    }
    if (
      poc.status !== "COMPLETED" &&
      (!poc.results?.trim() || !poc.findings?.trim()) &&
      (poc.status === "EVALUATION" || poc.status === "IN_PROGRESS")
    ) {
      items.push({
        key: "poc-results-incomplete",
        severity: "warning",
        message: "PoC results or findings are incomplete",
        area: "poc",
      });
    }

    const pocReadiness = evaluatePoCReadiness(poc, criteria);
    if (pocReadiness.ready && initiative.currentStage === "POC") {
      const awaitingPoCGate = submissions.some(
        (s) =>
          s.status === "APPROVALS_COMPLETE" ||
          s.status === "IN_REVIEW" ||
          s.status === "SUBMITTED" ||
          s.status === "DECISION_RECORDED",
      );
      if (!awaitingPoCGate) {
        items.push({
          key: "poc-ready-for-decision",
          severity: "info",
          message: "PoC is ready for governance decision",
          area: "poc",
        });
      }
    }
  }

  return dedupe(items);
}

function dedupe(items: AttentionItem[]): AttentionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

export function stageLabel(stage: InitiativeStage): string {
  switch (stage) {
    case "DEMAND":
      return "Demand";
    case "REQUIREMENTS":
      return "Requirements";
    case "PRE_STUDY":
      return "Pre-study";
    case "POC":
      return "PoC";
    default:
      return stage;
  }
}
