import { describe, expect, it } from "vitest";
import {
  aggregateResourcesByTeam,
  bandTone,
  buildDepartmentCards,
  buildProjectStackSegments,
  capacityStatusLabel,
  committedLoadBarPct,
  filterDepartmentCards,
  formatCapacityHours,
  formatUtilizationPct,
  initials,
} from "@/components/portfolio/portfolio-capacity-model";
import type {
  PortfolioPiDepartmentCapacityRow,
  PortfolioPiResourceCapacityRow,
  PortfolioPiTeamCapacityRow,
} from "@/modules/portfolio/domain/types";

function hours(
  available: number,
  committed: number,
  band: PortfolioPiTeamCapacityRow["band"] = "ok",
) {
  return {
    availableHours: available,
    committedHours: committed,
    remainingHours: available - committed,
    utilization: available > 0 ? committed / available : null,
    band,
  };
}

describe("portfolio capacity display helpers", () => {
  it("formats hours and utilization without inventing zeros for null util", () => {
    expect(formatCapacityHours(12.34)).toBe("12.3");
    expect(formatCapacityHours(10)).toBe("10");
    expect(formatUtilizationPct(null)).toBe("—");
    expect(formatUtilizationPct(0.82)).toBe("82%");
    expect(formatUtilizationPct(Number.POSITIVE_INFINITY)).toBe("∞");
  });

  it("maps bands to overload labels", () => {
    expect(bandTone("overload")).toBe("over");
    expect(capacityStatusLabel("overload")).toBe("Over capacity");
    expect(capacityStatusLabel("near")).toBe("Near limit");
  });

  it("builds committed load bar from available/committed only", () => {
    expect(committedLoadBarPct(100, 40)).toEqual({
      committedPct: 40,
      scale: "available",
    });
    expect(committedLoadBarPct(0, 0).scale).toBe("empty");
    expect(committedLoadBarPct(0, 10)).toEqual({
      committedPct: 100,
      scale: "committed",
    });
  });

  it("aggregates resource iterations and builds department cards", () => {
    const teams: PortfolioPiTeamCapacityRow[] = [
      {
        teamId: "t1",
        teamName: "Team A",
        departmentId: "d1",
        iterationId: "i1",
        iterationName: "It1",
        ...hours(80, 100, "overload"),
      },
      {
        teamId: "t1",
        teamName: "Team A",
        departmentId: "d1",
        iterationId: "i2",
        iterationName: "It2",
        ...hours(80, 20, "under"),
      },
    ];
    const resources: PortfolioPiResourceCapacityRow[] = [
      {
        resourceId: "r1",
        resourceName: "Dev A",
        teamId: "t1",
        iterationId: "i1",
        membershipAllocationPercent: 100,
        projectSegments: [
          {
            projectId: "p1",
            initiativeId: "init-1",
            referenceKey: "PRJ-1",
            name: "Alpha",
            href: "/initiatives/init-1/project",
            committedHours: 60,
          },
          {
            projectId: "p2",
            initiativeId: "init-2",
            referenceKey: "PRJ-2",
            name: "Beta",
            href: "/initiatives/init-2/project",
            committedHours: 40,
          },
        ],
        ...hours(80, 100, "overload"),
      },
      {
        resourceId: "r1",
        resourceName: "Dev A",
        teamId: "t1",
        iterationId: "i2",
        membershipAllocationPercent: 100,
        projectSegments: [
          {
            projectId: "p1",
            initiativeId: "init-1",
            referenceKey: "PRJ-1",
            name: "Alpha",
            href: "/initiatives/init-1/project",
            committedHours: 20,
          },
        ],
        ...hours(80, 20, "under"),
      },
    ];
    const departments: PortfolioPiDepartmentCapacityRow[] = [
      {
        departmentId: "d1",
        departmentName: "Dept A",
        ...hours(160, 120, "ok"),
      },
    ];

    const aggregated = aggregateResourcesByTeam(resources, teams);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]!.availableHours).toBe(160);
    expect(aggregated[0]!.committedHours).toBe(120);
    expect(aggregated[0]!.band).toBe("ok");
    expect(aggregated[0]!.projectSegments).toEqual([
      expect.objectContaining({ projectId: "p1", committedHours: 80 }),
      expect.objectContaining({ projectId: "p2", committedHours: 40 }),
    ]);

    const cards = buildDepartmentCards(departments, teams, resources);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.teamCount).toBe(1);
    expect(cards[0]!.resourceCount).toBe(1);
    expect(cards[0]!.overloadCount).toBe(0);
  });

  it("filters overloaded and search without expanding scope", () => {
    const departments: PortfolioPiDepartmentCapacityRow[] = [
      {
        departmentId: "d1",
        departmentName: "Alpha",
        ...hours(100, 50),
      },
      {
        departmentId: "d2",
        departmentName: "Beta",
        ...hours(100, 120, "overload"),
      },
    ];
    const teams: PortfolioPiTeamCapacityRow[] = [
      {
        teamId: "t1",
        teamName: "Team Alpha",
        departmentId: "d1",
        iterationId: "i1",
        iterationName: "It1",
        ...hours(100, 50),
      },
      {
        teamId: "t2",
        teamName: "Team Beta",
        departmentId: "d2",
        iterationId: "i1",
        iterationName: "It1",
        ...hours(100, 120, "overload"),
      },
    ];
    const resources: PortfolioPiResourceCapacityRow[] = [
      {
        resourceId: "r1",
        resourceName: "Alice",
        teamId: "t1",
        iterationId: "i1",
        membershipAllocationPercent: 100,
        projectSegments: [],
        ...hours(100, 50),
      },
      {
        resourceId: "r2",
        resourceName: "Bob",
        teamId: "t2",
        iterationId: "i1",
        membershipAllocationPercent: 100,
        projectSegments: [],
        ...hours(100, 120, "overload"),
      },
    ];
    const cards = buildDepartmentCards(departments, teams, resources);
    const overloaded = filterDepartmentCards(cards, { overloadedOnly: true });
    expect(overloaded.map((c) => c.departmentId)).toEqual(["d2"]);

    const search = filterDepartmentCards(cards, { search: "alice" });
    expect(search).toHaveLength(1);
    expect(search[0]!.departmentId).toBe("d1");
  });

  it("builds initials for avatars", () => {
    expect(initials("Lina Andersson")).toBe("LA");
  });

  it("builds project stack segments from real hours (no FTE invention)", () => {
    const segments = buildProjectStackSegments(100, [
      {
        projectId: "p1",
        initiativeId: "i1",
        referenceKey: "PRJ-1",
        name: "Core",
        href: "/initiatives/i1/project",
        committedHours: 40,
      },
      {
        projectId: "p2",
        initiativeId: "i2",
        referenceKey: "PRJ-2",
        name: "Support",
        href: "/initiatives/i2/project",
        committedHours: 20,
      },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]!.widthPct).toBe(40);
    expect(segments[1]!.widthPct).toBe(20);
    expect(segments.every((s) => s.color.length > 0)).toBe(true);
    expect(buildProjectStackSegments(0, [])).toEqual([]);
  });

  it("keeps shared-resource membership rows separate per team (no double full capacity)", () => {
    const teams: PortfolioPiTeamCapacityRow[] = [
      {
        teamId: "t1",
        teamName: "Team A",
        departmentId: "d1",
        iterationId: "i1",
        iterationName: "It1",
        ...hours(40, 30),
      },
      {
        teamId: "t2",
        teamName: "Team B",
        departmentId: "d1",
        iterationId: "i1",
        iterationName: "It1",
        ...hours(40, 20),
      },
    ];
    const resources: PortfolioPiResourceCapacityRow[] = [
      {
        resourceId: "shared",
        resourceName: "Shared Dev",
        teamId: "t1",
        iterationId: "i1",
        membershipAllocationPercent: 50,
        projectSegments: [],
        ...hours(40, 30),
      },
      {
        resourceId: "shared",
        resourceName: "Shared Dev",
        teamId: "t2",
        iterationId: "i1",
        membershipAllocationPercent: 50,
        projectSegments: [],
        ...hours(40, 20),
      },
    ];
    const departments: PortfolioPiDepartmentCapacityRow[] = [
      {
        departmentId: "d1",
        departmentName: "Dept",
        ...hours(80, 50),
      },
    ];

    const aggregated = aggregateResourcesByTeam(resources, teams);
    expect(aggregated).toHaveLength(2);
    expect(aggregated.every((r) => r.membershipAllocationPercent === 50)).toBe(
      true,
    );
    // Display sums returned hours only — does not invent 100% per team.
    expect(aggregated.reduce((n, r) => n + r.availableHours, 0)).toBe(80);

    const cards = buildDepartmentCards(departments, teams, resources);
    expect(cards[0]!.resourceCount).toBe(2);
    expect(
      cards[0]!.teams.flatMap((t) => t.resources).map((r) => r.teamId).sort(),
    ).toEqual(["t1", "t2"]);
  });
});
