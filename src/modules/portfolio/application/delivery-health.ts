/**
 * M2D-A — Deterministic, explainable Project delivery-health classification.
 *
 * Pure evaluation over already-loaded domain rows. No I/O, no scores, no invention.
 * Reuses Phase 1C issue-policy and Phase 1D closure status semantics.
 */

import type { IssueStatus, ProjectClosureOutcome } from "@prisma/client";
import {
  isActiveBlockerIssue,
  isTerminalIssueStatus,
} from "@/modules/project/application/issue-policy";
import type {
  DeliveryHealthClassification,
  DeliveryHealthClosureOutcome,
  DeliveryHealthEvaluation,
  DeliveryHealthReason,
} from "../domain/types";

export type HealthIssueInput = {
  id: string;
  status: IssueStatus | string;
  severity: string;
  isBlocker: boolean;
};

export type HealthMilestoneInput = {
  id: string;
  status: string;
  criticality: boolean;
  plannedDate: Date | null;
};

export type HealthDependencyInput = {
  id: string;
  status: string;
  criticality: string;
};

export type HealthProjectInput = {
  id: string;
  initiativeId: string;
  status: string;
  plannedEnd: Date | null;
  plannedStart: Date | null;
  closureOutcome: ProjectClosureOutcome | null;
  issues: HealthIssueInput[];
  milestones: HealthMilestoneInput[];
  /** Critical OPEN PlanningDependencies attributable to this project. */
  criticalOpenDependencies: HealthDependencyInput[];
};

const OPEN_MILESTONE = new Set(["PLANNED", "IN_PROGRESS", "MISSED"]);

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function reason(
  partial: Omit<DeliveryHealthReason, "relevantAt" | "relevantStatus"> & {
    relevantAt?: string | null;
    relevantStatus?: string | null;
  },
): DeliveryHealthReason {
  return {
    relevantAt: partial.relevantAt ?? null,
    relevantStatus: partial.relevantStatus ?? null,
    code: partial.code,
    severity: partial.severity,
    message: partial.message,
    sourceType: partial.sourceType,
    sourceId: partial.sourceId,
  };
}

/** True when the project has enough schedule/progress evidence to claim ON_TRACK. */
export function hasSufficientScheduleEvidence(project: HealthProjectInput): boolean {
  if (project.plannedEnd != null) return true;
  if (project.plannedStart != null) return true;
  return project.milestones.some(
    (m) =>
      m.status !== "CANCELLED" &&
      (m.plannedDate != null ||
        m.status === "IN_PROGRESS" ||
        m.status === "COMPLETED" ||
        m.status === "MISSED"),
  );
}

function isOverdueOpenMilestone(m: HealthMilestoneInput, asOf: Date): boolean {
  if (m.status === "MISSED") return true;
  if (!OPEN_MILESTONE.has(m.status)) return false;
  return m.plannedDate != null && m.plannedDate < asOf;
}

/**
 * Evaluate one Project at a single asOf instant.
 * Precedence is fixed; multiple AT_RISK reasons may co-exist.
 */
export function evaluateDeliveryHealth(
  project: HealthProjectInput,
  asOf: Date,
): DeliveryHealthEvaluation {
  const href = `/initiatives/${project.initiativeId}/project`;
  const projectStatus = project.status as DeliveryHealthEvaluation["projectStatus"];
  const closureOutcome =
    (project.closureOutcome as DeliveryHealthClosureOutcome) ?? null;

  // 1. Terminal — CANCELLED distinct from COMPLETED
  if (project.status === "CANCELLED") {
    return {
      projectId: project.id,
      classification: "CANCELLED",
      asOf: asOf.toISOString(),
      projectStatus,
      closureOutcome: closureOutcome ?? "CANCELLED",
      href,
      reasons: [
        reason({
          code: "PROJECT_CANCELLED",
          severity: "info",
          message: "Project is cancelled; not a successful completion.",
          sourceType: project.closureOutcome ? "PROJECT_CLOSURE" : "PROJECT",
          sourceId: project.id,
          relevantStatus: project.status,
        }),
      ],
    };
  }

  if (project.status === "COMPLETED") {
    return {
      projectId: project.id,
      classification: "COMPLETED",
      asOf: asOf.toISOString(),
      projectStatus,
      closureOutcome,
      href,
      reasons: [
        reason({
          code: "PROJECT_COMPLETED",
          severity: "info",
          message: closureOutcome
            ? `Project closed with outcome ${closureOutcome}.`
            : "Project status is COMPLETED.",
          sourceType: project.closureOutcome ? "PROJECT_CLOSURE" : "PROJECT",
          sourceId: project.id,
          relevantStatus: project.status,
        }),
      ],
    };
  }

  // Non-terminal path (ACTIVE / ON_HOLD). ARCHIVED is filtered before call sites.
  const reasons: DeliveryHealthReason[] = [];

  // 2. Active blockers → BLOCKED
  for (const issue of project.issues) {
    if (
      isActiveBlockerIssue({
        isBlocker: issue.isBlocker,
        status: issue.status as IssueStatus,
      })
    ) {
      reasons.push(
        reason({
          code: "ACTIVE_BLOCKER_ISSUE",
          severity: "blocker",
          message: "Active blocker issue is open on the project.",
          sourceType: "PROJECT_ISSUE",
          sourceId: issue.id,
          relevantStatus: issue.status,
        }),
      );
    }
  }

  if (reasons.some((r) => r.code === "ACTIVE_BLOCKER_ISSUE")) {
    // Still collect other adverse reasons for explainability, then classify BLOCKED.
    collectAtRiskReasons(project, asOf, reasons);
    return {
      projectId: project.id,
      classification: "BLOCKED",
      asOf: asOf.toISOString(),
      projectStatus,
      closureOutcome,
      href,
      reasons,
    };
  }

  // 3–4. AT_RISK signals
  collectAtRiskReasons(project, asOf, reasons);
  if (reasons.length > 0) {
    return {
      projectId: project.id,
      classification: "AT_RISK",
      asOf: asOf.toISOString(),
      projectStatus,
      closureOutcome,
      href,
      reasons,
    };
  }

  // 5. ON_TRACK only with sufficient evidence
  if (hasSufficientScheduleEvidence(project)) {
    return {
      projectId: project.id,
      classification: "ON_TRACK",
      asOf: asOf.toISOString(),
      projectStatus,
      closureOutcome,
      href,
      reasons: [
        reason({
          code: "SCHEDULE_EVIDENCE_PRESENT",
          severity: "info",
          message:
            "No adverse delivery signals; schedule or progress evidence is present.",
          sourceType: "EVALUATION",
          sourceId: null,
          relevantAt: iso(project.plannedEnd),
          relevantStatus: project.status,
        }),
      ],
    };
  }

  // 6. UNKNOWN
  return {
    projectId: project.id,
    classification: "UNKNOWN",
    asOf: asOf.toISOString(),
    projectStatus,
    closureOutcome,
    href,
    reasons: [
      reason({
        code: "INSUFFICIENT_SCHEDULE_DATA",
        severity: "info",
        message:
          "Insufficient schedule or progress evidence to assert ON_TRACK.",
        sourceType: "EVALUATION",
        sourceId: null,
        relevantStatus: project.status,
      }),
    ],
  };
}

function collectAtRiskReasons(
  project: HealthProjectInput,
  asOf: Date,
  reasons: DeliveryHealthReason[],
): void {
  // Critical unresolved delivery issues
  for (const issue of project.issues) {
    if (isTerminalIssueStatus(issue.status as IssueStatus)) continue;
    if (issue.severity !== "CRITICAL") continue;
    // Already represented as active blocker — still emit CRITICAL_OPEN_ISSUE
    // only when not an active blocker, to avoid duplicate framing of the same row
    // as both blocker and critical. Active blockers are already listed.
    if (
      isActiveBlockerIssue({
        isBlocker: issue.isBlocker,
        status: issue.status as IssueStatus,
      })
    ) {
      continue;
    }
    reasons.push(
      reason({
        code: "CRITICAL_OPEN_ISSUE",
        severity: "critical",
        message: "Critical severity issue remains unresolved.",
        sourceType: "PROJECT_ISSUE",
        sourceId: issue.id,
        relevantStatus: issue.status,
      }),
    );
  }

  // Overdue critical milestones vs other significant overdue milestones
  for (const m of project.milestones) {
    if (!isOverdueOpenMilestone(m, asOf)) continue;
    if (m.criticality) {
      reasons.push(
        reason({
          code: "OVERDUE_CRITICAL_MILESTONE",
          severity: "critical",
          message:
            m.status === "MISSED"
              ? "Critical milestone is marked MISSED."
              : "Critical milestone planned date is past as-of.",
          sourceType: "PROJECT_MILESTONE",
          sourceId: m.id,
          relevantAt: iso(m.plannedDate),
          relevantStatus: m.status,
        }),
      );
    } else if (m.status === "MISSED" || isOverdueOpenMilestone(m, asOf)) {
      reasons.push(
        reason({
          code: "MISSED_MILESTONE",
          severity: "warning",
          message:
            m.status === "MISSED"
              ? "Milestone is marked MISSED."
              : "Milestone planned date is past as-of.",
          sourceType: "PROJECT_MILESTONE",
          sourceId: m.id,
          relevantAt: iso(m.plannedDate),
          relevantStatus: m.status,
        }),
      );
    }
  }

  // Overdue project end
  if (project.plannedEnd != null && project.plannedEnd < asOf) {
    reasons.push(
      reason({
        code: "OVERDUE_PROJECT_END",
        severity: "warning",
        message: "Project planned end date is past as-of.",
        sourceType: "PROJECT",
        sourceId: project.id,
        relevantAt: iso(project.plannedEnd),
        relevantStatus: project.status,
      }),
    );
  }

  // Critical open dependencies (already filtered to attributable + CRITICAL + OPEN)
  for (const dep of project.criticalOpenDependencies) {
    reasons.push(
      reason({
        code: "CRITICAL_DEPENDENCY",
        severity: "critical",
        message: "Critical open planning dependency involves this project.",
        sourceType: "PLANNING_DEPENDENCY",
        sourceId: dep.id,
        relevantStatus: dep.status,
      }),
    );
  }
}

export function emptyHealthCounts(): Record<DeliveryHealthClassification, number> {
  return {
    BLOCKED: 0,
    AT_RISK: 0,
    ON_TRACK: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    UNKNOWN: 0,
  };
}

export const ATTENTION_CLASSIFICATIONS: readonly DeliveryHealthClassification[] = [
  "BLOCKED",
  "AT_RISK",
] as const;

export function classificationSortRank(
  c: DeliveryHealthClassification,
): number {
  switch (c) {
    case "BLOCKED":
      return 0;
    case "AT_RISK":
      return 1;
    case "UNKNOWN":
      return 2;
    case "ON_TRACK":
      return 3;
    case "COMPLETED":
      return 4;
    case "CANCELLED":
      return 5;
    default:
      return 99;
  }
}
