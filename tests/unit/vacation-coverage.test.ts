import { describe, expect, it } from "vitest";
import {
  departmentRoleCoverage,
  formatRoleCoverage,
  visibleDepartmentIds,
} from "@/modules/vacation/application/vacation-coverage";
import type {
  CoverageAbsence,
  CoveragePerson,
} from "@/modules/vacation/application/vacation-coverage";

const infb = "dept-infb";

function person(
  principalId: string,
  displayName: string,
  role: string,
  departmentId = infb,
): CoveragePerson {
  return {
    principalId,
    displayName,
    departmentId,
    departmentName: "INFB — Business apps",
    role,
  };
}

function away(
  principalId: string,
  startDate: string,
  endDate: string,
  status: CoverageAbsence["status"] = "APPROVED",
  durationKind: CoverageAbsence["durationKind"] = "FULL_DAYS",
): CoverageAbsence {
  return {
    principalId,
    departmentId: infb,
    startDate,
    endDate,
    durationKind,
    status,
  };
}

describe("department role coverage", () => {
  it("flags a role when every person is on a full weekday", () => {
    const gaps = departmentRoleCoverage({
      people: [
        person("a", "Ada", "Developer"),
        person("b", "Bo", "Developer"),
        person("c", "Cia", "Tester"),
      ],
      absences: [
        away("a", "2026-11-16", "2026-11-18"),
        away("b", "2026-11-16", "2026-11-18"),
        away("c", "2026-11-16", "2026-11-16"),
      ],
      rangeStart: "2026-11-01",
      rangeEnd: "2026-11-30",
    });
    const developers = gaps.filter((gap) => gap.role === "Developer");
    expect(developers).toHaveLength(1);
    expect(developers[0]).toMatchObject({
      people: 2,
      startDate: "2026-11-16",
      endDate: "2026-11-18",
      waiting: false,
      names: ["Ada", "Bo"],
    });
    expect(formatRoleCoverage(developers[0]!)).toBe(
      "INFB — Business apps · Developer · all 2 away · 2026-11-16 → 2026-11-18",
    );
    expect(gaps.find((gap) => gap.role === "Tester")).toMatchObject({
      people: 1,
      startDate: "2026-11-16",
      endDate: "2026-11-16",
    });
  });

  it("does not flag a role when one person is only on a half day or hours", () => {
    const people = [person("a", "Ada", "Developer"), person("b", "Bo", "Developer")];
    expect(
      departmentRoleCoverage({
        people,
        absences: [
          away("a", "2026-11-16", "2026-11-16"),
          away("b", "2026-11-16", "2026-11-16", "APPROVED", "HALF_DAY"),
        ],
        rangeStart: "2026-11-16",
        rangeEnd: "2026-11-16",
      }),
    ).toEqual([]);
    expect(
      departmentRoleCoverage({
        people,
        absences: [
          away("a", "2026-11-16", "2026-11-16"),
          away("b", "2026-11-16", "2026-11-16", "APPROVED", "HOURS"),
        ],
        rangeStart: "2026-11-16",
        rangeEnd: "2026-11-16",
      }),
    ).toEqual([]);
  });

  it("rolls mixed developer titles into Developers when all are away", () => {
    const gaps = departmentRoleCoverage({
      people: [
        person("a", "Ada", "Developer"),
        person("b", "Bo", "Software Developer"),
        person("c", "Cia", "Front End Developer"),
      ],
      absences: [
        away("a", "2026-11-09", "2026-11-09"),
        away("b", "2026-11-09", "2026-11-09", "SUBMITTED"),
        away("c", "2026-11-09", "2026-11-09"),
      ],
      rangeStart: "2026-11-09",
      rangeEnd: "2026-11-09",
    });
    const family = gaps.find((gap) => gap.kind === "family");
    expect(family).toMatchObject({
      role: "Developers",
      people: 3,
      waiting: true,
      names: ["Ada", "Bo", "Cia"],
    });
    expect(gaps.filter((gap) => gap.kind === "role")).toHaveLength(3);
  });

  it("merges Friday and the following Monday", () => {
    const gaps = departmentRoleCoverage({
      people: [person("a", "Ada", "Developer")],
      absences: [away("a", "2026-11-06", "2026-11-09")],
      rangeStart: "2026-11-06",
      rangeEnd: "2026-11-09",
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      startDate: "2026-11-06",
      endDate: "2026-11-09",
    });
    expect(formatRoleCoverage(gaps[0]!)).toContain("only person away");
  });

  it("keeps departments separate", () => {
    const gaps = departmentRoleCoverage({
      people: [
        person("a", "Ada", "Developer"),
        {
          ...person("b", "Bo", "Developer", "ing"),
          departmentName: "ING — Infrastructure",
        },
      ],
      absences: [away("a", "2026-11-10", "2026-11-10")],
      rangeStart: "2026-11-10",
      rangeEnd: "2026-11-10",
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.departmentId).toBe("dept-infb");
  });

  it("limits department ids to the viewer's sections", () => {
    const ids = visibleDepartmentIds(
      {
        organizationId: "org",
        OR: [
          { requesterPrincipalId: "me" },
          { sectionId: { in: ["section-in"] } },
        ],
      },
      [
        { id: "infb", sectionId: "section-in" },
        { id: "ing", sectionId: "section-other" },
      ],
    );
    expect([...(ids ?? [])]).toEqual(["infb"]);
  });
});
