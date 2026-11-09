import { describe, expect, it } from "vitest";
import {
  getSheetDepartment,
  listSheetDepartments,
  parentSheetCode,
  planDepartmentCode,
  sheetPeopleForMonth,
  vacationSheetRoster,
} from "@/modules/vacation/application/vacation-plan-sheet";

describe("2026 vacation plan sheet", () => {
  it("keeps every department sheet separate", () => {
    const codes = listSheetDepartments().map((department) => department.code);
    expect(codes).toContain("INFB");
    expect(codes).toContain("ING");
    expect(new Set(codes).size).toBe(codes.length);
    expect(getSheetDepartment("INFB").people.map((person) => person.name)).not.toEqual(
      getSheetDepartment("ING").people.map((person) => person.name),
    );
  });

  it("reads a vacation block from the INFB sheet", () => {
    const people = sheetPeopleForMonth("INFB", 2026, 9);
    const ivando = people.find((person) => person.name === "Ivando Lossio");
    expect(ivando?.marks).toContainEqual(["2026-09-03", "VACATION"]);
    expect(ivando?.marks).toContainEqual(["2026-09-11", "VACATION"]);
  });

  it("matches a department name to its sheet code", () => {
    expect(planDepartmentCode("INFB — Business apps")).toBe("INFB");
    expect(planDepartmentCode("INA — Architecture & demand")).toBeNull();
  });

  it("uses the sheet people as the department roster", () => {
    const infb = vacationSheetRoster().find((department) => department.code === "INFB");
    const ing = vacationSheetRoster().find((department) => department.code === "ING");
    expect(infb?.people.some((person) => person.name === "Ivando Lossio")).toBe(true);
    expect(ing?.people.some((person) => person.name === "Ivando Lossio")).toBe(false);
    expect(parentSheetCode("INFB")).toBe("INF");
    expect(parentSheetCode("INGL")).toBe("ING");
    expect(parentSheetCode("INF")).toBeNull();
  });
});
