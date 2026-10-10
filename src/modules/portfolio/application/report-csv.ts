/**
 * M5E-B — Safe CSV serialization for management reports.
 * Formula-injection protection for Excel/Sheets (=, +, -, @, tab, CR).
 */

export const CSV_MAX_ROWS = 500;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escape one CSV field; neutralize spreadsheet formula injection. */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  let text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : String(value);
  // Normalize newlines inside cells
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Render unavailable metrics explicitly — never coerce to "0". */
export function csvUnavailableCell(reason?: string): string {
  return escapeCsvCell(reason?.trim() ? `UNAVAILABLE: ${reason}` : "UNAVAILABLE");
}

export function toCsv(
  headers: string[],
  rows: Array<Array<unknown>>,
): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  // UTF-8 BOM helps Excel recognize encoding
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function truncateRows<T>(
  rows: T[],
  max = CSV_MAX_ROWS,
): { rows: T[]; truncated: boolean; total: number } {
  return {
    rows: rows.slice(0, max),
    truncated: rows.length > max,
    total: rows.length,
  };
}
