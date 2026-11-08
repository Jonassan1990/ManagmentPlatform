import { describe, expect, it } from "vitest";
import {
  DELIVERY_ROADMAP,
  buildDecisionTrack,
} from "@/modules/initiative/application/decision-track";

describe("buildDecisionTrack", () => {
  it("marks early stages complete when initiative is in PoC", () => {
    const steps = buildDecisionTrack({
      currentStage: "POC",
      status: "ACTIVE",
      decisions: [
        {
          outcome: "GO",
          rationale: "Ready for experiment",
          gate: { gateType: "PRE_STUDY_GATE" },
        },
      ],
      hasProject: false,
    });

    expect(steps.find((s) => s.id === "IDEA")?.verdict).toBe("GO");
    expect(steps.find((s) => s.id === "GOVERNANCE")?.verdict).toBe("GO");
    expect(steps.find((s) => s.id === "POC")?.verdict).toBe("IN_PROGRESS");
    expect(steps.find((s) => s.id === "PRODUCT")?.verdict).toBe("NOT_STARTED");
  });

  it("maps pilot STOP to no go", () => {
    const steps = buildDecisionTrack({
      currentStage: "PILOT",
      status: "CANCELLED",
      decisions: [
        {
          outcome: "STOP",
          rationale: "Not viable",
          gate: { gateType: "PILOT_GATE" },
        },
      ],
      hasProject: false,
    });
    expect(steps.find((s) => s.id === "PILOT")?.verdict).toBe("NO_GO");
  });

  it("ships a full idea-to-product roadmap for the delivery hub", () => {
    expect(DELIVERY_ROADMAP.map((s) => s.id)).toEqual([
      "IDEA",
      "REQUIREMENTS",
      "PRE_STUDY",
      "GOVERNANCE",
      "POC",
      "PILOT",
      "PROJECT",
      "ROLES_GOVERNANCE",
      "PRODUCT",
    ]);
  });
});
