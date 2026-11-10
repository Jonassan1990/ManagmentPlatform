import { createHash } from "node:crypto";
import { functionRoleAt } from "@/modules/organization/domain/function-roles";
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

export function sheetJob(index: number): string {
  if (index === 0) return "Manager";
  return functionRoleAt(index);
}

export function sheetReferenceCode(code: string, name: string): string {
  const base = `sheet:${code}:${name}`;
  if (base.length <= 100) return base;
  const hash = createHash("sha256").update(base).digest("hex").slice(0, 8);
  return `sheet:${code}:${name.slice(0, 50)}:${hash}`.slice(0, 100);
}

export function codeFromSheetReference(reference: string | null | undefined): string | null {
  if (!reference?.startsWith("sheet:")) return null;
  const rest = reference.slice("sheet:".length);
  const codes = data.departments
    .map((department) => department.code)
    .sort((a, b) => b.length - a.length);
  return codes.find((code) => rest.startsWith(`${code}:`)) ?? null;
}

export function sheetUsername(code: string, index: number, name: string): string {
  const dept = code.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (index === 0) return `sheet.${dept}`.slice(0, 80);
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = `sheet.${dept}.${slug || "person"}`;
  if (base.length <= 80) return base;
  const hash = createHash("sha256").update(base).digest("hex").slice(0, 8);
  return `${base.slice(0, 71)}-${hash}`;
}

export function sheetPrincipalId(reference: string): string {
  const hex = createHash("sha256").update(`principal:${reference}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function groupedSheetDepartments() {
  const rows = listSheetDepartments();
  const inf = [];
  const ing = [];
  const other = [];
  for (const row of rows) {
    const parent = parentSheetCode(row.code);
    if (row.code === "INF" || parent === "INF") inf.push(row);
    else if (row.code === "ING" || parent === "ING") ing.push(row);
    else other.push(row);
  }
  const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);
  inf.sort(byCode);
  ing.sort(byCode);
  other.sort(byCode);
  return [
    { label: "INF", departments: inf },
    { label: "ING", departments: ing },
    { label: "Other departments", departments: other },
  ];
}

export function departmentSheetCode(name: string): string | null {
  const head = name.split("—")[0]?.trim() ?? "";
  if (data.departments.some((department) => department.code === head)) return head;
  return null;
}

/** INF* departments sit under INF, and ING* departments sit under ING. */
export function parentSheetCode(code: string): "INF" | "ING" | null {
  if (code.startsWith("INF") && code !== "INF") return "INF";
  if (code.startsWith("ING") && code !== "ING") return "ING";
  return null;
}

export function vacationSheetRoster() {
  return data.departments.map((department) => ({
    code: department.code,
    people: department.people.map((person) => ({
      name: person.name,
      group: person.group,
      marks: person.marks,
    })),
  }));
}

export function listSheetDepartments() {
  return data.departments.map((department) => ({
    code: department.code,
    people: department.people.length,
    peakMonth: department.peakMonth,
  }));
}

export function planDepartmentCode(name: string): string | null {
  return departmentSheetCode(name);
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
