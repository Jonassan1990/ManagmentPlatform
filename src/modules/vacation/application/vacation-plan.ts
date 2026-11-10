export const VACATION_PLAN_KINDS = [
  "VACATION",
  "EDUCATION",
  "COMPENSATORY",
  "ON_CALL",
  "PARENTAL",
] as const;

export type VacationPlanKindName = (typeof VACATION_PLAN_KINDS)[number];

export type PlanCellKind = VacationPlanKindName | "PARTIAL";

export const PLAN_KIND_LABEL: Record<PlanCellKind, string> = {
  VACATION: "Vacation",
  EDUCATION: "Education / business trip",
  COMPENSATORY: "Kompledighet",
  ON_CALL: "Beredskap",
  PARENTAL: "Parental",
  PARTIAL: "Part of the day",
};

/** Colors taken from the 2026 vacation-plan legend. */
export const PLAN_KIND_COLOR: Record<PlanCellKind, { background: string; color: string }> = {
  VACATION: { background: "#00B050", color: "#ffffff" },
  EDUCATION: { background: "#0000FF", color: "#ffffff" },
  COMPENSATORY: { background: "#FFFF00", color: "#15202b" },
  ON_CALL: { background: "#000080", color: "#ffffff" },
  PARENTAL: { background: "#00FFFF", color: "#15202b" },
  PARTIAL: { background: "#fff4df", color: "#9a3412" },
};

export function planCellKind(input: {
  mark: VacationPlanKindName | "IN_OFFICE" | null;
  request: "FULL_DAYS" | "HALF_DAY" | "HOURS" | null;
}): PlanCellKind | null {
  if (input.mark === "IN_OFFICE") return null;
  if (input.mark) return input.mark;
  if (input.request === "FULL_DAYS") return "VACATION";
  if (input.request === "HALF_DAY" || input.request === "HOURS") return "PARTIAL";
  return null;
}
