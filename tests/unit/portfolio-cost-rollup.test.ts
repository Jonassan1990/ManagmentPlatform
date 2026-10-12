import { describe, expect, it } from "vitest";
import {
  formatMoneyAmount,
  rollupProjectCosts,
} from "@/modules/portfolio/application/portfolio-cost-rollup";

describe("rollupProjectCosts", () => {
  it("sums present money fields and omits nulls (null ≠ zero)", () => {
    const rollup = rollupProjectCosts([
      {
        estimatedCost: 100,
        plannedCost: 200,
        forecastCost: 250,
        actualCost: 80,
      },
      {
        estimatedCost: null,
        plannedCost: 50,
        forecastCost: null,
        actualCost: null,
      },
      {
        estimatedCost: null,
        plannedCost: null,
        forecastCost: null,
        actualCost: null,
      },
    ]);

    expect(rollup.projectsInScope).toBe(3);
    expect(rollup.projectsWithAnyCost).toBe(2);
    expect(rollup.estimatedTotal).toBe(100);
    expect(rollup.plannedTotal).toBe(250);
    expect(rollup.forecastTotal).toBe(250);
    expect(rollup.actualTotal).toBe(80);
    expect(rollup.forecastVsPlannedDelta).toBe(0);
  });

  it("reports forecast vs plan delta when both sides exist", () => {
    const rollup = rollupProjectCosts([
      {
        estimatedCost: null,
        plannedCost: 100,
        forecastCost: 140,
        actualCost: null,
      },
    ]);
    expect(rollup.forecastVsPlannedDelta).toBe(40);
  });

  it("returns null totals when no cost data exists", () => {
    const rollup = rollupProjectCosts([
      {
        estimatedCost: null,
        plannedCost: null,
        forecastCost: null,
        actualCost: null,
      },
    ]);
    expect(rollup.plannedTotal).toBeNull();
    expect(rollup.forecastVsPlannedDelta).toBeNull();
    expect(formatMoneyAmount(null)).toBe("—");
  });
});
