import { describe, expect, it } from "vitest";
import { selectClosestApprovers } from "@/modules/vacation/application/vacation-approvers";

describe("vacation approvers", () => {
  it("picks the department manager and leaves section and organization managers out", () => {
    expect(
      selectClosestApprovers({
        departmentId: "infb",
        sectionId: "in",
        parentDepartmentIds: ["inf"],
        candidates: [
          {
            principalId: "org",
            displayName: "Alex Org Admin",
            roleName: "Organization Admin",
            scopeType: "ORGANIZATION",
            scopeId: "org",
          },
          {
            principalId: "section",
            displayName: "Sam IN Manager",
            roleName: "Section Manager",
            scopeType: "SECTION",
            scopeId: "in",
          },
          {
            principalId: "parent",
            displayName: "Ira INF Manager",
            roleName: "Department Manager",
            scopeType: "DEPARTMENT",
            scopeId: "inf",
          },
          {
            principalId: "dept",
            displayName: "Bo INFB Manager",
            roleName: "Department Manager",
            scopeType: "DEPARTMENT",
            scopeId: "infb",
          },
        ],
      }),
    ).toEqual([
      {
        principalId: "dept",
        displayName: "Bo INFB Manager",
        email: null,
        roleName: "Department Manager",
      },
    ]);
  });

  it("uses the section manager when the department has no manager", () => {
    expect(
      selectClosestApprovers({
        departmentId: "infb",
        sectionId: "in",
        parentDepartmentIds: [],
        candidates: [
          {
            principalId: "section",
            displayName: "Sam IN Manager",
            roleName: "Section Manager",
            scopeType: "SECTION",
            scopeId: "in",
          },
          {
            principalId: "org",
            displayName: "Alex Org Admin",
            roleName: "Organization Admin",
            scopeType: "ORGANIZATION",
            scopeId: "org",
          },
        ],
      }).map((approver) => approver.displayName),
    ).toEqual(["Sam IN Manager"]);
  });
});
