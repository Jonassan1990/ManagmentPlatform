import { describe, expect, it } from "vitest";
import {
  buildInitiativeTabGroups,
  buildLifecycleStageViews,
  describeInitiativeNextAction,
  flattenInitiativeTabs,
} from "@/modules/initiative/application/initiative-journey";

describe("M4D-C initiative journey presentation", () => {
  it("groups early tabs under Discovery without inventing stages", () => {
    const groups = buildInitiativeTabGroups({ currentStage: "DEMAND" });
    expect(groups.map((g) => g.id)).toEqual([
      "overview",
      "discovery",
      "history",
    ]);
    const discovery = groups.find((g) => g.id === "discovery")!;
    expect(discovery.emphasizesCurrentStage).toBe(true);
    expect(discovery.tabs.map((t) => t.key)).toEqual([
      "demand",
      "requirements",
      "pre-study",
    ]);
    // Early stage: max tabs = overview + 3 discovery + 3 history = 7
    expect(flattenInitiativeTabs({ currentStage: "DEMAND" })).toHaveLength(7);
  });

  it("reveals governance/validation/delivery groups as the journey progresses", () => {
    const late = flattenInitiativeTabs({
      currentStage: "PROJECT",
      hasGovernance: true,
      hasPoC: true,
      hasPilot: true,
      hasProject: true,
    });
    expect(late.map((t) => t.key)).toEqual([
      "overview",
      "demand",
      "requirements",
      "pre-study",
      "governance",
      "decisions",
      "poc",
      "pilot",
      "project",
      "risks",
      "documents",
      "history",
    ]);
    expect(late).toHaveLength(12);
    const groups = buildInitiativeTabGroups({
      currentStage: "PROJECT",
      hasGovernance: true,
      hasPoC: true,
      hasPilot: true,
      hasProject: true,
    });
    expect(groups.find((g) => g.id === "delivery")?.emphasizesCurrentStage).toBe(
      true,
    );
  });

  it("marks completed/current/upcoming lifecycle stages", () => {
    const views = buildLifecycleStageViews("POC");
    expect(views.find((v) => v.stage === "DEMAND")?.state).toBe("completed");
    expect(views.find((v) => v.stage === "POC")?.state).toBe("current");
    expect(views.find((v) => v.stage === "PROJECT")?.state).toBe("upcoming");
  });

  it("describes next actions without auto-creating PoC/Pilot/Project", () => {
    expect(
      describeInitiativeNextAction({
        currentStage: "PRE_STUDY",
        canCreatePoC: true,
      }).label,
    ).toMatch(/manual/i);

    expect(
      describeInitiativeNextAction({
        currentStage: "POC",
        canCreatePilot: true,
      }).label,
    ).toMatch(/manual/i);

    expect(
      describeInitiativeNextAction({
        currentStage: "PILOT",
        canConvertProject: true,
      }).label,
    ).toMatch(/manual/i);

    const blocked = describeInitiativeNextAction({
      currentStage: "PRE_STUDY",
      openBlockingConditions: 2,
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.hrefHint).toBe("decisions");
  });

  it("surfaces closed project read-only next action", () => {
    const closed = describeInitiativeNextAction({
      currentStage: "PROJECT",
      projectClosed: true,
    });
    expect(closed.blocked).toBe(true);
    expect(closed.label).toMatch(/read-only/i);
  });
});
