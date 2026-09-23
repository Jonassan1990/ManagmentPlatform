/**
 * PoC readiness is derived — never stored as a toggled flag on Initiative/PoC.
 *
 * READY for governance decision when:
 * - status is EVALUATION or COMPLETED
 * - every required criterion is evaluated (not NOT_EVALUATED)
 * - findings and results are present
 */

import type { PoC, PoCSuccessCriterion } from "@prisma/client";

export type PoCReadinessResult = {
  ready: boolean;
  blockers: string[];
  items: { key: string; label: string; ok: boolean; detail: string }[];
};

export function evaluatePoCReadiness(
  poc: Pick<PoC, "status" | "results" | "findings">,
  criteria: Pick<PoCSuccessCriterion, "required" | "evaluationState">[],
): PoCReadinessResult {
  const items: PoCReadinessResult["items"] = [];

  const statusOk = poc.status === "EVALUATION" || poc.status === "COMPLETED";
  items.push({
    key: "status",
    label: "PoC status",
    ok: statusOk,
    detail: statusOk
      ? `Status ${poc.status} supports decision`
      : `Status must be EVALUATION or COMPLETED (current: ${poc.status})`,
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

  const resultsOk = Boolean(poc.results?.trim());
  items.push({
    key: "results",
    label: "Results",
    ok: resultsOk,
    detail: resultsOk ? "Results present" : "Results are required",
  });

  const findingsOk = Boolean(poc.findings?.trim());
  items.push({
    key: "findings",
    label: "Findings",
    ok: findingsOk,
    detail: findingsOk ? "Findings present" : "Findings are required",
  });

  const blockers = items.filter((i) => !i.ok).map((i) => `${i.label}: ${i.detail}`);
  return { ready: blockers.length === 0, blockers, items };
}

/** Definition completeness required before DRAFT → READY. */
export function isPoCDefinitionComplete(
  poc: Pick<PoC, "objective" | "hypothesis" | "scope">,
  criteria: Pick<PoCSuccessCriterion, "required">[],
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!poc.objective?.trim()) reasons.push("Objective is required");
  if (!poc.hypothesis?.trim()) reasons.push("Hypothesis is required");
  if (!poc.scope?.trim()) reasons.push("Scope is required");
  if (!criteria.some((c) => c.required)) {
    reasons.push("At least one required success criterion is required");
  }
  return { ok: reasons.length === 0, reasons };
}

export const POC_STATUS_ORDER = [
  "DRAFT",
  "READY",
  "IN_PROGRESS",
  "EVALUATION",
  "COMPLETED",
] as const;

export function isAdjacentForwardPoCTransition(
  from: (typeof POC_STATUS_ORDER)[number],
  to: (typeof POC_STATUS_ORDER)[number],
): boolean {
  const fromIdx = POC_STATUS_ORDER.indexOf(from);
  const toIdx = POC_STATUS_ORDER.indexOf(to);
  return fromIdx >= 0 && toIdx === fromIdx + 1;
}
