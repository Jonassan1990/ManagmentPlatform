import { describe, expect, it } from "vitest";
import {
  buildPremiumLifecycleSteps,
  ownershipBasisLabel,
  resolveOwnershipParty,
} from "@/modules/initiative/application/initiative-journey";

describe("M5C-A ownership display", () => {
  it("prefers Resource FK name over free-text snapshot", () => {
    const party = resolveOwnershipParty({
      label: "Business owner",
      resource: { id: "r1", name: "Linked Owner" },
      resourceId: "r1",
      nameSnapshot: "Legacy Free Text",
    });
    expect(party.basis).toBe("resource_link");
    expect(party.name).toBe("Linked Owner");
    expect(ownershipBasisLabel(party.basis)).toMatch(/Linked Resource/i);
  });

  it("falls back to name snapshot when Resource missing", () => {
    const party = resolveOwnershipParty({
      label: "Business owner",
      resource: null,
      resourceId: null,
      nameSnapshot: "Snapshot Name",
    });
    expect(party.basis).toBe("name_snapshot");
    expect(party.name).toBe("Snapshot Name");
  });

  it("reports missing ownership without inventing a name", () => {
    const party = resolveOwnershipParty({
      label: "Sponsor",
      resource: null,
      resourceId: null,
      nameSnapshot: null,
    });
    expect(party.basis).toBe("missing");
    expect(party.name).toBeNull();
  });
});

describe("M5C-A premium lifecycle presentation", () => {
  it("inserts Governance between Pre-study and PoC without domain invention", () => {
    const steps = buildPremiumLifecycleSteps({ currentStage: "DEMAND" });
    expect(steps.map((s) => s.id)).toEqual([
      "DEMAND",
      "REQUIREMENTS",
      "PRE_STUDY",
      "GOVERNANCE",
      "POC",
      "PILOT",
      "PROJECT",
    ]);
    expect(steps.find((s) => s.id === "DEMAND")?.state).toBe("current");
    expect(steps.find((s) => s.id === "GOVERNANCE")?.state).toBe("upcoming");
  });

  it("marks Governance current during active Pre-study review", () => {
    const steps = buildPremiumLifecycleSteps({
      currentStage: "PRE_STUDY",
      hasActiveSubmission: true,
      submissionStatus: "IN_REVIEW",
    });
    expect(steps.find((s) => s.id === "GOVERNANCE")?.state).toBe("current");
    expect(steps.find((s) => s.id === "PRE_STUDY")?.state).toBe("completed");
    expect(steps.filter((s) => s.state === "current")).toHaveLength(1);
  });

  it("keeps Governance completed after GO even when conditions still block PoC", () => {
    const steps = buildPremiumLifecycleSteps({
      currentStage: "PRE_STUDY",
      openBlockingConditions: 2,
      hasPreStudyGoDecision: true,
    });
    // Decision already recorded — progression block is next-action, not stage rewind
    expect(steps.find((s) => s.id === "GOVERNANCE")?.state).toBe("completed");
  });

  it("marks Governance blocked when changes requested without GO", () => {
    const steps = buildPremiumLifecycleSteps({
      currentStage: "PRE_STUDY",
      submissionStatus: "CHANGES_REQUESTED",
      hasActiveSubmission: true,
    });
    expect(steps.find((s) => s.id === "GOVERNANCE")?.state).toBe("blocked");
  });

  it("marks Governance completed after domain advances past Pre-study", () => {
    const steps = buildPremiumLifecycleSteps({ currentStage: "POC" });
    expect(steps.find((s) => s.id === "GOVERNANCE")?.state).toBe("completed");
    expect(steps.find((s) => s.id === "POC")?.state).toBe("current");
  });

  it("exposes text alternatives for each step state", () => {
    const steps = buildPremiumLifecycleSteps({
      currentStage: "PRE_STUDY",
      submissionStatus: "CHANGES_REQUESTED",
      hasActiveSubmission: true,
    });
    for (const step of steps) {
      expect(step.stateLabel.length).toBeGreaterThan(0);
    }
  });
});
