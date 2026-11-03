import { describe, expect, it } from "vitest";
import {
  ancestorDepartmentIds,
  descendantDepartmentIds,
  isAncestorDepartment,
} from "@/modules/organization/application/department-tree";

const sectionId = "section";
const rows = [
  { id: "inf", sectionId, parentDepartmentId: null },
  { id: "infb", sectionId, parentDepartmentId: "inf" },
  { id: "inff", sectionId, parentDepartmentId: "inf" },
  { id: "ing", sectionId, parentDepartmentId: null },
];

describe("department-tree", () => {
  it("lists ancestors for INFB → INF", () => {
    expect(ancestorDepartmentIds("infb", rows)).toEqual(["inf"]);
    expect(isAncestorDepartment("infb", "inf", rows)).toBe(true);
  });

  it("lists descendants for INF → INFB, INFF", () => {
    expect(descendantDepartmentIds("inf", rows).sort()).toEqual(["infb", "inff"]);
  });
});
