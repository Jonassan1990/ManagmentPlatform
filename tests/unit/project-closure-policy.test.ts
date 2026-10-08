import { describe, expect, it } from "vitest";
import {
  canProceedWithClosure,
  evaluateClosureReadiness,
  isProjectClosedStatus,
  projectStatusForOutcome,
} from "@/modules/project/application/closure-policy";

describe("closure-policy", () => {
  it("maps outcomes to project status", () => {
    expect(projectStatusForOutcome("DELIVERED")).toBe("COMPLETED");
    expect(projectStatusForOutcome("PARTIALLY_DELIVERED")).toBe("COMPLETED");
    expect(projectStatusForOutcome("CANCELLED")).toBe("CANCELLED");
  });

  it("treats COMPLETED and CANCELLED as closed", () => {
    expect(isProjectClosedStatus("COMPLETED")).toBe(true);
    expect(isProjectClosedStatus("CANCELLED")).toBe(true);
    expect(isProjectClosedStatus("ACTIVE")).toBe(false);
  });

  it("blocks DELIVERED when an active blocker exists", () => {
    const readiness = evaluateClosureReadiness({
      projectStatus: "ACTIVE",
      outcome: "DELIVERED",
      milestones: [],
      workItems: [],
      issues: [
        {
          status: "OPEN",
          severity: "HIGH",
          isBlocker: true,
          title: "Blocked",
        },
      ],
    });
    expect(readiness.canClose).toBe(false);
    expect(readiness.hardBlockers.some((b) => b.code === "ACTIVE_BLOCKERS")).toBe(
      true,
    );
  });

  it("blocks DELIVERED for open CRITICAL non-blocker issues", () => {
    const readiness = evaluateClosureReadiness({
      projectStatus: "ACTIVE",
      outcome: "DELIVERED",
      milestones: [],
      workItems: [],
      issues: [
        {
          status: "OPEN",
          severity: "CRITICAL",
          isBlocker: false,
          title: "Critical",
        },
      ],
    });
    expect(readiness.canClose).toBe(false);
    expect(
      readiness.hardBlockers.some((b) => b.code === "CRITICAL_OPEN_ISSUES"),
    ).toBe(true);
  });

  it("allows PARTIALLY_DELIVERED with critical non-blocker as warning path", () => {
    const readiness = evaluateClosureReadiness({
      projectStatus: "ACTIVE",
      outcome: "PARTIALLY_DELIVERED",
      milestones: [],
      workItems: [],
      issues: [
        {
          status: "OPEN",
          severity: "CRITICAL",
          isBlocker: false,
          title: "Critical",
        },
      ],
    });
    expect(readiness.canClose).toBe(true);
    expect(readiness.warnings.some((w) => w.code === "OPEN_ISSUES")).toBe(true);
  });

  it("warns on incomplete milestones and work items", () => {
    const readiness = evaluateClosureReadiness({
      projectStatus: "ACTIVE",
      outcome: "DELIVERED",
      milestones: [{ status: "IN_PROGRESS", title: "M1" }],
      workItems: [{ status: "READY", title: "W1" }],
      issues: [],
    });
    expect(readiness.canClose).toBe(true);
    expect(
      readiness.warnings.some((w) => w.code === "INCOMPLETE_MILESTONES"),
    ).toBe(true);
    expect(
      readiness.warnings.some((w) => w.code === "INCOMPLETE_WORK_ITEMS"),
    ).toBe(true);
    expect(canProceedWithClosure(readiness, false).ok).toBe(false);
    expect(canProceedWithClosure(readiness, true).ok).toBe(true);
  });

  it("marks already closed projects as hard-blocked", () => {
    const readiness = evaluateClosureReadiness({
      projectStatus: "COMPLETED",
      outcome: "DELIVERED",
      milestones: [],
      workItems: [],
      issues: [],
    });
    expect(readiness.canClose).toBe(false);
    expect(
      readiness.hardBlockers.some((b) => b.code === "PROJECT_ALREADY_CLOSED"),
    ).toBe(true);
  });

  it("allows CANCELLED with open work when warnings acknowledged", () => {
    const readiness = evaluateClosureReadiness({
      projectStatus: "ACTIVE",
      outcome: "CANCELLED",
      milestones: [{ status: "PLANNED", title: "M1" }],
      workItems: [],
      issues: [
        {
          status: "OPEN",
          severity: "HIGH",
          isBlocker: true,
          title: "Still open blocker",
        },
      ],
    });
    // Active blockers are not hard for CANCELLED
    expect(readiness.canClose).toBe(true);
    expect(readiness.warnings.length).toBeGreaterThan(0);
    expect(canProceedWithClosure(readiness, true).ok).toBe(true);
  });
});
