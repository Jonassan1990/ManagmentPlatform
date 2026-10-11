import { describe, expect, it } from "vitest";
import type { AggregatedResourceRow, DepartmentCardModel } from "@/components/portfolio/portfolio-capacity-model";
import {
  summarizeCrossFunctional,
  summarizeManagerResourceKpis,
  summarizeOverloadedResources,
} from "@/components/portfolio/resource-management-kpis";

function resource(
  partial: Partial<AggregatedResourceRow> &
    Pick<AggregatedResourceRow, "resourceId" | "teamId" | "band">,
): AggregatedResourceRow {
  return {
    resourceName: partial.resourceName ?? partial.resourceId,
    teamName: partial.teamName ?? partial.teamId,
    departmentId: partial.departmentId ?? "d1",
    availableHours: partial.availableHours ?? 40,
    committedHours: partial.committedHours ?? 20,
    remainingHours: partial.remainingHours ?? 20,
    utilization: partial.utilization ?? 0.5,
    membershipAllocationPercent: partial.membershipAllocationPercent ?? 100,
    projectSegments: partial.projectSegments ?? [],
    ...partial,
  };
}

describe("resource management KPIs", () => {
  it("counts overloaded resources across departments", () => {
    const cards = [
      {
        departmentId: "d1",
        departmentName: "Asset",
        availableHours: 80,
        committedHours: 90,
        remainingHours: -10,
        utilization: 1.1,
        band: "overload" as const,
        teamCount: 1,
        resourceCount: 2,
        overloadCount: 1,
        teams: [
          {
            teamId: "t1",
            teamName: "OT",
            availableHours: 80,
            committedHours: 90,
            remainingHours: -10,
            utilization: 1.1,
            band: "overload" as const,
            resources: [
              resource({
                resourceId: "r1",
                teamId: "t1",
                band: "overload",
              }),
              resource({ resourceId: "r2", teamId: "t1", band: "ok" }),
            ],
          },
        ],
      },
    ] satisfies DepartmentCardModel[];
    expect(summarizeOverloadedResources(cards)).toBe(1);
  });

  it("counts cross-functional people and assignment rows", () => {
    const rows = [
      resource({ resourceId: "shared", teamId: "t1", band: "ok" }),
      resource({ resourceId: "shared", teamId: "t2", band: "ok" }),
      resource({ resourceId: "solo", teamId: "t1", band: "ok" }),
    ];
    expect(summarizeCrossFunctional(rows)).toEqual({
      people: 1,
      assignments: 2,
    });
  });

  it("builds manager KPI strip from hours + dependencies", () => {
    const cards = [
      {
        departmentId: "d1",
        departmentName: "Asset",
        availableHours: 100,
        committedHours: 82,
        remainingHours: 18,
        utilization: 0.82,
        band: "ok" as const,
        teamCount: 1,
        resourceCount: 1,
        overloadCount: 0,
        teams: [
          {
            teamId: "t1",
            teamName: "OT",
            availableHours: 100,
            committedHours: 82,
            remainingHours: 18,
            utilization: 0.82,
            band: "ok" as const,
            resources: [
              resource({ resourceId: "a", teamId: "t1", band: "ok" }),
              resource({ resourceId: "a", teamId: "t2", band: "ok" }),
            ],
          },
        ],
      },
    ] satisfies DepartmentCardModel[];

    const kpis = summarizeManagerResourceKpis({
      availableHours: 100,
      committedHours: 82,
      utilization: 0.82,
      cards,
      aggregatedResources: cards[0]!.teams[0]!.resources,
      dependencies: {
        state: "ready",
        rows: [
          {
            id: "1",
            type: "BLOCKS",
            status: "OPEN",
            criticality: "HIGH",
            sourceType: "PROJECT",
            sourceId: "p1",
            targetType: "PROJECT",
            targetId: "p2",
            ownerName: "CM",
            neededByDate: null,
            description: null,
            sourceLabel: "A",
            targetLabel: "B",
          },
          {
            id: "2",
            type: "RELATED",
            status: "OPEN",
            criticality: "LOW",
            sourceType: "PROJECT",
            sourceId: "p1",
            targetType: "PROJECT",
            targetId: "p3",
            ownerName: "CM",
            neededByDate: null,
            description: null,
            sourceLabel: "A",
            targetLabel: "C",
          },
        ],
        openCount: 2,
        criticalCount: 1,
      },
    });

    expect(kpis.capacityAllocatedPctLabel).toBe("82%");
    expect(kpis.capacityAllocatedNote).toContain("82 of 100 h");
    expect(kpis.crossFunctionalAssignments).toBe(2);
    expect(kpis.crossFunctionalPeople).toBe(1);
    expect(kpis.externalDependencies).toBe(2);
    expect(kpis.externalDependenciesAttention).toBe(1);
  });
});
