import { describe, expect, it } from "vitest";
import {
  buildGovernanceDecisionContext,
  countGovernancePrimaryControls,
  describeGovernanceNextAction,
  describeLifecycleClarity,
  evidenceSummary,
  mapApprovalRequestBadge,
  mapDecisionOutcomeBadge,
  mapSubmissionStatusBadge,
  recommendationVsDecisionCopy,
  splitApprovalRequests,
} from "@/modules/governance/application/governance-presentation";

describe("M5C-B governance status presentation", () => {
  it("maps submission statuses for StatusBadge", () => {
    expect(mapSubmissionStatusBadge("IN_REVIEW").status).toBe("pending");
    expect(mapSubmissionStatusBadge("APPROVALS_COMPLETE").label).toMatch(
      /Approvals complete/i,
    );
    expect(mapSubmissionStatusBadge("CHANGES_REQUESTED").status).toBe(
      "at-risk",
    );
    expect(mapSubmissionStatusBadge(null).label).toMatch(/No submission/i);
  });

  it("maps decision outcomes including conditional", () => {
    expect(mapDecisionOutcomeBadge("GO").status).toBe("approved");
    expect(mapDecisionOutcomeBadge("CONDITIONAL_GO").status).toBe("pending");
    expect(mapDecisionOutcomeBadge("CONDITIONAL_SCALE").label).toMatch(
      /Conditional scale/i,
    );
    expect(mapDecisionOutcomeBadge("NO_GO").status).toBe("cancelled");
    expect(mapDecisionOutcomeBadge(null).label).toMatch(/No decision/i);
  });

  it("maps approval request badges", () => {
    expect(mapApprovalRequestBadge("PENDING").label).toMatch(/Pending/i);
    expect(mapApprovalRequestBadge("COMPLETED", "APPROVED").status).toBe(
      "approved",
    );
  });
});

describe("M5C-B decision context & next action", () => {
  it("builds decision context without inventing owner", () => {
    const ctx = buildGovernanceDecisionContext({
      referenceKey: "INI-1",
      title: "Cloud migration",
      currentStage: "PRE_STUDY",
      gateType: "PRE_STUDY_GATE",
      submissionStatus: "IN_REVIEW",
      revision: 2,
    });
    expect(ctx.blockingKind).toBe("awaiting_approvals");
    expect(ctx.decisionOwnerLabel).toBeNull();
    expect(ctx.gateTypeLabel).toMatch(/Pre study gate/i);
  });

  it("flags decision required when approvals complete", () => {
    const ctx = buildGovernanceDecisionContext({
      referenceKey: "INI-1",
      title: "Cloud migration",
      currentStage: "PRE_STUDY",
      submissionStatus: "APPROVALS_COMPLETE",
    });
    expect(ctx.blockingKind).toBe("decision_required");
  });

  it("describes next action for pending approvals", () => {
    const action = describeGovernanceNextAction({
      initiativeId: "i1",
      currentStage: "PRE_STUDY",
      canSubmitFresh: false,
      preStudyReady: true,
      changesRequested: false,
      submissionStatus: "IN_REVIEW",
    });
    expect(action.kind).toBe("await_approvals");
    expect(action.href).toBe("/approvals");
  });

  it("describes next action for decision recording", () => {
    const action = describeGovernanceNextAction({
      initiativeId: "i1",
      currentStage: "PRE_STUDY",
      canSubmitFresh: false,
      preStudyReady: true,
      changesRequested: false,
      submissionStatus: "APPROVALS_COMPLETE",
    });
    expect(action.kind).toBe("record_decision");
    expect(action.href).toContain("/decisions");
  });
});

describe("M5C-B recommendation vs decision & lifecycle clarity", () => {
  it("keeps PoC recommendation distinct from formal decision", () => {
    const copy = recommendationVsDecisionCopy("poc");
    expect(copy.decision).toMatch(/does not auto-create/i);
    expect(copy.recommendation).toMatch(/informational/i);
  });

  it("keeps Pilot scale recommendation distinct from SCALE", () => {
    const copy = recommendationVsDecisionCopy("pilot");
    expect(copy.decision).toMatch(/explicit action/i);
  });

  it("never claims auto-create after GO/SCALE", () => {
    const clarity = describeLifecycleClarity({
      hasPoC: false,
      hasPilot: false,
      hasProject: false,
      latestOutcome: "GO",
      canCreatePoC: true,
    });
    expect(clarity.autoCreate).toMatch(/never auto-create/i);
    expect(clarity.nextAuthorized).toMatch(/create PoC \(manual\)/i);
  });

  it("surfaces conditional decision blocking message", () => {
    const clarity = describeLifecycleClarity({
      hasPoC: false,
      hasPilot: false,
      hasProject: false,
      latestOutcome: "CONDITIONAL_GO",
    });
    expect(clarity.nextAuthorized).toMatch(/Conditional decision/i);
  });
});

describe("M5C-B evidence & review helpers", () => {
  it("summarizes evidence gaps without fabricating rows", () => {
    expect(evidenceSummary([]).label).toMatch(/No evidence/i);
    expect(
      evidenceSummary([{ present: true }, { present: false }]).missing,
    ).toBe(1);
  });

  it("splits pending vs completed approvals", () => {
    const { pending, completed } = splitApprovalRequests([
      { status: "PENDING" },
      { status: "PENDING", record: { outcome: "APPROVED" } },
      { status: "COMPLETED", record: { outcome: "APPROVED" } },
    ]);
    expect(pending).toHaveLength(1);
    expect(completed).toHaveLength(2);
  });

  it("counts primary governance controls for usability metrics", () => {
    expect(
      countGovernancePrimaryControls({
        canSubmit: true,
        canRevise: false,
        canApprove: false,
        canDecide: false,
        hasNextActionLink: true,
      }),
    ).toBe(2);
  });
});
