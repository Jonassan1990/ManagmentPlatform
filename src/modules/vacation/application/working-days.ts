/** Inclusive weekday count (Mon–Fri) between two calendar dates (UTC date parts). */
export function countWorkingDays(start: Date, end: Date): number {
  const s = toUtcDateOnly(start);
  const e = toUtcDateOnly(end);
  if (e.getTime() < s.getTime()) return 0;
  let count = 0;
  const cursor = new Date(s);
  while (cursor.getTime() <= e.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function toUtcDateOnly(value: Date | string): Date {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) {
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function formatDateOnly(value: Date): string {
  const d = toUtcDateOnly(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  };
}

export function monthBounds(year: number, monthIndex0: number): {
  start: Date;
  end: Date;
} {
  return {
    start: new Date(Date.UTC(year, monthIndex0, 1)),
    end: new Date(Date.UTC(year, monthIndex0 + 1, 0)),
  };
}
