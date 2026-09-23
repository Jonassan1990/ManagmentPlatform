import { describe, expect, it } from "vitest";
import { deriveConflicts } from "@/modules/pi-planning/application/conflict-engine";
import {
  buildBaselinePayload,
  compareChangesSinceBaseline,
  type BaselinePayload,
  type BaselinePayloadInput,
} from "@/modules/pi-planning/application/baseline-snapshot";
import { buildPiAttentionItems } from "@/modules/pi-planning/application/attention";

describe("deriveConflicts", () => {
  const base = {
    piId: "pi1",
    piStartDate: new Date("2026-01-01"),
    piEndDate: new Date("2026-03-31"),
    iterations: [
      {
        id: "it1",
        sequence: 1,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-14"),
      },
      {
        id: "it2",
        sequence: 2,
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-28"),
      },
    ],
    allocations: [] as never[],
    teamCapacities: [] as never[],
    resourceCapacities: [] as never[],
    dependencies: [] as never[],
  };

  it("flags team overload as blocker", () => {
    const conflicts = deriveConflicts({
      ...base,
      teamCapacities: [
        {
          teamId: "t1",
          iterationId: "it1",
          effectiveCapacityHours: 40,
          plannedLoadHours: 50,
        },
      ],
    });
    const overload = conflicts.find((c) => c.type === "TEAM_OVERLOAD");
    expect(overload?.severity).toBe("BLOCKER");
  });

  it("flags near-capacity team as warning TEAM_OVERLOAD", () => {
    const conflicts = deriveConflicts({
      ...base,
      teamCapacities: [
        {
          teamId: "t1",
          iterationId: "it1",
          effectiveCapacityHours: 100,
          plannedLoadHours: 90,
        },
      ],
    });
    const near = conflicts.find((c) => c.type === "TEAM_OVERLOAD");
    expect(near?.severity).toBe("WARNING");
  });

  it("flags resource overload", () => {
    const conflicts = deriveConflicts({
      ...base,
      resourceCapacities: [
        {
          resourceId: "r1",
          iterationId: "it1",
          effectiveCapacityHours: 20,
          plannedLoadHours: 25,
        },
      ],
    });
    expect(conflicts.some((c) => c.type === "RESOURCE_OVERLOAD")).toBe(true);
  });

  it("flags dependency timing when successor precedes predecessor", () => {
    const conflicts = deriveConflicts({
      ...base,
      dependencies: [
        {
          id: "d1",
          type: "DEPENDS_ON",
          status: "OPEN",
          criticality: "HIGH",
          sourceType: "WORK_ITEM",
          sourceId: "w1",
          targetType: "WORK_ITEM",
          targetId: "w2",
          sourceIterationSequence: 2,
          targetIterationSequence: 1,
        },
      ],
    });
    const timing = conflicts.find((c) => c.type === "DEPENDENCY_TIMING");
    expect(timing?.severity).toBe("BLOCKER");
  });

  it("skips dependency timing when sequences are ordered correctly", () => {
    const conflicts = deriveConflicts({
      ...base,
      dependencies: [
        {
          id: "d1",
          type: "DEPENDS_ON",
          status: "OPEN",
          criticality: "HIGH",
          sourceType: "WORK_ITEM",
          sourceId: "w1",
          targetType: "WORK_ITEM",
          targetId: "w2",
          sourceIterationSequence: 1,
          targetIterationSequence: 2,
        },
      ],
    });
    expect(conflicts.some((c) => c.type === "DEPENDENCY_TIMING")).toBe(false);
  });

  it("skips resolved/cancelled/RELATED dependencies", () => {
    const conflicts = deriveConflicts({
      ...base,
      dependencies: [
        {
          id: "d1",
          type: "DEPENDS_ON",
          status: "RESOLVED",
          criticality: "CRITICAL",
          sourceType: "WORK_ITEM",
          sourceId: "w1",
          targetType: "WORK_ITEM",
          targetId: "w2",
          sourceIterationSequence: 2,
          targetIterationSequence: 1,
        },
        {
          id: "d2",
          type: "RELATED",
          status: "OPEN",
          criticality: "HIGH",
          sourceType: "WORK_ITEM",
          sourceId: "w1",
          targetType: "WORK_ITEM",
          targetId: "w2",
          sourceIterationSequence: 2,
          targetIterationSequence: 1,
        },
      ],
    });
    expect(conflicts.some((c) => c.type === "DEPENDENCY_TIMING")).toBe(false);
  });

  it("flags milestone timing outside PI window", () => {
    const conflicts = deriveConflicts({
      ...base,
      milestones: [
        {
          id: "ms1",
          projectId: "p1",
          plannedDate: new Date("2025-12-01"),
          status: "PLANNED",
          criticality: true,
        },
      ],
    });
    const ms = conflicts.find((c) => c.type === "MILESTONE_TIMING");
    expect(ms?.severity).toBe("WARNING");
    expect(ms?.subjectId).toBe("ms1");
  });

  it("does not flag completed milestones outside PI", () => {
    const conflicts = deriveConflicts({
      ...base,
      milestones: [
        {
          id: "ms1",
          projectId: "p1",
          plannedDate: new Date("2025-12-01"),
          status: "COMPLETED",
          criticality: true,
        },
      ],
    });
    expect(conflicts.some((c) => c.type === "MILESTONE_TIMING")).toBe(false);
  });

  it("flags membership percent sum over 100", () => {
    const conflicts = deriveConflicts({
      ...base,
      resourceAllocationPercents: { r1: 120 },
    });
    expect(
      conflicts.some((c) => c.type === "RESOURCE_ALLOCATION_CONFLICT"),
    ).toBe(true);
  });
});

describe("baseline snapshot immutability comparison", () => {
  const input: BaselinePayloadInput = {
    pi: {
      id: "pi1",
      referenceKey: "PI-0001",
      name: "Q1",
      status: "REVIEW",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
      version: 1,
    },
    revision: { id: "rev1", key: "CURRENT", version: 1 },
    iterations: [
      {
        id: "it1",
        referenceKey: "IT-001",
        name: "I1",
        sequence: 1,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-14"),
      },
    ],
    allocations: [
      {
        id: "a1",
        workItemId: "w1",
        iterationId: "it1",
        teamId: "t1",
        plannedHours: 8,
      },
    ],
    participatingDepartmentIds: ["d1"],
    participatingTeamIds: ["t1"],
    dependencies: [],
    capturedAt: "2026-01-10T12:00:00.000Z",
  };

  it("builds immutable payload and detects moves", () => {
    const payload = buildBaselinePayload(input);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.capturedAt).toBe("2026-01-10T12:00:00.000Z");

    const changes = compareChangesSinceBaseline(payload, {
      ...input,
      allocations: [
        {
          id: "a1",
          workItemId: "w1",
          iterationId: "it2",
          teamId: "t1",
          plannedHours: 8,
        },
      ],
    });
    expect(changes.some((c) => c.kind === "allocation_moved")).toBe(true);
  });

  it("reports no changes when current matches baseline", () => {
    const payload = buildBaselinePayload(input);
    const frozen: BaselinePayload = structuredClone(payload);
    const changes = compareChangesSinceBaseline(payload, input);
    expect(changes).toEqual([]);
    // Baseline payload object remains unchanged after compare
    expect(payload).toEqual(frozen);
  });

  it("detects hours change, add, remove, and participation deltas", () => {
    const payload = buildBaselinePayload(input);

    const hours = compareChangesSinceBaseline(payload, {
      ...input,
      allocations: [
        {
          id: "a1",
          workItemId: "w1",
          iterationId: "it1",
          teamId: "t1",
          plannedHours: 16,
        },
      ],
    });
    expect(hours.some((c) => c.kind === "allocation_hours_changed")).toBe(true);

    const added = compareChangesSinceBaseline(payload, {
      ...input,
      allocations: [
        ...input.allocations,
        {
          id: "a2",
          workItemId: "w2",
          iterationId: "it1",
          teamId: "t1",
          plannedHours: 4,
        },
      ],
    });
    expect(added.some((c) => c.kind === "allocation_added")).toBe(true);

    const removed = compareChangesSinceBaseline(payload, {
      ...input,
      allocations: [],
    });
    expect(removed.some((c) => c.kind === "allocation_removed")).toBe(true);

    const participation = compareChangesSinceBaseline(payload, {
      ...input,
      participatingTeamIds: ["t1", "t2"],
    });
    expect(participation.some((c) => c.kind === "participation_changed")).toBe(
      true,
    );
  });
});

describe("pi attention", () => {
  it("blocks planning without iterations", () => {
    const items = buildPiAttentionItems({
      status: "PLANNING",
      iterationCount: 0,
      participatingDepartmentCount: 1,
      allocationCount: 0,
      conflictCount: 0,
      baselineCount: 0,
      hasCurrentRevision: true,
    });
    expect(items.some((i) => i.key === "no-iterations")).toBe(true);
  });
});
