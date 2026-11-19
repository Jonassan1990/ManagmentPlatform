import { describe, expect, it } from "vitest";
import {
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
    expect(
      new Set(MANAGER_DEMO_CAST.map((row) => row.username)).size,
    ).toBe(MANAGER_DEMO_CAST.length);
  });

  it("uses searchable display names for View as", () => {
    expect(MANAGER_DEMO_CAST.map((row) => row.displayName)).toEqual(
      expect.arrayContaining([
        "Bo (Demo Manager)",
        "Freja (Demo Developer)",
        "Klara (Demo Analyst)",
        "Henrik (Demo Ops)",
      ]),
    );
  });
});
