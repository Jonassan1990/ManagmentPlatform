import { describe, expect, it } from "vitest";
import {
  evaluatePilotGovernanceReadiness,
  evaluatePilotStartReadiness,
  isAdjacentForwardPilotTransition,
  isPilotDefinitionComplete,
  PILOT_STATUS_ORDER,
} from "@/modules/governance/application/pilot-readiness-policy";

const completeDefinition = {
  objective: "Prove operational scale readiness",
  scope: "One site",
  siteOrArea: "Plant A",
  environment: "Production-like",
  supportModel: "On-call + L2",
  rollbackPlan: "Revert feature flag",
};

describe("isPilotDefinitionComplete", () => {
  it("requires operational fields and a required criterion", () => {
    expect(
      isPilotDefinitionComplete(
        { ...completeDefinition, objective: "" },
        [{ required: true }],
      ).ok,
    ).toBe(false);

    expect(
      isPilotDefinitionComplete(completeDefinition, [{ required: false }])
        .reasons,
    ).toContain("At least one required success criterion is required");

    expect(
      isPilotDefinitionComplete(completeDefinition, [{ required: true }]).ok,
    ).toBe(true);
  });
});

describe("evaluatePilotStartReadiness", () => {
  it("is not ready when status is not READY", () => {
    const result = evaluatePilotStartReadiness(
      { status: "DRAFT", ...completeDefinition },
      [{ required: true }],
    );
    expect(result.ready).toBe(false);
    expect(result.items.find((i) => i.key === "status")?.ok).toBe(false);
  });

  it("blocks when operational definition is incomplete", () => {
    const result = evaluatePilotStartReadiness(
      {
        status: "READY",
        ...completeDefinition,
        rollbackPlan: "  ",
      },
      [{ required: true }],
    );
    expect(result.ready).toBe(false);
    expect(result.items.find((i) => i.key === "definition")?.ok).toBe(false);
  });

  it("is ready when status READY and definition complete", () => {
    const result = evaluatePilotStartReadiness(
      { status: "READY", ...completeDefinition },
      [{ required: true }],
    );
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});

describe("evaluatePilotGovernanceReadiness", () => {
  it("is not ready when status is DRAFT", () => {
    const result = evaluatePilotGovernanceReadiness(
      {
        status: "DRAFT",
        results: "r",
        businessFindings: "b",
        technicalFindings: "t",
        operationalFindings: "o",
      },
      [{ required: true, evaluationState: "PASS" }],
    );
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("Pilot status"))).toBe(true);
  });

  it("blocks when a required criterion is unevaluated", () => {
    const result = evaluatePilotGovernanceReadiness(
      {
        status: "EVALUATION",
        results: "r",
        businessFindings: "b",
        technicalFindings: "t",
        operationalFindings: "o",
      },
      [
        { required: true, evaluationState: "NOT_EVALUATED" },
        { required: false, evaluationState: "NOT_EVALUATED" },
      ],
    );
    expect(result.ready).toBe(false);
    expect(result.items.find((i) => i.key === "criteria")?.ok).toBe(false);
  });

  it("blocks when results or dimensional findings are missing", () => {
    const noResults = evaluatePilotGovernanceReadiness(
      {
        status: "COMPLETED",
        results: null,
        businessFindings: "b",
        technicalFindings: "t",
        operationalFindings: "o",
      },
      [{ required: true, evaluationState: "PASS" }],
    );
    expect(noResults.items.find((i) => i.key === "results")?.ok).toBe(false);

    const noOps = evaluatePilotGovernanceReadiness(
      {
        status: "COMPLETED",
        results: "r",
        businessFindings: "b",
        technicalFindings: "t",
        operationalFindings: "  ",
      },
      [{ required: true, evaluationState: "PASS" }],
    );
    expect(noOps.items.find((i) => i.key === "operationalFindings")?.ok).toBe(
      false,
    );
  });

  it("is ready when status, criteria, results, and findings are complete", () => {
    const result = evaluatePilotGovernanceReadiness(
      {
        status: "EVALUATION",
        results: "Adoption above target",
        businessFindings: "Value confirmed",
        technicalFindings: "Stable",
        operationalFindings: "Support model held",
      },
      [
        { required: true, evaluationState: "PASS" },
        { required: true, evaluationState: "INCONCLUSIVE" },
      ],
    );
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});

describe("isAdjacentForwardPilotTransition", () => {
  it("allows only the next forward status", () => {
    for (let i = 0; i < PILOT_STATUS_ORDER.length - 1; i++) {
      expect(
        isAdjacentForwardPilotTransition(
          PILOT_STATUS_ORDER[i],
          PILOT_STATUS_ORDER[i + 1],
        ),
      ).toBe(true);
    }
    expect(isAdjacentForwardPilotTransition("DRAFT", "IN_PROGRESS")).toBe(
      false,
    );
    expect(isAdjacentForwardPilotTransition("READY", "DRAFT")).toBe(false);
    expect(isAdjacentForwardPilotTransition("COMPLETED", "EVALUATION")).toBe(
      false,
    );
  });
});
