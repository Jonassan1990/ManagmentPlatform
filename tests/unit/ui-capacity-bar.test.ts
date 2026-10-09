import { describe, expect, it } from "vitest";
import { deriveCapacityBar } from "@/components/ui/capacity-bar";

describe("CapacityBar derivation", () => {
  it("handles healthy utilization", () => {
    const d = deriveCapacityBar({ available: 100, committed: 40 });
    expect(d.remaining).toBe(60);
    expect(d.overload).toBe(false);
    expect(d.utilization).toBe(40);
    expect(d.label).toContain("Available 100h");
  });

  it("handles zero available without inventing capacity", () => {
    const d = deriveCapacityBar({ available: 0, committed: 0 });
    expect(d.remaining).toBe(0);
    expect(d.utilization).toBeNull();
    expect(d.fillRatio).toBe(0);
  });

  it("flags overload when committed exceeds available", () => {
    const d = deriveCapacityBar({ available: 40, committed: 58 });
    expect(d.overload).toBe(true);
    expect(d.remaining).toBe(-18);
    expect(d.label).toContain("overload");
  });

  it("marks unavailable without computing utilization", () => {
    const d = deriveCapacityBar({
      available: 100,
      committed: 50,
      unavailable: true,
    });
    expect(d.label).toBe("Capacity unavailable");
    expect(d.utilization).toBeNull();
    expect(d.overload).toBe(false);
  });

  it("clamps negative available to zero for display math", () => {
    const d = deriveCapacityBar({ available: -10, committed: 5 });
    expect(d.remaining).toBe(-5);
    expect(d.overload).toBe(true);
  });
});
