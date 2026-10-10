import { describe, expect, it } from "vitest";
import { derivePiPlanningWorkflow } from "@/modules/pi-planning/application/pi-planning-workflow";

describe("M5D-B derivePiPlanningWorkflow", () => {
  const base = {
    piId: "pi-1",
    hasSelection: false,
    approvalState: "NO_PROMOTION" as const,
    canPromote: false,
    promoteDisabledReasons: ["No scenario selected."],
    canApprove: false,
    approveDisabledReasons: ["Current plan has not been applied from a scenario."],
    canBaseline: false,
    baselineDisabledReasons: ["No valid approval."],
    canReviewPi: true,
    canBaselinePi: true,
    readinessClassification: null,
    selectedLabel: null,
    currentRevisionVersion: 1,
    hasBaseline: false,
  };

  it("starts at Select when nothing is selected", () => {
    const view = derivePiPlanningWorkflow(base);
    expect(view.currentStageId).toBe("select");
    expect(view.primaryAction.label).toMatch(/Select/i);
    expect(view.stages.find((s) => s.id === "plan")?.status).toBe("completed");
    expect(view.stages.find((s) => s.id === "select")?.status).toBe("current");
    expect(view.lifecycleNote).toMatch(
      /Selected ≠ Applied to current plan ≠ Approved ≠ Baselined/,
    );
  });

  it("moves to Apply after selection without implying approval", () => {
    const view = derivePiPlanningWorkflow({
      ...base,
      hasSelection: true,
      selectedLabel: "Alt A",
      canPromote: true,
      promoteDisabledReasons: [],
      readinessClassification: "READY",
    });
    expect(view.currentStageId).toBe("promote");
    expect(view.primaryAction.blocked).toBe(false);
    expect(view.primaryAction.label).toMatch(/Apply/i);
    expect(view.stages.find((s) => s.id === "promote")?.label).toMatch(
      /Apply to current plan/i,
    );
    expect(view.stages.find((s) => s.id === "select")?.status).toBe(
      "completed",
    );
  });

  it("blocks promote with readiness reasons while keeping Select completed", () => {
    const view = derivePiPlanningWorkflow({
      ...base,
      hasSelection: true,
      canPromote: false,
      promoteDisabledReasons: ["Blocking conflicts remain."],
    });
    expect(view.currentStageId).toBe("promote");
    expect(view.primaryAction.blocked).toBe(true);
    expect(view.primaryAction.reasons.join(" ")).toMatch(/Blocking conflicts/);
  });

  it("treats PROMOTED_NOT_APPROVED as Approve current", () => {
    const view = derivePiPlanningWorkflow({
      ...base,
      hasSelection: false,
      approvalState: "PROMOTED_NOT_APPROVED",
      canPromote: false,
      promoteDisabledReasons: [],
      canApprove: true,
      approveDisabledReasons: [],
      currentRevisionVersion: 4,
    });
    expect(view.stages.find((s) => s.id === "promote")?.status).toBe(
      "completed",
    );
    expect(view.currentStageId).toBe("approve");
    expect(view.primaryAction.label).toMatch(/Approve current plan/i);
  });

  it("surfaces baseline permission denial clearly on Baseline stage", () => {
    const view = derivePiPlanningWorkflow({
      ...base,
      approvalState: "APPROVED",
      canApprove: false,
      approveDisabledReasons: [],
      canBaseline: true,
      baselineDisabledReasons: [],
      canBaselinePi: false,
      canReviewPi: true,
    });
    expect(view.currentStageId).toBe("baseline");
    expect(view.primaryAction.blocked).toBe(true);
    expect(view.primaryAction.label).toMatch(/baseline permission/i);
    expect(view.stages.find((s) => s.id === "baseline")?.detail).toMatch(
      /baseline permission/i,
    );
  });

  it("completes journey when BASELINED", () => {
    const view = derivePiPlanningWorkflow({
      ...base,
      approvalState: "BASELINED",
      hasBaseline: true,
      canBaseline: false,
      baselineDisabledReasons: [],
    });
    for (const id of ["plan", "compare", "select", "promote", "approve", "baseline"] as const) {
      expect(view.stages.find((s) => s.id === id)?.status).toBe("completed");
    }
    expect(view.primaryAction.label).toMatch(/baseline history/i);
    expect(view.primaryAction.blocked).toBe(false);
  });

  it("blocks select for viewers without inventing permissions", () => {
    const view = derivePiPlanningWorkflow({
      ...base,
      canReviewPi: false,
      canBaselinePi: false,
    });
    expect(view.stages.find((s) => s.id === "select")?.status).toBe("blocked");
    expect(view.primaryAction.blocked).toBe(true);
    expect(view.primaryAction.reasons.join(" ")).toMatch(/review permission/i);
  });
});
