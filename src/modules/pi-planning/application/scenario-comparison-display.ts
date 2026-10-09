/**
 * M3C-B — Pure helpers for scenario comparison URL state and metric display.
 * No React; safe for unit tests.
 */

import type { ScenarioComparisonRevisionRef } from "./scenario-comparison-types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COMPARE_MAX_REVISIONS = 3;
export const COMPARE_MIN_REVISIONS = 2;

export type ParsedCompareParams = {
  revisionIds: string[];
  referenceRevisionId: string | undefined;
  error: string | null;
};

export function parseCompareSearchParams(
  revsParam: string | string[] | undefined,
  refParam: string | string[] | undefined,
): ParsedCompareParams {
  const revsRaw =
    typeof revsParam === "string"
      ? revsParam
      : Array.isArray(revsParam)
        ? revsParam.join(",")
        : "";
  const refRaw =
    typeof refParam === "string"
      ? refParam
      : Array.isArray(refParam)
        ? refParam[0]
        : undefined;

  const revisionIds: string[] = [];
  for (const part of revsRaw.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!UUID_RE.test(part)) {
      return {
        revisionIds: [],
        referenceRevisionId: undefined,
        error: `Invalid revision id in URL: ${part}`,
      };
    }
    if (!revisionIds.includes(part)) {
      revisionIds.push(part);
    }
  }

  if (revisionIds.length > COMPARE_MAX_REVISIONS) {
    return {
      revisionIds: [],
      referenceRevisionId: undefined,
      error: `At most ${COMPARE_MAX_REVISIONS} scenarios can be compared at once.`,
    };
  }

  let referenceRevisionId: string | undefined;
  if (refRaw?.trim()) {
    const ref = refRaw.trim();
    if (!UUID_RE.test(ref)) {
      return {
        revisionIds,
        referenceRevisionId: undefined,
        error: "Invalid reference revision id in URL.",
      };
    }
    referenceRevisionId = ref;
  }

  if (
    referenceRevisionId &&
    revisionIds.length > 0 &&
    !revisionIds.includes(referenceRevisionId)
  ) {
    return {
      revisionIds,
      referenceRevisionId: undefined,
      error: "Reference scenario must be one of the selected comparisons.",
    };
  }

  return { revisionIds, referenceRevisionId, error: null };
}

export function buildCompareHref(
  piId: string,
  revisionIds: string[],
  referenceRevisionId: string,
): string {
  const params = new URLSearchParams();
  params.set("revs", revisionIds.join(","));
  params.set("ref", referenceRevisionId);
  return `/pi/${piId}/compare?${params.toString()}`;
}

export type ToggleRevisionResult =
  | { ok: true; revisionIds: string[] }
  | { ok: false; revisionIds: string[]; reason: "max" | "duplicate" };

/** Toggle a revision in the compare selection (max 3, no duplicates). */
export function toggleRevisionInSelection(
  selected: string[],
  revisionId: string,
): ToggleRevisionResult {
  if (selected.includes(revisionId)) {
    return { ok: true, revisionIds: selected.filter((id) => id !== revisionId) };
  }
  if (selected.length >= COMPARE_MAX_REVISIONS) {
    return { ok: false, revisionIds: selected, reason: "max" };
  }
  return { ok: true, revisionIds: [...selected, revisionId] };
}

export function scenarioRevisionLabel(
  scenario: Pick<
    ScenarioComparisonRevisionRef,
    "isCurrent" | "label" | "key" | "status" | "archivedAt"
  >,
): string {
  if (scenario.isCurrent) return "CURRENT";
  const name = scenario.label?.trim() || scenario.key;
  if (scenario.archivedAt) return `${name} (ARCHIVED)`;
  return `${name} (${scenario.status})`;
}

export function scenarioOptionLabel(
  scenario: Pick<
    ScenarioComparisonRevisionRef,
    "isCurrent" | "label" | "key" | "status" | "archivedAt"
  >,
): string {
  if (scenario.isCurrent) return "CURRENT — live plan";
  const name = scenario.label?.trim() || scenario.key;
  const archived = scenario.archivedAt ? " · ARCHIVED" : "";
  return `${name} · ${scenario.status}${archived}`;
}

export function formatUtilizationPercent(
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function formatSignedDelta(
  value: number,
  opts?: { suffix?: string; decimals?: number },
): string {
  const suffix = opts?.suffix ?? "";
  const decimals = opts?.decimals ?? (value % 1 === 0 ? 0 : 1);
  const abs = Math.abs(value);
  const formatted =
    decimals === 0 ? abs.toFixed(0) : abs.toFixed(decimals);
  if (value > 0) return `+${formatted}${suffix}`;
  if (value < 0) return `−${formatted}${suffix}`;
  return `0${suffix}`;
}

export function formatSignedDeltaPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatSignedDelta(value, { suffix: "%", decimals: 1 });
}

export function deltaToneClass(value: number): string {
  if (value > 0) return "text-[#087f78]";
  if (value < 0) return "text-[#d65d57]";
  return "text-[#74848e]";
}

export function countNonDraftScenarios(
  scenarios: Array<{ isCurrent: boolean }>,
): number {
  return scenarios.filter((s) => !s.isCurrent).length;
}
