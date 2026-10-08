import { describe, expect, it } from "vitest";
import {
  linkResourcePrincipalInputSchema,
  unlinkResourcePrincipalInputSchema,
} from "@/modules/organization/application/schemas";
import {
  effectiveResourceCapacity,
  assertAllocationPercentsWithinLimit,
} from "@/modules/pi-planning/application/capacity-policy";

describe("Phase 0A link/unlink schemas", () => {
  it("accepts valid link payload", () => {
    const parsed = linkResourcePrincipalInputSchema.parse({
      resourceId: "11111111-1111-4111-8111-111111111111",
      principalId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.resourceId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("rejects invalid uuids on link", () => {
    expect(() =>
      linkResourcePrincipalInputSchema.parse({
        resourceId: "not-a-uuid",
        principalId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow();
  });

  it("accepts unlink payload", () => {
    const parsed = unlinkResourcePrincipalInputSchema.parse({
      resourceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.resourceId).toBeDefined();
  });
});

describe("Phase 0A capacity regression (link must not affect math)", () => {
  it("effective capacity still uses Resource hours and membership percent only", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-14T00:00:00Z");
    const hours = effectiveResourceCapacity({
      capacityHoursPerWeek: 40,
      allocationPercent: 50,
      startDate: start,
      endDate: end,
    });
    // ~2 weeks * 40 * 0.5 ≈ 40
    expect(hours).toBeGreaterThan(35);
    expect(hours).toBeLessThan(45);
  });

  it("membership percent validation unchanged", () => {
    expect(assertAllocationPercentsWithinLimit([60, 40]).ok).toBe(true);
    expect(assertAllocationPercentsWithinLimit([60, 50]).ok).toBe(false);
  });
});
