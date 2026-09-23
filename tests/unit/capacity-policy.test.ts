import { describe, expect, it } from "vitest";
import {
  assertAllocationPercentsWithinLimit,
  CAPACITY_THRESHOLDS,
  effectiveResourceCapacity,
  isNearCapacity,
  isOverloaded,
  teamCapacity,
  utilization,
  utilizationBand,
  weeksBetween,
} from "@/modules/pi-planning/application/capacity-policy";

describe("weeksBetween", () => {
  it("counts inclusive weeks", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-14T00:00:00Z");
    expect(weeksBetween(start, end)).toBeCloseTo(2, 5);
  });

  it("returns 0 when end precedes start", () => {
    expect(
      weeksBetween(
        new Date("2026-01-14T00:00:00Z"),
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).toBe(0);
  });
});

describe("effectiveResourceCapacity", () => {
  it("applies allocation percent and weeks", () => {
    const hours = effectiveResourceCapacity({
      capacityHoursPerWeek: 40,
      allocationPercent: 50,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-14T00:00:00Z"),
    });
    // 40 * 0.5 * 2 weeks = 40
    expect(hours).toBeCloseTo(40, 5);
  });

  it("uses availableHours override and reduction", () => {
    const hours = effectiveResourceCapacity({
      capacityHoursPerWeek: 40,
      allocationPercent: 100,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-14T00:00:00Z"),
      availableHoursOverride: 30,
      reductionHours: 5,
    });
    expect(hours).toBe(25);
  });

  it("clamps capacity at zero when reduction exceeds base", () => {
    const hours = effectiveResourceCapacity({
      capacityHoursPerWeek: 40,
      allocationPercent: 100,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-07T00:00:00Z"),
      availableHoursOverride: 10,
      reductionHours: 20,
    });
    expect(hours).toBe(0);
  });
});

describe("teamCapacity / multi-team percent (no double-count)", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date("2026-01-07T00:00:00Z");

  it("sums members without double-counting via percent", () => {
    const total = teamCapacity([
      {
        resourceId: "r1",
        capacityHoursPerWeek: 40,
        allocationPercent: 60,
        startDate: start,
        endDate: end,
      },
      {
        resourceId: "r2",
        capacityHoursPerWeek: 40,
        allocationPercent: 100,
        startDate: start,
        endDate: end,
      },
    ]);
    // ~1 week: 40*0.6 + 40*1 = 64
    expect(total).toBeCloseTo(64, 5);
  });

  it("splits one resource across teams by percent so org total ≤ weekly capacity", () => {
    const sharedWeekly = 40;
    const teamA = teamCapacity([
      {
        resourceId: "shared",
        capacityHoursPerWeek: sharedWeekly,
        allocationPercent: 40,
        startDate: start,
        endDate: end,
      },
    ]);
    const teamB = teamCapacity([
      {
        resourceId: "shared",
        capacityHoursPerWeek: sharedWeekly,
        allocationPercent: 60,
        startDate: start,
        endDate: end,
      },
    ]);
    // ~1 week: 16 + 24 = 40 (not 80)
    expect(teamA).toBeCloseTo(16, 5);
    expect(teamB).toBeCloseTo(24, 5);
    expect(teamA + teamB).toBeCloseTo(sharedWeekly, 5);
  });
});

describe("utilization helpers / overload thresholds", () => {
  it("detects overload and near capacity bands", () => {
    expect(isOverloaded(utilization(110, 100))).toBe(true);
    expect(isOverloaded(utilization(100, 100))).toBe(false);
    expect(isNearCapacity(utilization(90, 100))).toBe(true);
    expect(isNearCapacity(utilization(84, 100))).toBe(false);
    expect(utilizationBand(utilization(40, 100))).toBe("under");
    expect(utilizationBand(utilization(70, 100))).toBe("ok");
    expect(utilizationBand(utilization(90, 100))).toBe("near");
    expect(utilizationBand(utilization(101, 100))).toBe("overload");
    expect(CAPACITY_THRESHOLDS.overload).toBe(1);
    expect(CAPACITY_THRESHOLDS.nearCapacity).toBe(0.85);
    expect(CAPACITY_THRESHOLDS.underAllocation).toBe(0.5);
  });

  it("treats infinite utilization when capacity is zero but load exists", () => {
    const util = utilization(10, 0);
    expect(util).toBe(Number.POSITIVE_INFINITY);
    expect(isOverloaded(util)).toBe(true);
    expect(utilizationBand(util)).toBe("overload");
  });

  it("returns null utilization when capacity and load are both zero", () => {
    expect(utilization(0, 0)).toBeNull();
    expect(utilizationBand(null)).toBe("none");
    expect(isOverloaded(null)).toBe(false);
    expect(isNearCapacity(null)).toBe(false);
  });
});

describe("allocation percent validation", () => {
  it("rejects sums over 100", () => {
    const result = assertAllocationPercentsWithinLimit([60, 50]);
    expect(result.ok).toBe(false);
  });

  it("allows sum of 100", () => {
    expect(assertAllocationPercentsWithinLimit([40, 60]).ok).toBe(true);
  });

  it("allows empty list", () => {
    expect(assertAllocationPercentsWithinLimit([]).ok).toBe(true);
  });
});
