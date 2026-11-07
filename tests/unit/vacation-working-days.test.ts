import { describe, expect, it } from "vitest";
import {
  countWorkingDays,
  formatDateOnly,
  toUtcDateOnly,
} from "@/modules/vacation/application/working-days";

describe("vacation working days", () => {
  it("counts weekdays inclusive across a weekend", () => {
    // Fri 2026-11-06 to Mon 2026-11-09 → Fri + Mon = 2
    expect(
      countWorkingDays(
        toUtcDateOnly("2026-11-06"),
        toUtcDateOnly("2026-11-09"),
      ),
    ).toBe(2);
  });

  it("counts a single weekday", () => {
    expect(
      countWorkingDays(
        toUtcDateOnly("2026-11-04"),
        toUtcDateOnly("2026-11-04"),
      ),
    ).toBe(1);
  });

  it("returns 0 for weekend-only ranges", () => {
    expect(
      countWorkingDays(
        toUtcDateOnly("2026-11-07"),
        toUtcDateOnly("2026-11-08"),
      ),
    ).toBe(0);
  });

  it("formats date-only strings", () => {
    expect(formatDateOnly(toUtcDateOnly("2026-01-02"))).toBe("2026-01-02");
  });
});
