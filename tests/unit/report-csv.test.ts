import { describe, expect, it } from "vitest";
import {
  csvUnavailableCell,
  escapeCsvCell,
  toCsv,
  truncateRows,
} from "@/modules/portfolio/application/report-csv";

describe("report CSV safety", () => {
  it("escapes commas quotes and newlines", () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes spreadsheet formula injection", () => {
    expect(escapeCsvCell("=CMD()")).toBe("'=CMD()");
    expect(escapeCsvCell("+1+1")).toBe("'+1+1");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("\tTAB")).toBe("'\tTAB");
  });

  it("represents unavailable explicitly — never zero", () => {
    expect(csvUnavailableCell()).toContain("UNAVAILABLE");
    expect(csvUnavailableCell("missing PI")).toContain("missing PI");
    expect(csvUnavailableCell()).not.toBe("0");
  });

  it("emits UTF-8 BOM and CRLF rows", () => {
    const csv = toCsv(["a", "b"], [["1", "=2"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("'=2");
  });

  it("bounds export rows", () => {
    const { rows, truncated, total } = truncateRows(
      Array.from({ length: 12 }, (_, i) => i),
      5,
    );
    expect(rows).toHaveLength(5);
    expect(truncated).toBe(true);
    expect(total).toBe(12);
  });
});
