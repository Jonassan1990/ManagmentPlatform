import { describe, expect, it } from "vitest";
import {
  countReasonsByCode,
  HEALTH_LABELS,
  primaryReason,
  reasonEvidenceHref,
} from "@/components/portfolio/delivery-health";
import type { DeliveryHealthReason } from "@/modules/portfolio/domain/types";

function reason(
  partial: Partial<DeliveryHealthReason> & Pick<DeliveryHealthReason, "code">,
): DeliveryHealthReason {
  return {
    severity: "info",
    message: partial.message ?? partial.code,
    sourceType: "EVALUATION",
    sourceId: null,
    relevantAt: null,
    relevantStatus: null,
    ...partial,
  };
}

describe("delivery health display helpers", () => {
  it("orders primary reason by severity then code", () => {
    const primary = primaryReason([
      reason({ code: "MISSED_MILESTONE", severity: "warning" }),
      reason({ code: "ACTIVE_BLOCKER_ISSUE", severity: "blocker" }),
      reason({ code: "CRITICAL_OPEN_ISSUE", severity: "critical" }),
    ]);
    expect(primary?.code).toBe("ACTIVE_BLOCKER_ISSUE");
  });

  it("counts blocker and critical reason codes without inventing values", () => {
    const reasons = [
      reason({ code: "ACTIVE_BLOCKER_ISSUE", severity: "blocker", sourceType: "PROJECT_ISSUE", sourceId: "a" }),
      reason({ code: "ACTIVE_BLOCKER_ISSUE", severity: "blocker", sourceType: "PROJECT_ISSUE", sourceId: "b" }),
      reason({ code: "CRITICAL_OPEN_ISSUE", severity: "critical", sourceType: "PROJECT_ISSUE", sourceId: "c" }),
    ];
    expect(countReasonsByCode(reasons, "ACTIVE_BLOCKER_ISSUE")).toBe(2);
    expect(countReasonsByCode(reasons, "CRITICAL_OPEN_ISSUE")).toBe(1);
    expect(countReasonsByCode(reasons, "OVERDUE_PROJECT_END")).toBe(0);
  });

  it("links issue/milestone sources to real project section anchors only", () => {
    const href = "/initiatives/i1/project";
    expect(
      reasonEvidenceHref(href, reason({ code: "ACTIVE_BLOCKER_ISSUE", sourceType: "PROJECT_ISSUE", sourceId: "x" })),
    ).toEqual({
      href: `${href}#issues`,
      label: "Open project issues section",
    });
    expect(
      reasonEvidenceHref(href, reason({ code: "MISSED_MILESTONE", sourceType: "PROJECT_MILESTONE", sourceId: "y" })),
    ).toEqual({
      href: `${href}#milestones`,
      label: "Open project milestones section",
    });
    expect(
      reasonEvidenceHref(href, reason({ code: "CRITICAL_DEPENDENCY", sourceType: "PLANNING_DEPENDENCY", sourceId: "z" })),
    ).toEqual({
      href,
      label: "Open project (dependency detail has no dedicated route)",
    });
  });

  it("keeps UNKNOWN label distinct from ON_TRACK", () => {
    expect(HEALTH_LABELS.UNKNOWN).not.toEqual(HEALTH_LABELS.ON_TRACK);
    expect(HEALTH_LABELS.UNKNOWN.toLowerCase()).toContain("unknown");
  });
});
