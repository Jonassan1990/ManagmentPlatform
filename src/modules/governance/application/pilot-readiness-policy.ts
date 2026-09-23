/**
 * Pilot readiness is derived — never stored as a toggled flag on Initiative/Pilot.
 *
 * Pilot ≠ PoC: operational completeness (site, environment, support, rollback)
 * matters for start readiness; governance readiness also requires evaluation
 * evidence (results + multi-dimension findings + required criteria evaluated).
 */

import type { Pilot, PilotCriterion } from "@prisma/client";

export type PilotReadinessResult = {
  ready: boolean;
  blockers: string[];
  items: { key: string; label: string; ok: boolean; detail: string }[];
};

/** Definition completeness required before DRAFT → READY. */
export function isPilotDefinitionComplete(
  pilot: Pick<
    Pilot,
    | "objective"
    | "scope"
    | "siteOrArea"
    | "environment"
    | "supportModel"
    | "rollbackPlan"
  >,
  criteria: Pick<PilotCriterion, "required">[],
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!pilot.objective?.trim()) reasons.push("Objective is required");
  if (!pilot.scope?.trim()) reasons.push("Scope is required");
  if (!pilot.siteOrArea?.trim()) reasons.push("Site or area is required");
  if (!pilot.environment?.trim()) reasons.push("Environment is required");
  if (!pilot.supportModel?.trim()) reasons.push("Support model is required");
  if (!pilot.rollbackPlan?.trim()) reasons.push("Rollback plan is required");
  if (!criteria.some((c) => c.required)) {
    reasons.push("At least one required success criterion is required");
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * READY → IN_PROGRESS (start) gate: definition complete and status READY.
 */
export function evaluatePilotStartReadiness(
  pilot: Pick<
    Pilot,
    | "status"
    | "objective"
    | "scope"
    | "siteOrArea"
    | "environment"
    | "supportModel"
    | "rollbackPlan"
  >,
  criteria: Pick<PilotCriterion, "required">[],
): PilotReadinessResult {
  const items: PilotReadinessResult["items"] = [];

  const statusOk = pilot.status === "READY";
  items.push({
    key: "status",
    label: "Pilot status",
    ok: statusOk,
    detail: statusOk
      ? "Status READY supports start"
      : `Status must be READY to start (current: ${pilot.status})`,
  });

  const definition = isPilotDefinitionComplete(pilot, criteria);
  items.push({
    key: "definition",
    label: "Operational definition",
    ok: definition.ok,
    detail: definition.ok
      ? "Operational definition complete"
      : definition.reasons.join("; "),
  });

  const blockers = items.filter((i) => !i.ok).map((i) => `${i.label}: ${i.detail}`);
  return { ready: blockers.length === 0, blockers, items };
}

/**
 * READY for Pilot gate governance when:
 * - status is EVALUATION or COMPLETED
 * - every required criterion is evaluated
 * - results + business/technical/operational findings present
 */
export function evaluatePilotGovernanceReadiness(
  pilot: Pick<
    Pilot,
    | "status"
    | "results"
    | "businessFindings"
    | "technicalFindings"
    | "operationalFindings"
  >,
  criteria: Pick<PilotCriterion, "required" | "evaluationState">[],
): PilotReadinessResult {
  const items: PilotReadinessResult["items"] = [];

  const statusOk = pilot.status === "EVALUATION" || pilot.status === "COMPLETED";
  items.push({
    key: "status",
    label: "Pilot status",
    ok: statusOk,
    detail: statusOk
      ? `Status ${pilot.status} supports decision`
      : `Status must be EVALUATION or COMPLETED (current: ${pilot.status})`,
  });

  const required = criteria.filter((c) => c.required);
  const unevaluated = required.filter((c) => c.evaluationState === "NOT_EVALUATED");
  const criteriaOk = required.length > 0 && unevaluated.length === 0;
  items.push({
    key: "criteria",
    label: "Required success criteria",
    ok: criteriaOk,
    detail:
      required.length === 0
        ? "At least one required criterion is needed"
        : unevaluated.length > 0
          ? `${unevaluated.length} required criterion(a) not evaluated`
          : "All required criteria evaluated",
  });

  const resultsOk = Boolean(pilot.results?.trim());
  items.push({
    key: "results",
    label: "Results",
    ok: resultsOk,
    detail: resultsOk ? "Results present" : "Results are required",
  });

  const businessOk = Boolean(pilot.businessFindings?.trim());
  items.push({
    key: "businessFindings",
    label: "Business findings",
    ok: businessOk,
    detail: businessOk ? "Business findings present" : "Business findings are required",
  });

  const technicalOk = Boolean(pilot.technicalFindings?.trim());
  items.push({
    key: "technicalFindings",
    label: "Technical findings",
    ok: technicalOk,
    detail: technicalOk
      ? "Technical findings present"
      : "Technical findings are required",
  });

  const operationalOk = Boolean(pilot.operationalFindings?.trim());
  items.push({
    key: "operationalFindings",
    label: "Operational findings",
    ok: operationalOk,
    detail: operationalOk
      ? "Operational findings present"
      : "Operational findings are required",
  });

  const blockers = items.filter((i) => !i.ok).map((i) => `${i.label}: ${i.detail}`);
  return { ready: blockers.length === 0, blockers, items };
}

export const PILOT_STATUS_ORDER = [
  "DRAFT",
  "READY",
  "IN_PROGRESS",
  "EVALUATION",
  "COMPLETED",
] as const;

export function isAdjacentForwardPilotTransition(
  from: (typeof PILOT_STATUS_ORDER)[number],
  to: (typeof PILOT_STATUS_ORDER)[number],
): boolean {
  const fromIdx = PILOT_STATUS_ORDER.indexOf(from);
  const toIdx = PILOT_STATUS_ORDER.indexOf(to);
  return fromIdx >= 0 && toIdx === fromIdx + 1;
}
