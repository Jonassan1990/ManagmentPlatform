import type { IssueStatus } from "@prisma/client";

/** Terminal Issue statuses — never count as active blockers. */
export const TERMINAL_ISSUE_STATUSES: readonly IssueStatus[] = [
  "RESOLVED",
  "CLOSED",
];

export function isTerminalIssueStatus(status: IssueStatus): boolean {
  return TERMINAL_ISSUE_STATUSES.includes(status);
}

/**
 * Active blocker (derived — never persisted as a separate flag):
 * isBlocker === true AND status is not RESOLVED/CLOSED.
 */
export function isActiveBlockerIssue(issue: {
  isBlocker: boolean;
  status: IssueStatus;
}): boolean {
  return issue.isBlocker && !isTerminalIssueStatus(issue.status);
}

/**
 * Allowed status transitions (simple forward lifecycle + reopen).
 *
 * OPEN → IN_PROGRESS | RESOLVED | CLOSED
 * IN_PROGRESS → RESOLVED | CLOSED | OPEN (reopen/back)
 * RESOLVED → CLOSED | OPEN | IN_PROGRESS (reopen)
 * CLOSED → OPEN | IN_PROGRESS (reopen)
 */
const ALLOWED: Record<IssueStatus, readonly IssueStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED", "OPEN"],
  RESOLVED: ["CLOSED", "OPEN", "IN_PROGRESS"],
  CLOSED: ["OPEN", "IN_PROGRESS"],
};

export function isAllowedIssueStatusTransition(
  from: IssueStatus,
  to: IssueStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function summarizeProjectIssues(
  issues: Array<{
    status: IssueStatus;
    severity: string;
    isBlocker: boolean;
  }>,
) {
  const open = issues.filter((i) => !isTerminalIssueStatus(i.status));
  return {
    openCount: open.length,
    activeBlockerCount: issues.filter(isActiveBlockerIssue).length,
    criticalOpenCount: open.filter((i) => i.severity === "CRITICAL").length,
  };
}
