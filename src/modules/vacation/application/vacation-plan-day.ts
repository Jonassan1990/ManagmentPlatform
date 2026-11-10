import type { CoverageAbsence } from "./vacation-coverage";
import type { SheetPlanKind } from "./vacation-plan-sheet";

export const AWAY_PLAN_KINDS = new Set<SheetPlanKind>([
  "VACATION",
  "PROBABLE",
  "EDUCATION",
  "COMPENSATORY",
  "PARENTAL",
  "OTHER",
]);

export type StoredPlanKind =
  | "VACATION"
  | "EDUCATION"
  | "COMPENSATORY"
  | "ON_CALL"
  | "PARENTAL"
  | "IN_OFFICE";

export type ShownPlanKind = SheetPlanKind | "PARTIAL" | "WAITING";

export type PlanRequest = {
  duration: "FULL_DAYS" | "HALF_DAY" | "HOURS";
  status: "APPROVED" | "SUBMITTED" | "CHANGES_REQUESTED";
};

/**
 * One day on the department plan.
 * A waiting request stays visible until it is approved.
 * A saved mark replaces the sheet. In the office hides the sheet color.
 */
export function resolvePlanDay(input: {
  sheet: SheetPlanKind | null;
  mark: StoredPlanKind | null;
  request: PlanRequest | null;
}): { kind: ShownPlanKind | null; waiting: boolean } {
  const request = input.request;
  if (request && request.status !== "APPROVED") {
    if (request.duration === "FULL_DAYS") return { kind: "WAITING", waiting: true };
    return { kind: "PARTIAL", waiting: true };
  }
  if (input.mark === "IN_OFFICE") return { kind: null, waiting: false };
  if (input.mark && input.mark !== "ON_CALL") {
    return { kind: input.mark, waiting: false };
  }
  if (input.mark === "ON_CALL") return { kind: "ON_CALL", waiting: false };
  if (request?.duration === "FULL_DAYS") return { kind: "VACATION", waiting: false };
  if (request) return { kind: "PARTIAL", waiting: false };
  if (input.sheet) return { kind: input.sheet, waiting: false };
  return { kind: null, waiting: false };
}

export function buildPlanAbsences(input: {
  people: Array<{
    principalId: string;
    departmentId: string;
    referenceCode: string | null;
    sheetMarks: Array<[string, SheetPlanKind]>;
  }>;
  marks: Array<{ principalId: string; date: string; kind: StoredPlanKind }>;
  requests: CoverageAbsence[];
  rangeStart: string;
  rangeEnd: string;
}): CoverageAbsence[] {
  const markByKey = new Map(
    input.marks.map((mark) => [`${mark.principalId}:${mark.date}`, mark.kind]),
  );
  const pending = new Set<string>();
  for (const request of input.requests) {
    if (request.durationKind !== "FULL_DAYS" || request.status === "APPROVED") continue;
    for (const date of eachIsoDate(request.startDate, request.endDate)) {
      if (date < input.rangeStart || date > input.rangeEnd) continue;
      pending.add(`${request.principalId}:${date}`);
    }
  }

  const absences: CoverageAbsence[] = [];
  for (const person of input.people) {
    const dates = new Set<string>();
    for (const [date, kind] of person.sheetMarks) {
      if (date < input.rangeStart || date > input.rangeEnd) continue;
      if (AWAY_PLAN_KINDS.has(kind)) dates.add(date);
    }
    for (const [key, kind] of markByKey) {
      if (!key.startsWith(`${person.principalId}:`)) continue;
      const date = key.slice(person.principalId.length + 1);
      if (date < input.rangeStart || date > input.rangeEnd) continue;
      if (kind === "IN_OFFICE" || kind === "ON_CALL") dates.delete(date);
      else dates.add(date);
    }
    for (const date of dates) {
      if (pending.has(`${person.principalId}:${date}`)) continue;
      absences.push({
        principalId: person.principalId,
        departmentId: person.departmentId,
        startDate: date,
        endDate: date,
        durationKind: "FULL_DAYS",
        status: "APPROVED",
      });
    }
  }
  return absences;
}

function eachIsoDate(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`).getTime();
  while (cursor.getTime() <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
