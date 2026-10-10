import { describe, expect, it } from "vitest";
import {
  availableCapacityDepartments,
  criticalityToBadge,
  dependencyStatusToBadge,
  explainConflict,
  formatNeededBy,
  isPiViewForbiddenMessage,
  mapPlanningDependencyRows,
  summarizeDependencyCounts,
} from "@/components/portfolio/portfolio-capacity-coordination";
import type {
  PortfolioPiConflictRow,
  PortfolioPiDepartmentCapacityRow,
  PortfolioPiProjectCommitmentRow,
  PortfolioPiResourceCapacityRow,
  PortfolioPiTeamCapacityRow,
} from "@/modules/portfolio/domain/types";

function hours(
  available: number,
  committed: number,
  band: PortfolioPiDepartmentCapacityRow["band"] = "ok",
) {
  return {
    availableHours: available,
    committedHours: committed,
    remainingHours: available - committed,
    utilization: available > 0 ? committed / available : null,
    band,
  };
}

describe("portfolio capacity coordination (M4E-C)", () => {
  it("lists departments with remaining capacity only from returned rows", () => {
    const departments: PortfolioPiDepartmentCapacityRow[] = [
      {
        departmentId: "d1",
        departmentName: "Has slack",
        ...hours(100, 40, "under"),
      },
      {
        departmentId: "d2",
        departmentName: "Overloaded",
        ...hours(100, 120, "overload"),
      },
      {
        departmentId: "d3",
        departmentName: "Full",
        ...hours(100, 100, "ok"),
      },
    ];
    const available = availableCapacityDepartments(departments);
    expect(available.map((d) => d.departmentId)).toEqual(["d1"]);
    expect(available[0]!.remainingHours).toBe(60);
  });

  it("maps PlanningDependency rows with project labels when known", () => {
    const projects: PortfolioPiProjectCommitmentRow[] = [
      {
        projectId: "proj-1",
        initiativeId: "init-1",
        referenceKey: "PRJ-1",
        name: "Heavy",
        href: "/initiatives/init-1/project",
        committedHours: 40,
        workItemCount: 1,
        allocationCount: 1,
      },
    ];
    const rows = mapPlanningDependencyRows(
      [
        {
          id: "dep-1",
          type: "BLOCKS",
          status: "OPEN",
          criticality: "CRITICAL",
          sourceType: "PROJECT",
          sourceId: "proj-1",
          targetType: "PROJECT",
          targetId: "proj-2",
          ownerName: "Alex",
          neededByDate: "2026-11-01T00:00:00.000Z",
          description: "Needs review",
        },
        {
          id: "dep-2",
          type: "RELATED",
          status: "RESOLVED",
          criticality: "LOW",
          sourceType: "WORK_ITEM",
          sourceId: "wi-1",
          targetType: "WORK_ITEM",
          targetId: "wi-2",
          ownerName: null,
          neededByDate: null,
          description: null,
        },
      ],
      projects,
    );
    expect(rows[0]!.id).toBe("dep-1");
    expect(rows[0]!.sourceLabel).toContain("PRJ-1");
    expect(rows[0]!.targetLabel).toMatch(/Project /);
    const counts = summarizeDependencyCounts(rows);
    expect(counts.openCount).toBe(1);
    expect(counts.criticalCount).toBe(1);
  });

  it("explains team overload with inspect action", () => {
    const teams: PortfolioPiTeamCapacityRow[] = [
      {
        teamId: "t1",
        teamName: "Platform",
        departmentId: "d1",
        iterationId: "it-1",
        iterationName: "It1",
        ...hours(80, 100, "overload"),
      },
    ];
    const conflict: PortfolioPiConflictRow = {
      type: "TEAM_OVERLOAD",
      severity: "BLOCKER",
      message: "Team overload in iteration",
      subjectType: "TEAM",
      subjectId: "t1",
      relatedIds: ["it-1"],
    };
    const ex = explainConflict(conflict, teams, []);
    expect(ex.actionKind).toBe("expand_team");
    expect(ex.departmentId).toBe("d1");
    expect(ex.affected).toBe("Platform");
    expect(ex.iterationHint).toBe("It1");
    expect(ex.what).toMatch(/exceed available capacity/i);
  });

  it("explains dependency timing with PI dependencies navigation", () => {
    const conflict: PortfolioPiConflictRow = {
      type: "DEPENDENCY_TIMING",
      severity: "WARNING",
      message: "Successor work is scheduled before predecessor",
      subjectType: "DEPENDENCY",
      subjectId: "dep-abc",
      relatedIds: ["wi-1", "wi-2"],
    };
    const ex = explainConflict(conflict, [], []);
    expect(ex.actionKind).toBe("open_dependencies");
    expect(ex.what).toMatch(/PlanningDependency/i);
  });

  it("explains resource overload without inventing remediation", () => {
    const teams: PortfolioPiTeamCapacityRow[] = [
      {
        teamId: "t1",
        teamName: "Platform",
        departmentId: "d1",
        iterationId: "it-1",
        iterationName: "It1",
        ...hours(80, 40),
      },
    ];
    const resources: PortfolioPiResourceCapacityRow[] = [
      {
        resourceId: "r1",
        resourceName: "Shared Dev",
        teamId: "t1",
        iterationId: "it-1",
        membershipAllocationPercent: 50,
        projectSegments: [],
        ...hours(40, 50, "overload"),
      },
    ];
    const conflict: PortfolioPiConflictRow = {
      type: "RESOURCE_OVERLOAD",
      severity: "BLOCKER",
      message: "Resource overload",
      subjectType: "RESOURCE",
      subjectId: "r1",
      relatedIds: ["it-1"],
    };
    const ex = explainConflict(conflict, teams, resources);
    expect(ex.what).toMatch(/membership %/i);
    expect(ex.actionKind).toBe("expand_team");
    expect(ex.affected).toBe("Shared Dev");
  });

  it("detects PI view forbidden messages", () => {
    expect(isPiViewForbiddenMessage("Missing PI view permission.")).toBe(true);
    expect(isPiViewForbiddenMessage("Capacity unavailable")).toBe(false);
  });

  it("maps dependency badges and needed-by formatting", () => {
    expect(criticalityToBadge("CRITICAL")).toBe("blocked");
    expect(dependencyStatusToBadge("OPEN")).toBe("in-progress");
    expect(formatNeededBy(null)).toMatch(/No required-by/i);
    expect(formatNeededBy("2026-11-01T00:00:00.000Z")).toMatch(/2026/);
  });

  it("handles empty dependency list without inventing rows", () => {
    const rows = mapPlanningDependencyRows([], []);
    expect(rows).toEqual([]);
    expect(summarizeDependencyCounts(rows)).toEqual({
      openCount: 0,
      criticalCount: 0,
    });
  });
});
