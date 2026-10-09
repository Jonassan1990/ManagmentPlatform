import { describe, expect, it } from "vitest";
import {
  evaluateDeliveryHealth,
  hasSufficientScheduleEvidence,
  type HealthProjectInput,
} from "@/modules/portfolio/application/delivery-health";

const AS_OF = new Date("2026-06-15T12:00:00.000Z");

function base(overrides: Partial<HealthProjectInput> = {}): HealthProjectInput {
  return {
    id: "p1",
    initiativeId: "i1",
    status: "ACTIVE",
    plannedEnd: null,
    plannedStart: null,
    closureOutcome: null,
    issues: [],
    milestones: [],
    criticalOpenDependencies: [],
    ...overrides,
  };
}

describe("delivery-health classifier", () => {
  it("CANCELLED beats adverse signals", () => {
    const result = evaluateDeliveryHealth(
      base({
        status: "CANCELLED",
        plannedEnd: new Date("2020-01-01"),
        issues: [
          {
            id: "iss1",
            status: "OPEN",
            severity: "CRITICAL",
            isBlocker: true,
          },
        ],
      }),
      AS_OF,
    );
    expect(result.classification).toBe("CANCELLED");
  });

  it("COMPLETED preserves closure outcome", () => {
    const result = evaluateDeliveryHealth(
      base({
        status: "COMPLETED",
        closureOutcome: "PARTIALLY_DELIVERED",
      }),
      AS_OF,
    );
    expect(result.classification).toBe("COMPLETED");
    expect(result.closureOutcome).toBe("PARTIALLY_DELIVERED");
  });

  it("BLOCKED precedes AT_RISK and still lists other reasons", () => {
    const result = evaluateDeliveryHealth(
      base({
        plannedEnd: new Date("2020-01-01"),
        issues: [
          {
            id: "iss1",
            status: "OPEN",
            severity: "HIGH",
            isBlocker: true,
          },
        ],
      }),
      AS_OF,
    );
    expect(result.classification).toBe("BLOCKED");
    expect(result.reasons.map((r) => r.code)).toEqual(
      expect.arrayContaining(["ACTIVE_BLOCKER_ISSUE", "OVERDUE_PROJECT_END"]),
    );
  });

  it("resolved blocker is not active", () => {
    const result = evaluateDeliveryHealth(
      base({
        plannedEnd: new Date("2026-12-01"),
        issues: [
          {
            id: "iss1",
            status: "RESOLVED",
            severity: "HIGH",
            isBlocker: true,
          },
        ],
      }),
      AS_OF,
    );
    expect(result.classification).toBe("ON_TRACK");
  });

  it("as-of equality is not overdue", () => {
    const result = evaluateDeliveryHealth(
      base({ plannedEnd: AS_OF }),
      AS_OF,
    );
    expect(result.classification).toBe("ON_TRACK");
  });

  it("insufficient schedule evidence → UNKNOWN", () => {
    expect(hasSufficientScheduleEvidence(base())).toBe(false);
    const result = evaluateDeliveryHealth(base(), AS_OF);
    expect(result.classification).toBe("UNKNOWN");
    expect(result.reasons[0]?.code).toBe("INSUFFICIENT_SCHEDULE_DATA");
  });
});
