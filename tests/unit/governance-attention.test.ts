import { describe, expect, it } from "vitest";
import { buildAttentionItems } from "@/modules/initiative/application/attention";
import type {
  ApprovalRequest,
  DecisionCondition,
  DecisionRecord,
  Demand,
  GovernanceSubmission,
  Initiative,
  Pilot,
  PilotCriterion,
  PoC,
  PoCSuccessCriterion,
  Project,
  ProjectMilestone,
  Requirement,
  Risk,
} from "@prisma/client";

function initiative(
  partial: Partial<Initiative> & Pick<Initiative, "currentStage">,
): Initiative {
  return {
    id: "i1",
    organizationId: "o1",
    departmentId: "d1",
    referenceKey: "INIT-0001",
    title: "Title",
    requesterName: "Req",
    requesterContact: null,
    businessOwnerName: "Owner",
    businessOwnerContact: null,
    status: "ACTIVE",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

function demand(): Demand {
  return {
    id: "d1",
    initiativeId: "i1",
    problemOpportunity: "Problem",
    reasonForRequest: "Reason",
    expectedValue: "Value",
    affectedAreas: "Areas",
    urgency: "MEDIUM",
    strategicAlignment: "Alignment",
    initialImpact: "Impact",
    notes: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function requirement(): Requirement {
  return {
    id: "r1",
    initiativeId: "i1",
    referenceKey: "REQ-001",
    title: "T",
    description: "D",
    category: "BUSINESS",
    priority: "SHOULD",
    status: "ACCEPTED",
    ownerName: null,
    source: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function submission(
  partial: Partial<GovernanceSubmission> &
    Pick<GovernanceSubmission, "id" | "status" | "revision">,
): GovernanceSubmission {
  return {
    gateId: "g1",
    initiativeId: "i1",
    submittedByPrincipalId: "p1",
    submittedAt: new Date(),
    reviewSnapshotId: "snap1",
    version: 1,
    policyVersion: 1,
    supersededBySubmissionId: null,
    previousSubmissionId: null,
    notes: null,
    ...partial,
  };
}

function approvalRequest(
  partial: Partial<ApprovalRequest> &
    Pick<ApprovalRequest, "id" | "submissionId" | "status">,
): ApprovalRequest {
  return {
    requirementTemplateId: null,
    authorityKey: "business",
    requiredPermission: "approval.authority.business",
    label: "Business",
    assignedPrincipalId: null,
    requestedAt: new Date(),
    reviewSnapshotId: "snap1",
    version: 1,
    completedAt: null,
    ...partial,
  };
}

describe("governance attention items", () => {
  it("surfaces pending approval attention when IN_REVIEW", () => {
    const sub = submission({
      id: "sub1",
      status: "IN_REVIEW",
      revision: 1,
    });
    const items = buildAttentionItems({
      initiative: initiative({ currentStage: "PRE_STUDY" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
      governanceSubmissions: [sub],
      pendingApprovalRequests: [
        approvalRequest({
          id: "ar1",
          submissionId: "sub1",
          status: "PENDING",
        }),
        approvalRequest({
          id: "ar2",
          submissionId: "sub1",
          status: "PENDING",
        }),
      ],
    });
    const pending = items.find((i) => i.key === "pending-approval:sub1");
    expect(pending?.severity).toBe("warning");
    expect(pending?.message).toContain("2 approval");
  });

  it("surfaces changes-requested as a blocker", () => {
    const items = buildAttentionItems({
      initiative: initiative({ currentStage: "PRE_STUDY" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
      governanceSubmissions: [
        submission({
          id: "sub2",
          status: "CHANGES_REQUESTED",
          revision: 2,
        }),
      ],
    });
    expect(
      items.some(
        (i) =>
          i.key === "changes-requested:sub2" && i.severity === "blocker",
      ),
    ).toBe(true);
  });

  it("surfaces decision-required when approvals are complete", () => {
    const items = buildAttentionItems({
      initiative: initiative({ currentStage: "PRE_STUDY" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
      governanceSubmissions: [
        submission({
          id: "sub3",
          status: "APPROVALS_COMPLETE",
          revision: 1,
        }),
      ],
    });
    expect(
      items.some(
        (i) =>
          i.key === "decision-required:sub3" &&
          i.area === "decision" &&
          i.severity === "blocker",
      ),
    ).toBe(true);
  });

  it("surfaces open blocking decision conditions", () => {
    const decision = {
      id: "dec1",
      referenceKey: "DEC-001",
      gateId: "g1",
      submissionId: "sub1",
      decisionPackageId: "dp1",
      initiativeId: "i1",
      question: "Proceed?",
      optionsConsidered: [],
      recommendationText: null,
      outcome: "CONDITIONAL_GO",
      rationale: "Need more evidence",
      decisionMakerPrincipalId: "p1",
      decidedAt: new Date(),
      reviewSnapshotId: "snap1",
      evidencePackageId: "ep1",
      supersedesDecisionId: null,
      version: 1,
      conditions: [
        {
          id: "c1",
          decisionId: "dec1",
          description: "Security review",
          ownerName: null,
          dueDate: null,
          status: "OPEN",
          requiredBeforeProgression: true,
          resolvedAt: null,
          resolutionNote: null,
          version: 1,
        } satisfies DecisionCondition,
      ],
    } satisfies DecisionRecord & { conditions: DecisionCondition[] };

    const items = buildAttentionItems({
      initiative: initiative({ currentStage: "PRE_STUDY" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
      decisions: [decision],
    });
    expect(
      items.some(
        (i) =>
          i.key === "open-conditions:dec1" && i.severity === "blocker",
      ),
    ).toBe(true);
  });

  it("surfaces PoC evaluation blockers for unevaluated required criteria", () => {
    const poc = {
      id: "poc1",
      initiativeId: "i1",
      title: "PoC",
      objective: "o",
      hypothesis: "h",
      scope: "s",
      outOfScope: null,
      ownerName: null,
      plannedStart: null,
      plannedEnd: null,
      estimatedCost: null,
      resourceNotes: null,
      technicalConstraints: null,
      dependencyNotes: null,
      results: "r",
      findings: "f",
      lessonsLearned: null,
      actualCost: null,
      actualStart: null,
      actualEnd: null,
      status: "EVALUATION",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      criteria: [
        {
          id: "crit1",
          pocId: "poc1",
          description: "Latency",
          measurementMethod: "p95",
          target: "<200ms",
          unit: "ms",
          required: true,
          sortOrder: 0,
          evaluationState: "NOT_EVALUATED",
          actualResult: null,
          evidenceReference: null,
          evaluationNotes: null,
          evaluatedAt: null,
          version: 1,
        } satisfies PoCSuccessCriterion,
      ],
    } satisfies PoC & { criteria: PoCSuccessCriterion[] };

    const items = buildAttentionItems({
      initiative: initiative({ currentStage: "POC" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
      poc,
    });
    expect(
      items.some(
        (i) =>
          i.key === "poc-criteria-unevaluated" && i.severity === "blocker",
      ),
    ).toBe(true);
  });

  it("clears governance attention when submissions are decided", () => {
    const items = buildAttentionItems({
      initiative: initiative({ currentStage: "PRE_STUDY" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
      governanceSubmissions: [
        submission({
          id: "sub4",
          status: "DECISION_RECORDED",
          revision: 1,
        }),
      ],
      pendingApprovalRequests: [],
      decisions: [],
    });
    expect(items.some((i) => i.area === "approval")).toBe(false);
    expect(items.some((i) => i.key.startsWith("decision-required"))).toBe(
      false,
    );
    expect(items.some((i) => i.key.startsWith("changes-requested"))).toBe(
      false,
    );
  });

  it("surfaces Pilot evaluation blockers and ready-for-decision info", () => {
    const pilot = {
      id: "pil1",
      initiativeId: "i1",
      objective: "o",
      scope: "s",
      outOfScope: null,
      ownerName: null,
      siteOrArea: "Plant A",
      targetUsers: null,
      plannedStart: null,
      plannedEnd: null,
      actualStart: null,
      actualEnd: null,
      estimatedCost: null,
      actualCost: null,
      currencyCode: "EUR",
      resourceNotes: null,
      environment: "prod-like",
      operationalConstraints: null,
      supportModel: "L2",
      rollbackPlan: "flag off",
      results: null,
      businessFindings: null,
      technicalFindings: null,
      operationalFindings: null,
      userFeedbackSummary: null,
      lessonsLearned: null,
      status: "EVALUATION",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      criteria: [
        {
          id: "pc1",
          pilotId: "pil1",
          category: "OPERATIONAL",
          title: "Adoption",
          description: "Users adopt",
          measurementMethod: "weekly active",
          target: ">70%",
          unit: "%",
          required: true,
          sortOrder: 0,
          evaluationState: "NOT_EVALUATED",
          actualResult: null,
          evidenceReference: null,
          evaluationNotes: null,
          evaluatedAt: null,
          version: 1,
        } satisfies PilotCriterion,
      ],
    } satisfies Pilot & { criteria: PilotCriterion[] };

    const incomplete = buildAttentionItems({
      initiative: initiative({ currentStage: "PILOT" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
      pilot,
    });
    expect(
      incomplete.some(
        (i) =>
          i.key === "pilot-criteria-unevaluated" && i.severity === "blocker",
      ),
    ).toBe(true);
    expect(
      incomplete.some(
        (i) =>
          i.key === "pilot-results-incomplete" && i.severity === "warning",
      ),
    ).toBe(true);

    const readyPilot = {
      ...pilot,
      results: "Adoption 78%",
      businessFindings: "Value ok",
      technicalFindings: "Stable",
      operationalFindings: "Support ok",
      criteria: [
        { ...pilot.criteria[0], evaluationState: "PASS" as const },
      ],
    };
    const readyItems = buildAttentionItems({
      initiative: initiative({ currentStage: "PILOT" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
      pilot: readyPilot,
    });
    expect(
      readyItems.some(
        (i) =>
          i.key === "pilot-ready-for-decision" && i.severity === "info",
      ),
    ).toBe(true);
  });

  it("surfaces project missed milestones and high open risks", () => {
    const project = {
      id: "proj1",
      initiativeId: "i1",
      organizationId: "o1",
      referenceKey: "PROJ-0001",
      name: "Delivery",
      description: null,
      ownerName: null,
      departmentId: "d1",
      status: "ACTIVE",
      priority: "MEDIUM",
      plannedStart: null,
      plannedEnd: null,
      estimatedCost: null,
      approvedBudget: null,
      plannedCost: null,
      forecastCost: null,
      actualCost: null,
      currencyCode: "EUR",
      objectives: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      milestones: [
        {
          id: "m1",
          projectId: "proj1",
          referenceKey: "MS-001",
          title: "Cutover",
          description: null,
          ownerName: null,
          plannedDate: null,
          actualDate: null,
          status: "MISSED",
          criticality: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies ProjectMilestone,
      ],
    } satisfies Project & { milestones: ProjectMilestone[] };

    const risk = {
      id: "risk1",
      initiativeId: "i1",
      referenceKey: "RISK-001",
      title: "Adoption",
      description: "Users resist",
      ownerName: null,
      probability: "HIGH",
      impact: "HIGH",
      status: "OPEN",
      mitigation: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Risk;

    const items = buildAttentionItems({
      initiative: initiative({ currentStage: "PROJECT" }),
      demand: demand(),
      requirements: [requirement()],
      assessments: [],
      alternatives: [],
      risks: [risk],
      documents: [],
      project,
    });
    expect(
      items.some(
        (i) =>
          i.key === "project-missed-milestones" && i.severity === "warning",
      ),
    ).toBe(true);
    expect(
      items.some(
        (i) => i.key === "project-high-risks" && i.severity === "warning",
      ),
    ).toBe(true);
  });
});
