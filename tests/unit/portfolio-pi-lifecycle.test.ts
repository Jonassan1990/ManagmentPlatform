import { describe, expect, it } from "vitest";
import { classifyPiLifecycle } from "@/modules/portfolio/application/portfolio-pi-capacity-query-service";

const asOf = new Date("2026-06-15T12:00:00.000Z");

describe("classifyPiLifecycle", () => {
  it("ACTIVE status wins regardless of dates", () => {
    expect(
      classifyPiLifecycle(
        "ACTIVE",
        new Date("2027-01-01T00:00:00.000Z"),
        new Date("2027-03-31T00:00:00.000Z"),
        asOf,
      ),
    ).toBe("ACTIVE");
  });

  it("CLOSED status is COMPLETED", () => {
    expect(
      classifyPiLifecycle(
        "CLOSED",
        new Date("2025-01-01T00:00:00.000Z"),
        new Date("2025-03-31T00:00:00.000Z"),
        asOf,
      ),
    ).toBe("COMPLETED");
  });

  it("future start with non-terminal status is UPCOMING", () => {
    expect(
      classifyPiLifecycle(
        "PLANNING",
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-09-30T00:00:00.000Z"),
        asOf,
      ),
    ).toBe("UPCOMING");
  });

  it("past-dated DRAFT is OTHER", () => {
    expect(
      classifyPiLifecycle(
        "DRAFT",
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-03-31T00:00:00.000Z"),
        asOf,
      ),
    ).toBe("OTHER");
  });

  it("startDate equal to asOf is not UPCOMING", () => {
    expect(
      classifyPiLifecycle(
        "REVIEW",
        asOf,
        new Date("2026-09-30T00:00:00.000Z"),
        asOf,
      ),
    ).toBe("OTHER");
  });
});
