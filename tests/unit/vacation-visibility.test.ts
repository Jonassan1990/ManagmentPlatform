import { describe, expect, it } from "vitest";
import { vacationVisibilityFilter } from "@/modules/vacation/application/vacation-visibility";

const departments = [
  { id: "inf", sectionId: "in", parentDepartmentId: null },
  { id: "infb", sectionId: "in", parentDepartmentId: "inf" },
  { id: "inff", sectionId: "in", parentDepartmentId: "inf" },
];

describe("vacation visibility", () => {
  it("keeps an organization-wide reader on the whole organization", () => {
    expect(
      vacationVisibilityFilter({
        organizationId: "org",
        principalId: "person",
        bindings: [{ scopeType: "ORGANIZATION", scopeId: "org" }],
        teamDepartmentIds: [],
        departments,
      }),
    ).toEqual({ organizationId: "org" });
  });

  it("includes a section, a department and its children, and the person's own requests", () => {
    expect(
      vacationVisibilityFilter({
        organizationId: "org",
        principalId: "person",
        bindings: [
          { scopeType: "SECTION", scopeId: "in" },
          { scopeType: "DEPARTMENT", scopeId: "inf" },
        ],
        teamDepartmentIds: ["ing"],
        departments: [
          ...departments,
          { id: "ing", sectionId: "in", parentDepartmentId: null },
        ],
      }),
    ).toEqual({
      organizationId: "org",
      OR: [
        { requesterPrincipalId: "person" },
        { sectionId: { in: ["in"] } },
        { departmentId: { in: ["inf", "ing", "inff", "infb"] } },
      ],
    });
  });
});
