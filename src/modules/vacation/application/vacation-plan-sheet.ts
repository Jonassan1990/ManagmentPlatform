import planData from "./vacation-plan-2026.json";

export const SHEET_PLAN_KINDS = [
  "VACATION",
  "PROBABLE",
  "EDUCATION",
  "COMPENSATORY",
  "ON_CALL",
  "PARENTAL",
  "OTHER",
] as const;

export type SheetPlanKind = (typeof SHEET_PLAN_KINDS)[number];

export const SHEET_KIND_LABEL: Record<SheetPlanKind, string> = {
  VACATION: "Vacation",
  PROBABLE: "Probably vacation",
  EDUCATION: "Education / business trip",
  COMPENSATORY: "Kompledighet",
  ON_CALL: "Beredskap",
  PARENTAL: "Parental",
  OTHER: "Other",
};

export const SHEET_KIND_COLOR: Record<SheetPlanKind, { background: string; color: string }> = {
  VACATION: { background: "#00B050", color: "#ffffff" },
  PROBABLE: { background: "#CCFFCC", color: "#15202b" },
  EDUCATION: { background: "#0000FF", color: "#ffffff" },
  COMPENSATORY: { background: "#FFFF00", color: "#15202b" },
  ON_CALL: { background: "#000080", color: "#ffffff" },
  PARENTAL: { background: "#00FFFF", color: "#15202b" },
  OTHER: { background: "#A02B93", color: "#ffffff" },
};

type RawPerson = {
  name: string;
  group: string | null;
  marks: [string, SheetPlanKind][];
};

type RawDepartment = {
  code: string;
  peakMonth: number;
  people: RawPerson[];
};

const data = planData as {
  year: number;
  departments: RawDepartment[];
};

export function listSheetDepartments() {
  return data.departments.map((department) => ({
    code: department.code,
    people: department.people.length,
    peakMonth: department.peakMonth,
  }));
}

export function planDepartmentCode(name: string): string | null {
  const code = name.split("—")[0]?.trim() ?? "";
  return data.departments.some((department) => department.code === code) ? code : null;
}

export function getSheetDepartment(code: string | undefined) {
  return (
    data.departments.find((department) => department.code === code) ??
    data.departments.find((department) => department.code === "INFB") ??
    data.departments[0]!
  );
}

export function sheetMonthCounts(code: string, year: number): number[] {
  const department = getSheetDepartment(code);
  const counts = Array.from({ length: 12 }, () => 0);
  const prefix = `${year}-`;
  for (const person of department.people) {
    for (const [day] of person.marks) {
      if (!day.startsWith(prefix)) continue;
      const month = Number(day.slice(5, 7));
      if (month >= 1 && month <= 12) counts[month - 1] += 1;
    }
  }
  return counts;
}

export function sheetPeopleForMonth(code: string, year: number, month: number) {
  const department = getSheetDepartment(code);
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return department.people.map((person) => ({
    name: person.name,
    group: person.group,
    marks: person.marks.filter(([day]) => day.startsWith(prefix)),
  }));
}
