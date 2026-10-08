/**
 * Project closure readiness policy (Phase 1D / ADR-025).
 *
 * Reuses Phase 1C active-blocker semantics from issue-policy.ts.
 * Does not silently rewrite Issues / Work Items / Milestones on close.
 */

import type {
  IssueSeverity,
  IssueStatus,
  MilestoneStatus,
  ProjectClosureOutcome,
  ProjectStatus,
  WorkItemStatus,
} from "@prisma/client";
import { isActiveBlockerIssue, isTerminalIssueStatus } from "./issue-policy";

export const TERMINAL_PROJECT_STATUSES: readonly ProjectStatus[] = [
  "COMPLETED",
  "CANCELLED",
];

export function isProjectClosedStatus(status: ProjectStatus): boolean {
  return TERMINAL_PROJECT_STATUSES.includes(status);
}

/** Map closure outcome → ProjectStatus. */
export function projectStatusForOutcome(
  outcome: ProjectClosureOutcome,
): ProjectStatus {
  if (outcome === "CANCELLED") return "CANCELLED";
  return "COMPLETED";
}

export type ReadinessCheck = {
  code: string;
  level: "hard" | "warning";
  message: string;
};

export type ClosureReadiness = {
  canClose: boolean;
  hardBlockers: ReadinessCheck[];
  warnings: ReadinessCheck[];
  counts: {
    incompleteMilestones: number;
    incompleteWorkItems: number;
    openIssues: number;
    activeBlockers: number;
    criticalOpenIssues: number;
  };
};

const INCOMPLETE_MILESTONE: readonly MilestoneStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "MISSED",
];

const INCOMPLETE_WORK_ITEM: readonly WorkItemStatus[] = [
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
];

/**
 * Evaluate closure readiness for a chosen outcome.
 *
 * Hard blockers (prevent close):
 * - Project already COMPLETED / CANCELLED / ARCHIVED
 * - DELIVERED or PARTIALLY_DELIVERED: any active blocker Issue
 * - DELIVERED only: any open CRITICAL Issue that is not already counted as an active blocker
 *
 * Warnings (require acknowledgeWarnings when present):
 * - Incomplete milestones (not COMPLETED / CANCELLED)
 * - Incomplete work items (not DONE / CANCELLED)
 * - Remaining open Issues not already represented as hard blockers
 *
 * CANCELLED: open work is warning-only (cancellation may proceed with acknowledgement).
 * Unresolved work is never silently rewritten on close.
 */
export function evaluateClosureReadiness(input: {
  projectStatus: ProjectStatus;
  outcome: ProjectClosureOutcome;
  milestones: Array<{ status: MilestoneStatus; title: string }>;
  workItems: Array<{ status: WorkItemStatus; title: string }>;
  issues: Array<{
    status: IssueStatus;
    severity: IssueSeverity;
    isBlocker: boolean;
    title: string;
  }>;
}): ClosureReadiness {
  const hardBlockers: ReadinessCheck[] = [];
  const warnings: ReadinessCheck[] = [];

  if (input.projectStatus === "ARCHIVED") {
    hardBlockers.push({
      code: "PROJECT_ARCHIVED",
      level: "hard",
      message: "Archived projects cannot be closed.",
    });
  }

  if (isProjectClosedStatus(input.projectStatus)) {
    hardBlockers.push({
      code: "PROJECT_ALREADY_CLOSED",
      level: "hard",
      message: `Project is already ${input.projectStatus}.`,
    });
  }

  const incompleteMilestones = input.milestones.filter((m) =>
    INCOMPLETE_MILESTONE.includes(m.status),
  );
  const incompleteWorkItems = input.workItems.filter((w) =>
    INCOMPLETE_WORK_ITEM.includes(w.status),
  );
  const openIssues = input.issues.filter((i) => !isTerminalIssueStatus(i.status));
  const activeBlockers = input.issues.filter(isActiveBlockerIssue);
  const criticalOpenIssues = openIssues.filter((i) => i.severity === "CRITICAL");

  const deliveryLike =
    input.outcome === "DELIVERED" || input.outcome === "PARTIALLY_DELIVERED";

  if (deliveryLike && activeBlockers.length > 0) {
    hardBlockers.push({
      code: "ACTIVE_BLOCKERS",
      level: "hard",
      message: `${activeBlockers.length} active blocker issue(s) must be resolved or closed before ${input.outcome} closure.`,
    });
  }

  if (input.outcome === "DELIVERED") {
    const nonBlockerCritical = criticalOpenIssues.filter(
      (i) => !isActiveBlockerIssue(i),
    );
    // Active-blocker CRITICAL issues are already hard-blocked above.
    // Non-blocker CRITICAL opens additionally block ordinary DELIVERED.
    if (nonBlockerCritical.length > 0) {
      hardBlockers.push({
        code: "CRITICAL_OPEN_ISSUES",
        level: "hard",
        message: `${nonBlockerCritical.length} open CRITICAL issue(s) block DELIVERED closure. Use PARTIALLY_DELIVERED or resolve them.`,
      });
    } else if (
      criticalOpenIssues.length > 0 &&
      activeBlockers.length === 0
    ) {
      // All critical opens are blockers but somehow not in activeBlockers — defensive.
      hardBlockers.push({
        code: "CRITICAL_OPEN_ISSUES",
        level: "hard",
        message: `${criticalOpenIssues.length} open CRITICAL issue(s) block DELIVERED closure.`,
      });
    }
  }

  if (incompleteMilestones.length > 0) {
    warnings.push({
      code: "INCOMPLETE_MILESTONES",
      level: "warning",
      message: `${incompleteMilestones.length} milestone(s) are not completed or cancelled.`,
    });
  }

  if (incompleteWorkItems.length > 0) {
    warnings.push({
      code: "INCOMPLETE_WORK_ITEMS",
      level: "warning",
      message: `${incompleteWorkItems.length} work item(s) are not done or cancelled.`,
    });
  }

  const warningIssues = openIssues.filter((i) => {
    if (deliveryLike && isActiveBlockerIssue(i)) return false;
    if (input.outcome === "DELIVERED" && i.severity === "CRITICAL") return false;
    return true;
  });
  if (warningIssues.length > 0) {
    warnings.push({
      code: "OPEN_ISSUES",
      level: "warning",
      message: `${warningIssues.length} open issue(s) remain unresolved.`,
    });
  }

  return {
    canClose: hardBlockers.length === 0,
    hardBlockers,
    warnings,
    counts: {
      incompleteMilestones: incompleteMilestones.length,
      incompleteWorkItems: incompleteWorkItems.length,
      openIssues: openIssues.length,
      activeBlockers: activeBlockers.length,
      criticalOpenIssues: criticalOpenIssues.length,
    },
  };
}

/**
 * Whether close may proceed given readiness + optional acknowledgement.
 * Warnings require acknowledgeWarnings whenever present.
 */
export function canProceedWithClosure(
  readiness: ClosureReadiness,
  acknowledgeWarnings: boolean,
): { ok: true } | { ok: false; reason: string } {
  if (!readiness.canClose) {
    return {
      ok: false,
      reason: readiness.hardBlockers.map((b) => b.message).join(" "),
    };
  }
  if (readiness.warnings.length > 0 && !acknowledgeWarnings) {
    return {
      ok: false,
      reason:
        "Unresolved warnings require explicit acknowledgement before closing.",
    };
  }
  return { ok: true };
}
