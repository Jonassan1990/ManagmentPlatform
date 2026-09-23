import { describe, expect, it } from "vitest";
import {
  evaluatePoCReadiness,
  isAdjacentForwardPoCTransition,
  isPoCDefinitionComplete,
  POC_STATUS_ORDER,
} from "@/modules/governance/application/poc-readiness-policy";

describe("evaluatePoCReadiness", () => {
  it("is not ready when status is DRAFT", () => {
    const result = evaluatePoCReadiness(
      { status: "DRAFT", results: "r", findings: "f" },
      [{ required: true, evaluationState: "PASS" }],
    );
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("PoC status"))).toBe(true);
  });

  it("blocks when a required criterion is unevaluated", () => {
    const result = evaluatePoCReadiness(
      { status: "EVALUATION", results: "r", findings: "f" },
      [
        { required: true, evaluationState: "NOT_EVALUATED" },
        { required: false, evaluationState: "NOT_EVALUATED" },
      ],
    );
    expect(result.ready).toBe(false);
    expect(result.items.find((i) => i.key === "criteria")?.ok).toBe(false);
  });

  it("blocks when results or findings are missing", () => {
    const noResults = evaluatePoCReadiness(
      { status: "COMPLETED", results: null, findings: "f" },
      [{ required: true, evaluationState: "PASS" }],
    );
    expect(noResults.ready).toBe(false);
    expect(noResults.items.find((i) => i.key === "results")?.ok).toBe(false);

    const noFindings = evaluatePoCReadiness(
      { status: "COMPLETED", results: "r", findings: "  " },
      [{ required: true, evaluationState: "PASS" }],
    );
    expect(noFindings.ready).toBe(false);
    expect(noFindings.items.find((i) => i.key === "findings")?.ok).toBe(false);
  });

  it("is ready when status, criteria, results, and findings are complete", () => {
    const result = evaluatePoCReadiness(
      { status: "EVALUATION", results: "Observed gain", findings: "Hypothesis held" },
      [
        { required: true, evaluationState: "PASS" },
        { required: true, evaluationState: "INCONCLUSIVE" },
      ],
    );
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("requires at least one required criterion", () => {
    const result = evaluatePoCReadiness(
      { status: "COMPLETED", results: "r", findings: "f" },
      [{ required: false, evaluationState: "PASS" }],
    );
    expect(result.ready).toBe(false);
  });
});

describe("isPoCDefinitionComplete", () => {
  it("requires objective, hypothesis, scope, and a required criterion", () => {
    expect(
      isPoCDefinitionComplete(
        { objective: "", hypothesis: "h", scope: "s" },
        [{ required: true }],
      ).ok,
    ).toBe(false);

    expect(
      isPoCDefinitionComplete(
        { objective: "o", hypothesis: "h", scope: "s" },
        [{ required: false }],
      ).reasons,
    ).toContain("At least one required success criterion is required");

    expect(
      isPoCDefinitionComplete(
        { objective: "o", hypothesis: "h", scope: "s" },
        [{ required: true }],
      ).ok,
    ).toBe(true);
  });
});

describe("isAdjacentForwardPoCTransition", () => {
  it("allows only the next forward status", () => {
    for (let i = 0; i < POC_STATUS_ORDER.length - 1; i++) {
      expect(
        isAdjacentForwardPoCTransition(
          POC_STATUS_ORDER[i],
          POC_STATUS_ORDER[i + 1],
        ),
      ).toBe(true);
    }
    expect(isAdjacentForwardPoCTransition("DRAFT", "IN_PROGRESS")).toBe(false);
    expect(isAdjacentForwardPoCTransition("READY", "DRAFT")).toBe(false);
    expect(isAdjacentForwardPoCTransition("COMPLETED", "EVALUATION")).toBe(
      false,
    );
  });
});
