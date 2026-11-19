import { describe, expect, it } from "vitest";
import {
  INFB_DEMO_PIPELINE,
  MANAGER_DEMO_CAST,
  MANAGER_DEMO_IDS,
  MANAGER_DEMO_PASSWORD,
} from "@/modules/demo/manager-demo-story";

describe("manager demo story catalog", () => {
  it("has a manager and three people with stable ids", () => {
    expect(MANAGER_DEMO_CAST).toHaveLength(4);
    expect(MANAGER_DEMO_CAST.filter((row) => row.manager)).toHaveLength(1);
    expect(MANAGER_DEMO_PASSWORD.length).toBeGreaterThan(8);
    expect(MANAGER_DEMO_IDS.managerPrincipal).toMatch(
      /^b2000000-0000-4000-8000-/,
    );
  });

  it("covers the full INFB lifecycle with costs", () => {
    const stages = INFB_DEMO_PIPELINE.map((row) => row.stage);
    expect(stages).toEqual(
      expect.arrayContaining([
        "DEMAND",
        "REQUIREMENTS",
        "PRE_STUDY",
        "POC",
        "PROJECT",
      ]),
    );
    expect(
      INFB_DEMO_PIPELINE.filter((row) => row.stage === "PROJECT"),
    ).toHaveLength(2);
    for (const row of INFB_DEMO_PIPELINE) {
      expect(row.budgetHintEur).toBeGreaterThan(1000);
    }
  });
});
