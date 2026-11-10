import { describe, expect, it } from "vitest";
import { departmentDayCover } from "@/modules/vacation/application/vacation-coverage";
import { buildPlanAbsences, resolvePlanDay } from "@/modules/vacation/application/vacation-plan-day";
import {
  codeFromSheetReference,
  groupedSheetDepartments,
  sheetJob,
  sheetReferenceCode,
  sheetUsername,
  vacationSheetRoster,
} from "@/modules/vacation/application/vacation-plan-sheet";
import { swedishHolidayName } from "@/modules/vacation/application/swedish-holidays";

describe("vacation plan day", () => {
  it("keeps a waiting request above the sheet and a saved mark", () => {
    expect(
      resolvePlanDay({
        sheet: "VACATION",
        mark: "EDUCATION",
        request: { duration: "FULL_DAYS", status: "SUBMITTED" },
      }),
    ).toEqual({ kind: "WAITING", waiting: true });
  });

  it("lets in the office hide the sheet color", () => {
    expect(
      resolvePlanDay({
        sheet: "VACATION",
        mark: "IN_OFFICE",
        request: null,
      }).kind,
    ).toBeNull();
  });

  it("shows on call instead of the sheet", () => {
    expect(
      resolvePlanDay({
        sheet: "VACATION",
        mark: "ON_CALL",
        request: null,
      }).kind,
    ).toBe("ON_CALL");
  });

  it("shows an approved full day as vacation", () => {
    expect(
      resolvePlanDay({
        sheet: null,
        mark: null,
        request: { duration: "FULL_DAYS", status: "APPROVED" },
      }).kind,
    ).toBe("VACATION");
  });

  it("keeps the sheet color when nothing else is saved", () => {
    expect(
      resolvePlanDay({ sheet: "VACATION", mark: null, request: null }).kind,
    ).toBe("VACATION");
  });

  it("shows a partial request without covering the whole day", () => {
    expect(
      resolvePlanDay({
        sheet: null,
        mark: null,
        request: { duration: "HALF_DAY", status: "SUBMITTED" },
      }),
    ).toEqual({ kind: "PARTIAL", waiting: true });
  });

  it("does not treat a pending full day as already away", () => {
    const absences = buildPlanAbsences({
      people: [
        {
          principalId: "p",
          departmentId: "infb",
          referenceCode: "sheet:INFB:Ada",
          sheetMarks: [["2026-11-10", "VACATION"]],
        },
      ],
      marks: [],
      requests: [
        {
          principalId: "p",
          departmentId: "infb",
          startDate: "2026-11-10",
          endDate: "2026-11-10",
          durationKind: "FULL_DAYS",
          status: "SUBMITTED",
        },
      ],
      rangeStart: "2026-11-01",
      rangeEnd: "2026-11-30",
    });
    expect(absences).toEqual([]);
  });

  it("drops a sheet day that was marked in the office", () => {
    const absences = buildPlanAbsences({
      people: [
        {
          principalId: "p",
          departmentId: "infb",
          referenceCode: "sheet:INFB:Ada",
          sheetMarks: [["2026-11-10", "VACATION"]],
        },
      ],
      marks: [{ principalId: "p", date: "2026-11-10", kind: "IN_OFFICE" }],
      requests: [],
      rangeStart: "2026-11-01",
      rangeEnd: "2026-11-30",
    });
    expect(absences).toEqual([]);
  });
});

describe("swedish holidays", () => {
  it("names the Swedish new year and Epiphany", () => {
    expect(swedishHolidayName("2026-01-01")).toBe("Nyårsdagen");
    expect(swedishHolidayName("2026-01-06")).toBe("Trettondedag jul");
    expect(swedishHolidayName("2026-01-07")).toBeNull();
  });

  it("closes a public holiday on role cover", () => {
    const days = departmentDayCover({
      people: [
        {
          principalId: "a",
          displayName: "Ada",
          role: "Developer",
          departmentId: "infb",
          departmentName: "INFB",
        },
      ],
      absences: [],
      rangeStart: "2026-01-06",
      rangeEnd: "2026-01-06",
    });
    expect(days[0]?.tone).toBe("closed");
  });
});

describe("sheet people", () => {
  it("names the first person manager and builds a short login", () => {
    expect(sheetJob(0)).toBe("Manager");
    expect(sheetUsername("INFB", 0, "Ivando Lossio")).toBe("sheet.infb");
    expect(codeFromSheetReference("sheet:IN MT:Someone")).toBe("IN MT");
    expect(groupedSheetDepartments().map((group) => group.label)).toEqual([
      "INF",
      "ING",
      "Other departments",
    ]);
  });

  it("gives every sheet person a unique login and reference", () => {
    const usernames = new Set<string>();
    const references = new Set<string>();
    for (const department of vacationSheetRoster()) {
      department.people.forEach((person, index) => {
        usernames.add(sheetUsername(department.code, index, person.name));
        references.add(sheetReferenceCode(department.code, person.name));
      });
    }
    const people = vacationSheetRoster().reduce(
      (sum, department) => sum + department.people.length,
      0,
    );
    expect(usernames.size).toBe(people);
    expect(references.size).toBe(people);
  });
});
