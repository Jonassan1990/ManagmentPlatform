import { describe, expect, it } from "vitest";
import { metricNumber } from "@/components/portfolio/metric";
import type { PortfolioMetric } from "@/modules/portfolio/domain/types";

describe("portfolio metric display helpers", () => {
  it("preserves available zeros (does not treat as unavailable)", () => {
    const metric: PortfolioMetric<number> = { available: true, value: 0 };
    expect(metricNumber(metric)).toEqual({ kind: "value", value: 0 });
  });

  it("surfaces unavailable with reason instead of inventing zero", () => {
    const metric: PortfolioMetric<number> = {
      available: false,
      reason: "No in-scope PI capacity rows.",
    };
    expect(metricNumber(metric)).toEqual({
      kind: "unavailable",
      reason: "No in-scope PI capacity rows.",
    });
  });

  it("handles missing metric payload", () => {
    expect(metricNumber(undefined).kind).toBe("unavailable");
  });
});
