/**
 * PI Planning attention items — derived from PI state only (no AI).
 * Complements initiative attention; used by planning overview / board.
 */

export type PiAttentionSeverity = "blocker" | "warning" | "info";

export type PiAttentionItem = {
  key: string;
  severity: PiAttentionSeverity;
  message: string;
  area:
    | "structure"
    | "participation"
    | "allocation"
    | "capacity"
    | "dependency"
    | "baseline"
    | "status";
};

export type PiAttentionSnapshot = {
  status: string;
  iterationCount: number;
  participatingDepartmentCount: number;
  allocationCount: number;
  conflictCount: number;
  baselineCount: number;
  hasCurrentRevision: boolean;
};

export function buildPiAttentionItems(
  snapshot: PiAttentionSnapshot,
): PiAttentionItem[] {
  const items: PiAttentionItem[] = [];

  if (!snapshot.hasCurrentRevision) {
    items.push({
      key: "missing-current-revision",
      severity: "blocker",
      message: "CURRENT planning revision is missing",
      area: "structure",
    });
  }

  if (
    snapshot.status === "PLANNING" ||
    snapshot.status === "REVIEW" ||
    snapshot.status === "BASELINED" ||
    snapshot.status === "ACTIVE"
  ) {
    if (snapshot.iterationCount === 0) {
      items.push({
        key: "no-iterations",
        severity: "blocker",
        message: "No iterations defined for this PI",
        area: "structure",
      });
    }
    if (snapshot.participatingDepartmentCount === 0) {
      items.push({
        key: "no-participating-departments",
        severity: "blocker",
        message: "No participating departments",
        area: "participation",
      });
    }
  }

  if (snapshot.status === "REVIEW" && snapshot.allocationCount === 0) {
    items.push({
      key: "review-without-allocations",
      severity: "warning",
      message: "PI is in review with no allocations",
      area: "allocation",
    });
  }

  if (snapshot.conflictCount > 0) {
    items.push({
      key: "blocker-conflicts",
      severity: "blocker",
      message: `${snapshot.conflictCount} blocker planning conflict(s)`,
      area: "capacity",
    });
  }

  if (
    (snapshot.status === "BASELINED" || snapshot.status === "ACTIVE") &&
    snapshot.baselineCount === 0
  ) {
    items.push({
      key: "status-without-baseline",
      severity: "warning",
      message: "Status implies baseline but no baseline rows exist",
      area: "baseline",
    });
  }

  if (snapshot.status === "DRAFT" && snapshot.iterationCount === 0) {
    items.push({
      key: "draft-setup",
      severity: "info",
      message: "Define iterations and participating departments to begin planning",
      area: "status",
    });
  }

  return items;
}
