import { describe, expect, it } from "vitest";
import { AppError } from "@/modules/shared/errors";
import {
  formatVacationAmount,
  formatVacationSpan,
  resolveVacationDuration,
  workingDaysInsideRange,
} from "@/modules/vacation/application/vacation-duration";
import { toUtcDateOnly } from "@/modules/vacation/application/working-days";

describe("vacation duration", () => {
  it("counts a full weekday range as 8-hour days", () => {
    const amount = resolveVacationDuration({
      startDate: "2026-11-06",
      endDate: "2026-11-09",
    });
    expect(amount.durationKind).toBe("FULL_DAYS");
    expect(amount.workingDays).toBe(2);
    expect(amount.hours).toBe(16);
  });

  it("rejects a weekend-only full-day range", () => {
    expect(() =>
      resolveVacationDuration({
        durationKind: "FULL_DAYS",
        startDate: "2026-11-07",
        endDate: "2026-11-08",
      }),
    ).toThrow(AppError);
  });

  it("resolves a morning half day to 4 hours", () => {
    const amount = resolveVacationDuration({
      durationKind: "HALF_DAY",
      startDate: "2026-11-10",
      dayPart: "MORNING",
    });
    expect(amount).toMatchObject({
      durationKind: "HALF_DAY",
      dayPart: "MORNING",
      hours: 4,
      workingDays: 0.5,
    });
    expect(amount.start.getTime()).toBe(amount.end.getTime());
    expect(formatVacationAmount(amount)).toBe(
      "Half day · Morning · 0.5 working days",
    );
    expect(formatVacationSpan(amount.start, amount.end, amount.durationKind)).toBe(
      "2026-11-10",
    );
  });

  it("rejects a half day on Saturday", () => {
    expect(() =>
      resolveVacationDuration({
        durationKind: "HALF_DAY",
        startDate: "2026-11-07",
        dayPart: "AFTERNOON",
      }),
    ).toThrow(/weekday/);
  });

  it("requires morning or afternoon for a half day", () => {
    expect(() =>
      resolveVacationDuration({
        durationKind: "HALF_DAY",
        startDate: "2026-11-10",
      }),
    ).toThrow(/morning or afternoon/);
  });

  it("resolves whole hours against an 8-hour day", () => {
    const one = resolveVacationDuration({
      durationKind: "HOURS",
      startDate: "2026-11-10",
      hours: 1,
    });
    expect(one.workingDays).toBe(0.125);
    expect(formatVacationAmount(one)).toBe("1 hour · 0.125 working days");

    const three = resolveVacationDuration({
      durationKind: "HOURS",
      startDate: "2026-11-10",
      hours: 3,
    });
    expect(three.workingDays).toBe(0.375);
    expect(formatVacationAmount(three)).toBe("3 hours · 0.375 working days");
  });

  it("rejects hours outside 1–8 and weekend hours", () => {
    expect(() =>
      resolveVacationDuration({
        durationKind: "HOURS",
        startDate: "2026-11-10",
        hours: 0,
      }),
    ).toThrow(/1 and 8/);
    expect(() =>
      resolveVacationDuration({
        durationKind: "HOURS",
        startDate: "2026-11-08",
        hours: 2,
      }),
    ).toThrow(/weekday/);
  });

  it("keeps a half day inside the year total and ignores it outside", () => {
    const request = {
      durationKind: "HALF_DAY" as const,
      startDate: toUtcDateOnly("2026-11-10"),
      endDate: toUtcDateOnly("2026-11-10"),
      workingDays: 0.5,
    };
    expect(
      workingDaysInsideRange(
        request,
        toUtcDateOnly("2026-01-01"),
        toUtcDateOnly("2026-12-31"),
      ),
    ).toBe(0.5);
    expect(
      workingDaysInsideRange(
        request,
        toUtcDateOnly("2027-01-01"),
        toUtcDateOnly("2027-12-31"),
      ),
    ).toBe(0);
  });
});
