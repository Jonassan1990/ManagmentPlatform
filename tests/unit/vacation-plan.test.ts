import { describe, expect, it } from "vitest";
import { planCellKind } from "@/modules/vacation/application/vacation-plan";

describe("vacation plan cells", () => {
  it("uses a saved mark before a vacation request", () => {
    expect(planCellKind({ mark: "PARENTAL", request: "FULL_DAYS" })).toBe("PARENTAL");
  });

  it("shows a full-day request as vacation", () => {
    expect(planCellKind({ mark: null, request: "FULL_DAYS" })).toBe("VACATION");
  });

  it("shows a half day or hours as part of the day", () => {
    expect(planCellKind({ mark: null, request: "HALF_DAY" })).toBe("PARTIAL");
    expect(planCellKind({ mark: null, request: "HOURS" })).toBe("PARTIAL");
  });

  it("leaves an unmarked weekday empty", () => {
    expect(planCellKind({ mark: null, request: null })).toBeNull();
  });
});
