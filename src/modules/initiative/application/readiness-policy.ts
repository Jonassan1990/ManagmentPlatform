/**
 * Central Pre-study readiness policy.
 *
 * Readiness = enough information/evidence to ASK for governance review.
 * This is NOT approval and MUST NOT be manually toggled on the Initiative.
 *
 * Phase 3 may replace this default with configurable governance packages.
 */

import type {
  AssessmentArea,
  AssessmentStatus,
  RequirementStatus,
  SolutionAlternative,
  PreStudyAssessment,
  Requirement,
  Risk,
  Demand,
  ManagedDocument,
} from "@prisma/client";

/**
 * Central risk readiness severity.
 *
 * missingRisks:
 *   - "warning" (default) — empty risk register does not block readiness
 *   - "blocker" — empty risk register blocks governance submission
 *
 * Keep this as the single source of truth; attention + readiness both read it.
 */
export type RiskReadinessPolicy = {
  missingRisks: "warning" | "blocker";
};

export const RISK_READINESS_POLICY: RiskReadinessPolicy = {
  missingRisks: "warning",
};

export type ReadinessItemStatus = "complete" | "incomplete" | "warning";
export type ReadinessItem = {
  key: string;
  label: string;
  status: ReadinessItemStatus;
  detail: string;
};

export type ReadinessResult = {
  ready: boolean;
  items: ReadinessItem[];
  blockers: string[];
};

/** Required assessment areas for Phase 2 default policy. */
export const REQUIRED_ASSESSMENT_AREAS: AssessmentArea[] = [
  "BUSINESS",
  "CURRENT_STATE",
  "ARCHITECTURE",
  "SECURITY",
  "INTEGRATION",
  "DATA",
  "COST",
  "RESOURCES",
  "RISK",
];

const AREA_LABELS: Record<AssessmentArea, string> = {
  BUSINESS: "Business assessment",
  CURRENT_STATE: "Current-state assessment",
  ARCHITECTURE: "Architecture assessment",
  SECURITY: "Security assessment",
  INTEGRATION: "Integration assessment",
  DATA: "Data assessment",
  COST: "Cost estimate",
  RESOURCES: "Resource estimate",
  RISK: "Risk assessment",
  OTHER: "Other assessment",
};

export function assessmentAreaLabel(area: AssessmentArea): string {
  return AREA_LABELS[area] ?? area;
}

const UNRESOLVED_REQUIREMENT_STATUSES: RequirementStatus[] = [
  "DRAFT",
  "PROPOSED",
];

export type ReadinessSnapshot = {
  demand: Demand | null;
  requirements: Requirement[];
  assessments: PreStudyAssessment[];
  alternatives: SolutionAlternative[];
  risks: Risk[];
  documents: ManagedDocument[];
};

/**
 * Pure derivation — no persistence of ready flags.
 */
export function evaluatePreStudyReadiness(
  snapshot: ReadinessSnapshot,
): ReadinessResult {
  const items: ReadinessItem[] = [];

  // Demand completeness (should already be complete to reach PRE_STUDY, but re-check)
  const demandComplete = isDemandComplete(snapshot.demand);
  items.push({
    key: "demand",
    label: "Demand",
    status: demandComplete ? "complete" : "incomplete",
    detail: demandComplete
      ? "Demand information is complete"
      : "Demand is missing required fields",
  });

  const unresolved = snapshot.requirements.filter((r) =>
    UNRESOLVED_REQUIREMENT_STATUSES.includes(r.status),
  );
  const hasAccepted = snapshot.requirements.some((r) => r.status === "ACCEPTED");
  const requirementsOk =
    snapshot.requirements.length > 0 && unresolved.length === 0 && hasAccepted;
  items.push({
    key: "requirements",
    label: "Requirements",
    status: requirementsOk ? "complete" : "incomplete",
    detail:
      snapshot.requirements.length === 0
        ? "No requirements captured"
        : unresolved.length > 0
          ? `${unresolved.length} unresolved requirement(s)`
          : !hasAccepted
            ? "At least one accepted requirement is required"
            : "Requirements baseline is acceptable",
  });

  for (const area of REQUIRED_ASSESSMENT_AREAS) {
    const assessment = snapshot.assessments.find((a) => a.area === area);
    const complete = assessment?.status === ("COMPLETE" as AssessmentStatus);
    items.push({
      key: `assessment:${area}`,
      label: assessmentAreaLabel(area),
      status: complete ? "complete" : "incomplete",
      detail: complete
        ? "Marked complete"
        : assessment
          ? `Status: ${assessment.status.replaceAll("_", " ").toLowerCase()}`
          : "Not started",
    });
  }

  const hasAlternative = snapshot.alternatives.length > 0;
  items.push({
    key: "alternatives",
    label: "Solution alternatives",
    status: hasAlternative ? "complete" : "incomplete",
    detail: hasAlternative
      ? `${snapshot.alternatives.length} alternative(s) captured`
      : "At least one solution alternative is required",
  });

  const hasOpenOrAnyRisk = snapshot.risks.length > 0;
  const riskMissingStatus: ReadinessItemStatus =
    RISK_READINESS_POLICY.missingRisks === "blocker" ? "incomplete" : "warning";
  items.push({
    key: "risks",
    label: "Risk register",
    status: hasOpenOrAnyRisk ? "complete" : riskMissingStatus,
    detail: hasOpenOrAnyRisk
      ? `${snapshot.risks.length} risk(s) recorded`
      : "No risks recorded (recommended before governance review)",
  });

  // Cost assessment also covered above; evidence docs are optional metadata in Phase 2
  const blockers = items
    .filter((i) => i.status === "incomplete")
    .map((i) => `${i.label}: ${i.detail}`);

  // Warnings do not block readiness in Phase 2 default policy
  return {
    ready: blockers.length === 0,
    items,
    blockers,
  };
}

export function isDemandComplete(demand: Demand | null): boolean {
  if (!demand) return false;
  return (
    demand.problemOpportunity.trim().length > 0 &&
    demand.reasonForRequest.trim().length > 0 &&
    demand.expectedValue.trim().length > 0 &&
    demand.affectedAreas.trim().length > 0 &&
    demand.strategicAlignment.trim().length > 0 &&
    demand.initialImpact.trim().length > 0
  );
}

export function canAdvanceFromDemand(demand: Demand | null): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!demand) {
    reasons.push("Demand record is missing");
  } else if (!isDemandComplete(demand)) {
    reasons.push("Demand required fields are incomplete");
  }
  return { ok: reasons.length === 0, reasons };
}

export function canAdvanceFromRequirements(requirements: Requirement[]): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (requirements.length === 0) {
    reasons.push("At least one requirement is required");
  }
  const unresolved = requirements.filter((r) =>
    UNRESOLVED_REQUIREMENT_STATUSES.includes(r.status),
  );
  if (unresolved.length > 0) {
    reasons.push(
      `${unresolved.length} requirement(s) still in draft/proposed status`,
    );
  }
  if (!requirements.some((r) => r.status === "ACCEPTED")) {
    reasons.push("At least one accepted requirement is required");
  }
  return { ok: reasons.length === 0, reasons };
}
