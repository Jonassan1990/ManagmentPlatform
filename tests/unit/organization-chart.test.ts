import { describe, expect, it } from "vitest";
import {
  buildOrganizationChart,
  buildPeopleHierarchy,
  nestChildOrganizations,
} from "@/modules/organization/application/organization-chart";

const orgId = "11111111-1111-4111-8111-111111111111";
const sectionId = "22222222-2222-4222-8222-222222222222";
const departmentId = "33333333-3333-4333-8333-333333333333";
const teamId = "44444444-4444-4444-8444-444444444444";

describe("buildOrganizationChart", () => {
  it("uses the organization admin as owner and a role lead on the team", () => {
    const chart = buildOrganizationChart({
      organization: {
        id: orgId,
        name: "Nordic Demo Manufacturing",
        description: "Demo",
      },
      sections: [
        {
          id: sectionId,
          name: "Operations",
          departments: [
            {
              id: departmentId,
              name: "Plant A",
              teams: [{ id: teamId, name: "Line 2" }],
            },
          ],
        },
      ],
      people: [
        {
          id: "sara",
          name: "Sara Lind",
          role: "Plant Manager",
          memberships: [{ teamId, isPrimary: true }],
        },
        {
          id: "viktor",
          name: "Viktor Ek",
          role: "OT Engineer",
          memberships: [{ teamId, isPrimary: false }],
        },
      ],
      bindings: [
        {
          scopeType: "ORGANIZATION",
          scopeId: orgId,
          name: "Demo User",
          roleKey: "organization.admin",
        },
      ],
    });

    expect(chart.owner).toMatchObject({ name: "Demo User", kind: "owner" });
    expect(chart.sections[0]?.owner).toMatchObject({
      name: "Sara Lind",
      kind: "manager",
      title: "Plant Manager",
    });
    expect(chart.sections[0]?.departments[0]?.teams[0]?.members).toHaveLength(2);
    expect(chart.sections[0]?.departments[0]?.people.map((person) => person.name)).toEqual([
      "Sara Lind",
      "Viktor Ek",
    ]);
    expect(chart.sections[0]?.departments[0]?.counts).toEqual({
      resources: 2,
      projects: 0,
      initiatives: 0,
    });
    expect(chart.sections[0]?.departments[0]?.parentDepartmentId).toBeNull();
    expect(chart.sections[0]?.departments[0]?.children).toEqual([]);
    expect(chart.unassigned).toEqual([]);
    expect(chart.counts).toEqual({
      sections: 1,
      departments: 1,
      teams: 1,
      people: 2,
    });
  });

  it("nests child departments under a parent department", () => {
    const childDept = "55555555-5555-4555-8555-555555555555";
    const chart = buildOrganizationChart({
      organization: { id: orgId, name: "I", description: null },
      sections: [
        {
          id: sectionId,
          name: "IN",
          departments: [
            {
              id: departmentId,
              name: "INF",
              parentDepartmentId: null,
              teams: [],
              initiativeCount: 1,
              projectCount: 0,
            },
            {
              id: childDept,
              name: "INFB",
              parentDepartmentId: departmentId,
              teams: [{ id: teamId, name: "Team A" }],
              initiativeCount: 2,
              projectCount: 1,
            },
          ],
        },
      ],
      people: [],
      bindings: [],
    });

    expect(chart.sections[0]?.departments).toHaveLength(1);
    expect(chart.sections[0]?.departments[0]?.name).toBe("INF");
    expect(chart.sections[0]?.departments[0]?.children).toHaveLength(1);
    expect(chart.sections[0]?.departments[0]?.children[0]?.name).toBe("INFB");
    expect(chart.counts.departments).toBe(2);
  });

  it("keeps a department parent cycle from looping the chart", () => {
    const otherId = "66666666-6666-4666-8666-666666666666";
    const chart = buildOrganizationChart({
      organization: { id: orgId, name: "I", description: null },
      sections: [
        {
          id: sectionId,
          name: "IN",
          departments: [
            {
              id: departmentId,
              name: "A",
              parentDepartmentId: otherId,
              teams: [],
            },
            {
              id: otherId,
              name: "B",
              parentDepartmentId: departmentId,
              teams: [],
            },
          ],
        },
      ],
      people: [],
      bindings: [],
    });
    expect(chart.counts.departments).toBe(2);
    expect(chart.sections[0]?.departments.length).toBeGreaterThan(0);
  });

  it("carries initiative and project counts onto departments", () => {
    const chart = buildOrganizationChart({
      organization: { id: orgId, name: "Nordic", description: null },
      sections: [
        {
          id: sectionId,
          name: "Operations",
          departments: [
            {
              id: departmentId,
              name: "Plant A",
              teams: [{ id: teamId, name: "Line 2" }],
              initiativeCount: 3,
              projectCount: 2,
            },
          ],
        },
      ],
      people: [],
      bindings: [],
    });

    expect(chart.sections[0]?.departments[0]?.counts).toEqual({
      resources: 0,
      projects: 2,
      initiatives: 3,
    });
  });

  it("builds a people hierarchy under each department manager", () => {
    const chart = buildOrganizationChart({
      organization: { id: orgId, name: "Nordic", description: null },
      sections: [
        {
          id: sectionId,
          name: "Operations",
          departments: [
            {
              id: departmentId,
              name: "Plant A",
              teams: [{ id: teamId, name: "Line 2" }],
            },
          ],
        },
      ],
      people: [
        {
          id: "sara",
          name: "Sara Lind",
          role: "Plant Manager",
          memberships: [{ teamId, isPrimary: true }],
        },
        {
          id: "viktor",
          name: "Viktor Ek",
          role: "OT Engineer",
          memberships: [{ teamId, isPrimary: false }],
        },
      ],
      bindings: [
        {
          scopeType: "DEPARTMENT",
          scopeId: departmentId,
          name: "Sara Lind",
          roleKey: "department.manager",
        },
      ],
    });

    const people = buildPeopleHierarchy(chart);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      managerName: "Sara Lind",
      departmentName: "Plant A",
    });
    expect(people[0]?.employees.map((person) => person.name)).toEqual(["Viktor Ek"]);
  });

  it("prefers an explicit team manager over the inferred lead", () => {
    const chart = buildOrganizationChart({
      organization: { id: orgId, name: "QD", description: null },
      sections: [
        {
          id: sectionId,
          name: "Ops",
          departments: [
            {
              id: departmentId,
              name: "Plant",
              teams: [{ id: teamId, name: "Line" }],
            },
          ],
        },
      ],
      people: [
        {
          id: "sara",
          name: "Sara Lind",
          role: "Plant Manager",
          memberships: [{ teamId, isPrimary: true }],
        },
      ],
      bindings: [
        {
          scopeType: "TEAM",
          scopeId: teamId,
          name: "Assigned Manager",
          roleKey: "team.manager",
        },
      ],
    });

    expect(chart.sections[0]?.departments[0]?.teams[0]?.owner).toMatchObject({
      name: "Assigned Manager",
      kind: "manager",
    });
    expect(chart.owner).toBeNull();
  });
});

describe("nestChildOrganizations", () => {
  it("connects Q to QD, QM, and QC, and QC to QCM and QCF", () => {
    const tree = nestChildOrganizations(
      "q",
      [
        { id: "q", name: "Q", parentOrganizationId: null },
        { id: "qd", name: "QD", parentOrganizationId: "q" },
        { id: "qm", name: "QM", parentOrganizationId: "q" },
        { id: "qc", name: "QC", parentOrganizationId: "q" },
        { id: "qcm", name: "QCM", parentOrganizationId: "qc" },
        { id: "qcf", name: "QCF", parentOrganizationId: "qc" },
      ],
      [],
    );

    expect(tree.map((node) => node.name)).toEqual(["QC", "QD", "QM"]);
    expect(tree.find((node) => node.name === "QC")?.children.map((node) => node.name)).toEqual([
      "QCF",
      "QCM",
    ]);
  });
});