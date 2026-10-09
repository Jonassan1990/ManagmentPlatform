import { describe, expect, it } from "vitest";
import {
  buildCompareHref,
  formatSignedDelta,
  formatSignedDeltaPercent,
  formatUtilizationPercent,
  parseCompareSearchParams,
  scenarioRevisionLabel,
  toggleRevisionInSelection,
} from "@/modules/pi-planning/application/scenario-comparison-display";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";

describe("parseCompareSearchParams", () => {
  it("parses distinct revision ids and reference", () => {
    const r = parseCompareSearchParams(`${A},${B}`, B);
    expect(r.error).toBeNull();
    expect(r.revisionIds).toEqual([A, B]);
    expect(r.referenceRevisionId).toBe(B);
  });

  it("dedupes revision ids in URL", () => {
    const r = parseCompareSearchParams(`${A},${A},${B}`, undefined);
    expect(r.revisionIds).toEqual([A, B]);
  });

  it("rejects more than three revisions", () => {
    const r = parseCompareSearchParams(`${A},${B},${C},${D}`, A);
    expect(r.error).toMatch(/At most 3/);
  });

  it("rejects reference not in selection", () => {
    const r = parseCompareSearchParams(`${A},${B}`, C);
    expect(r.error).toMatch(/Reference scenario/);
  });
});

describe("toggleRevisionInSelection", () => {
  it("adds and removes without duplicates", () => {
    expect(toggleRevisionInSelection([], A)).toEqual({
      ok: true,
      revisionIds: [A],
    });
    expect(toggleRevisionInSelection([A], A)).toEqual({
      ok: true,
      revisionIds: [],
    });
  });

  it("blocks a fourth selection", () => {
    const r = toggleRevisionInSelection([A, B, C], D);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("max");
  });
});

describe("buildCompareHref", () => {
  it("preserves revs and ref query params", () => {
    expect(buildCompareHref("pi-1", [A, B], A)).toBe(
      `/pi/pi-1/compare?revs=${A}%2C${B}&ref=${A}`,
    );
  });
});

describe("metric display", () => {
  it("shows em dash for null utilization", () => {
    expect(formatUtilizationPercent(null)).toBe("—");
  });

  it("formats signed deltas without treating null as zero", () => {
    expect(formatSignedDeltaPercent(null)).toBe("—");
    expect(formatSignedDelta(12, { suffix: "h" })).toBe("+12h");
    expect(formatSignedDelta(-3.5, { suffix: "h", decimals: 1 })).toBe(
      "−3.5h",
    );
  });

  it("labels CURRENT, DRAFT, and ARCHIVED scenarios", () => {
    expect(
      scenarioRevisionLabel({
        isCurrent: true,
        label: null,
        key: "current",
        status: "CURRENT",
        archivedAt: null,
      }),
    ).toBe("CURRENT");
    expect(
      scenarioRevisionLabel({
        isCurrent: false,
        label: "Scenario A",
        key: "sc-a",
        status: "DRAFT",
        archivedAt: null,
      }),
    ).toBe("Scenario A (DRAFT)");
    expect(
      scenarioRevisionLabel({
        isCurrent: false,
        label: "Old",
        key: "old",
        status: "ARCHIVED",
        archivedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("Old (ARCHIVED)");
  });
});
