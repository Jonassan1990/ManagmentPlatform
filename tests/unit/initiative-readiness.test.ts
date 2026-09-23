import { describe, expect, it } from "vitest";
import {
  canAdvanceFromDemand,
  canAdvanceFromRequirements,
  evaluatePreStudyReadiness,
  REQUIRED_ASSESSMENT_AREAS,
  RISK_READINESS_POLICY,
} from "@/modules/initiative/application/readiness-policy";
import { buildAttentionItems } from "@/modules/initiative/application/attention";
import type { Demand, Initiative, Requirement } from "@prisma/client";

function demand(partial: Partial<Demand> = {}): Demand {
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
    ...partial,
  };
}

function requirement(
  partial: Partial<Requirement> & { id: string; status: Requirement["status"] },
): Requirement {
  return {
    initiativeId: "i1",
    referenceKey: "REQ-001",
    title: "T",
    description: "D",
    category: "BUSINESS",
    priority: "SHOULD",
    ownerName: null,
    source: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("demand completion", () => {
  it("blocks incomplete demand", () => {
    const result = canAdvanceFromDemand(
      demand({ problemOpportunity: "" }),
    );
    expect(result.ok).toBe(false);
  });

  it("allows complete demand", () => {
    expect(canAdvanceFromDemand(demand()).ok).toBe(true);
  });
});

describe("requirements advancement", () => {
  it("requires accepted requirements", () => {
    const result = canAdvanceFromRequirements([
      requirement({ id: "r1", status: "DRAFT" }),
    ]);
    expect(result.ok).toBe(false);
  });

  it("allows accepted baseline", () => {
    const result = canAdvanceFromRequirements([
      requirement({ id: "r1", status: "ACCEPTED" }),
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("pre-study readiness", () => {
  it("is derived and blocked when assessments missing", () => {
    const result = evaluatePreStudyReadiness({
      demand: demand(),
      requirements: [requirement({ id: "r1", status: "ACCEPTED" })],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
    });
    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    // no ready flag storage — pure function
    expect(result.items.some((i) => i.key.startsWith("assessment:"))).toBe(
      true,
    );
  });

  it("becomes ready when required inputs complete", () => {
    const assessments = REQUIRED_ASSESSMENT_AREAS.map((area, index) => ({
      id: `a${index}`,
      preStudyId: "ps1",
      area,
      ownerName: "Owner",
      status: "COMPLETE" as const,
      summary: "s",
      findings: "f",
      conclusion: "c",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const result = evaluatePreStudyReadiness({
      demand: demand(),
      requirements: [requirement({ id: "r1", status: "ACCEPTED" })],
      assessments,
      alternatives: [
        {
          id: "alt1",
          preStudyId: "ps1",
          title: "Build",
          description: "Custom",
          benefits: null,
          drawbacks: null,
          estimatedCost: "10",
          estimatedDuration: "3m",
          riskUncertainty: null,
          notes: null,
          isRecommended: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      risks: [
        {
          id: "risk1",
          initiativeId: "i1",
          referenceKey: "RSK-001",
          title: "Risk",
          description: "Desc",
          ownerName: null,
          probability: "MEDIUM",
          impact: "MEDIUM",
          status: "OPEN",
          mitigation: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      documents: [],
    });
    expect(result.ready).toBe(true);
  });

  it("default RISK_READINESS_POLICY treats missing risks as warning, not a blocker", () => {
    expect(RISK_READINESS_POLICY.missingRisks).toBe("warning");

    const assessments = REQUIRED_ASSESSMENT_AREAS.map((area, index) => ({
      id: `a${index}`,
      preStudyId: "ps1",
      area,
      ownerName: "Owner",
      status: "COMPLETE" as const,
      summary: "s",
      findings: "f",
      conclusion: "c",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const result = evaluatePreStudyReadiness({
      demand: demand(),
      requirements: [requirement({ id: "r1", status: "ACCEPTED" })],
      assessments,
      alternatives: [
        {
          id: "alt1",
          preStudyId: "ps1",
          title: "Build",
          description: "Custom",
          benefits: null,
          drawbacks: null,
          estimatedCost: null,
          estimatedDuration: null,
          riskUncertainty: null,
          notes: null,
          isRecommended: false,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      risks: [],
      documents: [],
    });
    expect(result.ready).toBe(true);
    const riskItem = result.items.find((i) => i.key === "risks");
    expect(riskItem?.status).toBe("warning");
    expect(result.blockers.some((b) => b.includes("Risk"))).toBe(false);
  });
});

describe("attention engine", () => {
  const baseInitiative = {
    id: "i1",
    organizationId: "o1",
    departmentId: "d1",
    referenceKey: "INIT-0001",
    title: "Title",
    requesterName: "Req",
    requesterContact: null,
    businessOwnerName: "Owner",
    businessOwnerContact: null,
    currentStage: "PRE_STUDY" as const,
    status: "ACTIVE" as const,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies Initiative;

  it("surfaces incomplete assessment attention", () => {
    const items = buildAttentionItems({
      initiative: baseInitiative,
      demand: demand(),
      requirements: [requirement({ id: "r1", status: "ACCEPTED" })],
      assessments: [],
      alternatives: [],
      risks: [],
      documents: [],
    });
    expect(items.some((i) => i.key.startsWith("assessment-incomplete"))).toBe(
      true,
    );
  });

  it("clears blockers when state is complete", () => {
    const assessments = REQUIRED_ASSESSMENT_AREAS.map((area, index) => ({
      id: `a${index}`,
      preStudyId: "ps1",
      area,
      ownerName: "Owner",
      status: "COMPLETE" as const,
      summary: "s",
      findings: "f",
      conclusion: "c",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const items = buildAttentionItems({
      initiative: baseInitiative,
      demand: demand(),
      requirements: [requirement({ id: "r1", status: "ACCEPTED" })],
      assessments,
      alternatives: [
        {
          id: "alt1",
          preStudyId: "ps1",
          title: "Opt",
          description: "D",
          benefits: null,
          drawbacks: null,
          estimatedCost: null,
          estimatedDuration: null,
          riskUncertainty: null,
          notes: null,
          isRecommended: false,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      risks: [
        {
          id: "risk1",
          initiativeId: "i1",
          referenceKey: "RSK-001",
          title: "Risk",
          description: "Desc",
          ownerName: null,
          probability: "LOW",
          impact: "LOW",
          status: "OPEN",
          mitigation: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      documents: [],
    });
    expect(items.filter((i) => i.severity === "blocker")).toHaveLength(0);
  });
});
