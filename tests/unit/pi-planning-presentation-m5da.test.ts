import { describe, expect, it } from "vitest";
import {
  describeEditability,
  formatPiDateRange,
  planIdentityLabel,
  readinessSummaryLabel,
  scenarioChipLabel,
  summarizeCapacityFromViews,
} from "@/modules/pi-planning/application/pi-planning-presentation";

describe("M5D-A planning vocabulary", () => {
  it("labels current plan vs scenario without revision IDs", () => {
    expect(
      planIdentityLabel({ isCurrent: true, label: null, key: "CURRENT" }),
    ).toBe("Current plan");
    expect(
      planIdentityLabel({
        isCurrent: false,
        label: "Alt staffing",
        key: "SCN-1",
      }),
    ).toBe("Scenario · Alt staffing");
    expect(
      scenarioChipLabel({ isCurrent: true, label: null, key: "CURRENT" }),
    ).toBe("Current plan");
  });

  it("formats planning period dates", () => {
    expect(
      formatPiDateRange("2026-01-01T00:00:00.000Z", "2026-03-31T00:00:00.000Z"),
    ).toBe("2026-01-01 → 2026-03-31");
    expect(formatPiDateRange(null, null)).toMatch(/not set/i);
  });
});

describe("M5D-A editability copy", () => {
  it("explains editable current plan, draft, read-only, and viewer", () => {
    expect(
      describeEditability({
        isCurrent: true,
        status: "ACTIVE_PLAN",
        canAllocate: true,
      }).editable,
    ).toBe(true);
    expect(
      describeEditability({
        isCurrent: false,
        status: "DRAFT",
        canAllocate: true,
      }).summary,
    ).toMatch(/Editable draft/i);
    expect(
      describeEditability({
        isCurrent: false,
        status: "SELECTED",
        canAllocate: true,
      }).editable,
    ).toBe(false);
    expect(
      describeEditability({
        isCurrent: true,
        status: "ACTIVE_PLAN",
        canAllocate: false,
      }).detail,
    ).toMatch(/planning permission/i);
  });
});

describe("M5D-A capacity rollup", () => {
  it("sums service hours without inventing capacity", () => {
    const rollup = summarizeCapacityFromViews({
      teams: [
        {
          effectiveCapacityHours: 40,
          plannedLoadHours: 30,
          band: "ok",
        },
        {
          effectiveCapacityHours: 40,
          plannedLoadHours: 50,
          band: "overload",
        },
      ],
      blockerConflictCount: 1,
    });
    expect(rollup.availableHours).toBe(80);
    expect(rollup.committedHours).toBe(80);
    expect(rollup.remainingHours).toBe(0);
    expect(rollup.overloadSlots).toBe(1);
    expect(rollup.blockerConflictCount).toBe(1);
    expect(rollup.utilizationPercent).toBe(100);
    expect(readinessSummaryLabel(rollup)).toMatch(/blocker conflict/i);
  });

  it("marks empty teams as unavailable", () => {
    const empty = summarizeCapacityFromViews({ teams: [] });
    expect(empty.availableHours).toBeNull();
    expect(readinessSummaryLabel(empty)).toMatch(/unavailable/i);
  });
});
