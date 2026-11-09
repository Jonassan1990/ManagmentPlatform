import { AppError } from "@/modules/shared/errors";
import { countWorkingDays, formatDateOnly, toUtcDateOnly } from "./working-days";

/** One working day. Half a day is four hours. */
export const WORKDAY_HOURS = 8;

export type VacationDurationKind = "FULL_DAYS" | "HALF_DAY" | "HOURS";
export type VacationDayPart = "MORNING" | "AFTERNOON";

export type ResolvedVacationDuration = {
  durationKind: VacationDurationKind;
  start: Date;
  end: Date;
  dayPart: VacationDayPart | null;
  hours: number;
  workingDays: number;
};

export function resolveVacationDuration(input: {
  durationKind?: VacationDurationKind | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  dayPart?: string | null;
  hours?: number | null;
}): ResolvedVacationDuration {
  const kind = input.durationKind ?? "FULL_DAYS";
  const start = toUtcDateOnly(input.startDate);

  if (kind === "HALF_DAY") {
    assertWeekday(start, "A half day must be a weekday (Monday–Friday).");
    if (input.dayPart !== "MORNING" && input.dayPart !== "AFTERNOON") {
      throw new AppError(
        "VALIDATION",
        "Choose morning or afternoon for a half day.",
      );
    }
    return {
      durationKind: "HALF_DAY",
      start,
      end: start,
      dayPart: input.dayPart,
      hours: WORKDAY_HOURS / 2,
      workingDays: 0.5,
    };
  }

  if (kind === "HOURS") {
    assertWeekday(start, "Hours must be on a weekday (Monday–Friday).");
    const hours = input.hours;
    if (
      hours == null ||
      !Number.isInteger(hours) ||
      hours < 1 ||
      hours > WORKDAY_HOURS
    ) {
      throw new AppError("VALIDATION", "Enter between 1 and 8 hours.");
    }
    return {
      durationKind: "HOURS",
      start,
      end: start,
      dayPart: null,
      hours,
      workingDays: roundWorkingDays(hours / WORKDAY_HOURS),
    };
  }

  if (!input.endDate) {
    throw new AppError("VALIDATION", "End date is required for full days.");
  }
  const end = toUtcDateOnly(input.endDate);
  if (end.getTime() < start.getTime()) {
    throw new AppError("VALIDATION", "End date must be on or after start date");
  }
  const workingDays = countWorkingDays(start, end);
  if (workingDays < 1) {
    throw new AppError(
      "VALIDATION",
      "Choose a range that includes at least one weekday.",
    );
  }
  return {
    durationKind: "FULL_DAYS",
    start,
    end,
    dayPart: null,
    hours: workingDays * WORKDAY_HOURS,
    workingDays,
  };
}

export function workingDaysInsideRange(
  request: {
    durationKind: VacationDurationKind;
    startDate: Date;
    endDate: Date;
    workingDays: number;
  },
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const start = toUtcDateOnly(request.startDate);
  const end = toUtcDateOnly(request.endDate);
  const rangeFrom = toUtcDateOnly(rangeStart);
  const rangeTo = toUtcDateOnly(rangeEnd);
  if (request.durationKind !== "FULL_DAYS") {
    if (start.getTime() < rangeFrom.getTime() || start.getTime() > rangeTo.getTime()) {
      return 0;
    }
    return request.workingDays;
  }
  const clippedStart = start.getTime() < rangeFrom.getTime() ? rangeFrom : start;
  const clippedEnd = end.getTime() > rangeTo.getTime() ? rangeTo : end;
  return countWorkingDays(clippedStart, clippedEnd);
}

export function formatVacationAmount(input: {
  durationKind: VacationDurationKind;
  workingDays: number;
  hours?: number | null;
  dayPart?: VacationDayPart | null;
}): string {
  if (input.durationKind === "HALF_DAY") {
    const part = input.dayPart === "AFTERNOON" ? "Afternoon" : "Morning";
    return `Half day · ${part} · 0.5 working days`;
  }
  if (input.durationKind === "HOURS") {
    const hours = input.hours ?? input.workingDays * WORKDAY_HOURS;
    const shown = Number.isInteger(hours) ? String(hours) : String(hours);
    return `${shown} hour${hours === 1 ? "" : "s"} · ${formatDayCount(input.workingDays)} working days`;
  }
  return `${formatDayCount(input.workingDays)} working day${input.workingDays === 1 ? "" : "s"}`;
}

export function formatVacationSpan(
  start: Date | string,
  end: Date | string,
  durationKind: VacationDurationKind,
): string {
  const startLabel = dateLabel(start);
  const endLabel = dateLabel(end);
  if (durationKind !== "FULL_DAYS" || startLabel === endLabel) return startLabel;
  return `${startLabel} → ${endLabel}`;
}

export function formatDayCount(days: number): string {
  const rounded = roundWorkingDays(days);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function dateLabel(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return formatDateOnly(value instanceof Date ? value : toUtcDateOnly(value));
}

function assertWeekday(date: Date, message: string) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) {
    throw new AppError("VALIDATION", message);
  }
}

function roundWorkingDays(value: number): number {
  return Math.round(value * 1000) / 1000;
}
