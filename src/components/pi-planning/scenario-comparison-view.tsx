"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LiveRegion } from "@/components/ui/live-region";
import { Alert } from "@/components/ui/page";
import {
  formatHours,
  utilizationBarClass,
} from "@/components/pi-planning/pi-nav";
import {
  buildCompareHref,
  COMPARE_MAX_REVISIONS,
  COMPARE_MIN_REVISIONS,
  countNonDraftScenarios,
  deltaToneClass,
  formatSignedDelta,
  formatSignedDeltaPercent,
  formatUtilizationPercent,
  referenceDeltaLabel,
  scenarioOptionLabel,
  scenarioRevisionLabel,
  toggleRevisionInSelection,
} from "@/modules/pi-planning/application/scenario-comparison-display";
import type {
  ScenarioComparisonResult,
  ScenarioComparisonRevisionRef,
  WorkItemAllocationDiff,
} from "@/modules/pi-planning/application/scenario-comparison-types";

export type CompareScenarioOption = ScenarioComparisonRevisionRef;

function CompareKpiCard({
  label,
  value,
  delta,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "default" | "critical" | "warn" | "teal";
}) {
  const bar =
    tone === "critical"
      ? "bg-[#d65d57]"
      : tone === "warn"
        ? "bg-[#e3a640]"
        : tone === "teal"
          ? "bg-[#087f78]"
          : "bg-[#5b8def]";
  return (
    <div className="relative overflow-hidden rounded-[11px] border border-[#e2e8eb] bg-white p-[14px_17px] shadow-[0_7px_22px_#1b33440a]">
      <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className="my-[3px] text-[22px] font-extrabold tracking-[-0.04em] text-[#102a43] tabular-nums sm:text-[27px]">
        {value}
      </p>
      {delta ? (
        <p className="text-[10px] tabular-nums text-[#829099]">{delta}</p>
      ) : null}
    </div>
  );
}

function RevisionHeader({
  revision,
  isReference,
}: {
  revision: ScenarioComparisonRevisionRef;
  isReference: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-[#102a43]">
        {scenarioRevisionLabel(revision)}
      </p>
      {isReference ? (
        <span className="inline-block rounded bg-[#087f78]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#087f78]">
          Reference
        </span>
      ) : (
        <span className="text-[10px] text-[#829099]">vs reference</span>
      )}
    </div>
  );
}

function WorkItemDiffTable({ rows }: { rows: WorkItemAllocationDiff[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No changes in this bucket.</p>
    );
  }
  return (
    <div
      className="overflow-x-auto"
      role="region"
      aria-label="Work item allocation differences. Scroll horizontally on small screens."
      tabIndex={0}
    >
      <table className="w-full min-w-[28rem] text-left text-sm sm:min-w-[32rem]">
        <caption className="sr-only">Work item allocation differences</caption>
        <thead>
          <tr className="border-b border-[var(--line)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <th scope="col" className="py-2 pr-3 font-medium">
              Work item
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Change
            </th>
            <th scope="col" className="py-2 font-medium">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.workItemId} className="border-b border-[#e2e8eb]/70">
              <td className="py-2 pr-3 align-top">
                <span className="font-medium text-[#102a43]">
                  {row.workItemReferenceKey ?? row.workItemId.slice(0, 8)}
                </span>
                {row.workItemTitle ? (
                  <p className="text-xs text-[var(--muted)]">{row.workItemTitle}</p>
                ) : null}
              </td>
              <td className="py-2 pr-3 align-top text-xs uppercase text-[var(--muted)]">
                {row.change.replaceAll("_", " ")}
              </td>
              <td className="py-2 align-top text-xs text-[#102a43]">
                <WorkItemSideSummary diff={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkItemSideSummary({ diff }: { diff: WorkItemAllocationDiff }) {
  const present = diff.sides.filter((s) => s.present);
  if (present.length === 0) return <span>—</span>;
  return (
    <ul className="space-y-1">
      {diff.sides.map((side) => (
        <li key={side.revisionId}>
          {side.present ? (
            <>
              {side.plannedHours != null ? `${side.plannedHours}h` : "—"}
              {side.iterationId ? " · iteration set" : ""}
              {side.teamId ? " · team set" : ""}
            </>
          ) : (
            <span className="text-[var(--muted)]">Not allocated</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ConflictList({
  conflicts,
}: {
  conflicts: ScenarioComparisonResult["conflicts"]["onlyOnReference"];
}) {
  if (conflicts.length === 0) {
    return <p className="text-sm text-[var(--muted)]">None</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {conflicts.slice(0, 25).map((c, i) => (
        <li
          key={`${c.type}-${c.subjectId}-${i}`}
          className="rounded-md border border-[#e2e8eb] bg-white px-3 py-2"
        >
          <span
            className={`mr-2 text-[10px] font-semibold uppercase ${
              c.severity === "BLOCKER"
                ? "text-[#d65d57]"
                : c.severity === "WARNING"
                  ? "text-[#e3a640]"
                  : "text-[var(--muted)]"
            }`}
          >
            {c.severity}
          </span>
          <span className="text-[#102a43]">{c.message}</span>
        </li>
      ))}
      {conflicts.length > 25 ? (
        <li className="text-xs text-[var(--muted)]">
          + {conflicts.length - 25} more conflicts
        </li>
      ) : null}
    </ul>
  );
}

export function ScenarioComparisonView({
  piId,
  piReferenceKey,
  scenarios,
  initialRevisionIds,
  initialReferenceRevisionId,
  comparison,
  compareError,
}: {
  piId: string;
  piReferenceKey: string;
  scenarios: CompareScenarioOption[];
  initialRevisionIds: string[];
  initialReferenceRevisionId: string | null;
  comparison: ScenarioComparisonResult | null;
  compareError: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialRevisionIds);
  const [referenceId, setReferenceId] = useState<string | null>(
    initialReferenceRevisionId,
  );
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);

  const revisionById = useMemo(
    () => new Map(scenarios.map((s) => [s.id, s])),
    [scenarios],
  );

  const nonCurrentCount = countNonDraftScenarios(scenarios);
  const canCompare =
    selected.length >= COMPARE_MIN_REVISIONS &&
    selected.length <= COMPARE_MAX_REVISIONS;

  function applySelection(nextSelected: string[], nextRef: string | null) {
    setSelected(nextSelected);
    setReferenceId(nextRef);
    if (nextSelected.length < COMPARE_MIN_REVISIONS) {
      router.replace(`/pi/${piId}/compare`);
      return;
    }
    const ref =
      nextRef && nextSelected.includes(nextRef)
        ? nextRef
        : nextSelected[0]!;
    router.push(buildCompareHref(piId, nextSelected, ref));
  }

  function onToggle(revisionId: string) {
    const result = toggleRevisionInSelection(selected, revisionId);
    if (!result.ok && result.reason === "max") {
      setSelectionNotice(
        `Select at most ${COMPARE_MAX_REVISIONS} scenarios to compare.`,
      );
      return;
    }
    setSelectionNotice(null);
    let nextRef = referenceId;
    if (!result.revisionIds.includes(revisionId) && referenceId === revisionId) {
      nextRef = result.revisionIds[0] ?? null;
    }
    if (
      nextRef &&
      result.revisionIds.length > 0 &&
      !result.revisionIds.includes(nextRef)
    ) {
      nextRef = result.revisionIds[0]!;
    }
    applySelection(result.revisionIds, nextRef);
  }

  function onReferenceChange(revisionId: string) {
    setReferenceId(revisionId);
    if (selected.length >= COMPARE_MIN_REVISIONS) {
      router.push(buildCompareHref(piId, selected, revisionId));
    }
  }

  const boardHref =
    referenceId && !revisionById.get(referenceId)?.isCurrent
      ? `/pi/${piId}/board?revisionId=${referenceId}`
      : `/pi/${piId}/board`;

  return (
    <div className="space-y-6">
      <div
        className="rounded-md border border-[#087f78]/30 bg-[#087f78]/5 px-3 py-2 text-sm text-[#102a43]"
        role="status"
      >
        Read-only comparison — no promotion, approval, or edits. Capacity inputs
        are shared live across scenarios; only allocations differ per revision.
      </div>

      <section className="rounded-[11px] border border-[#e2e8eb] bg-white p-4 shadow-[0_7px_22px_#1b33440a]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#102a43]">
            Select scenarios ({COMPARE_MIN_REVISIONS}–{COMPARE_MAX_REVISIONS})
          </h2>
          <Link
            href={boardHref}
            className="text-sm text-[#087f78] hover:underline"
          >
            Back to planning board
          </Link>
        </div>

        {nonCurrentCount === 0 ? (
          <Alert tone="ok">
            Only the current plan exists for {piReferenceKey}. Create a draft
            scenario on the{" "}
            <Link href={`/pi/${piId}/board`} className="underline">
              plan board
            </Link>{" "}
            to compare what-if plans.
          </Alert>
        ) : (
          <>
            {selectionNotice ? (
              <Alert tone="warning">{selectionNotice}</Alert>
            ) : null}
            <ul className="space-y-2" aria-label="Scenario compare selection">
              {scenarios.map((s) => {
                const checked = selected.includes(s.id);
                const disabled =
                  !checked && selected.length >= COMPARE_MAX_REVISIONS;
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-[#e2e8eb] px-3 py-2"
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggle(s.id)}
                        aria-label={`Include ${scenarioOptionLabel(s)}`}
                      />
                      <span>{scenarioOptionLabel(s)}</span>
                    </label>
                    {checked ? (
                      <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
                        <input
                          type="radio"
                          name="compare-reference"
                          checked={referenceId === s.id}
                          onChange={() => onReferenceChange(s.id)}
                          aria-label={`Use ${scenarioOptionLabel(s)} as reference`}
                        />
                        Reference
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {!canCompare ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Pick at least {COMPARE_MIN_REVISIONS} scenarios, then metrics
                load automatically.
              </p>
            ) : null}
          </>
        )}
      </section>

      {compareError ? <Alert tone="danger">{compareError}</Alert> : null}

      {comparison ? (
        <ComparisonResults comparison={comparison} piId={piId} />
      ) : null}
    </div>
  );
}

function ComparisonResults({
  comparison,
  piId,
}: {
  comparison: ScenarioComparisonResult;
  piId: string;
}) {
  const refId = comparison.referenceRevisionId;
  const revisionMap = new Map(
    comparison.revisions.map((r) => [r.id, r] as const),
  );

  const changeCount =
    comparison.allocationChanges.added.length +
    comparison.allocationChanges.removed.length +
    comparison.allocationChanges.changed.length;

  return (
    <div className="space-y-8">
      <LiveRegion
        message={`Scenario comparison ready for ${comparison.revisions.length} revisions. ${comparison.byTeam.length} team rows. ${changeCount} allocation differences.`}
      />
      {comparison.dataQuality.missingCapacityInputs ||
      comparison.dataQuality.notes.length > 0 ? (
        <Alert tone="warning">
          {comparison.dataQuality.missingCapacityInputs
            ? "Some capacity inputs are missing — available hours may be understated. "
            : null}
          {comparison.dataQuality.notes.join(" ")}
        </Alert>
      ) : null}

      <section aria-labelledby="compare-summary-heading">
        <h2
          id="compare-summary-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Summary
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {comparison.totals.map((col) => {
            const rev = revisionMap.get(col.revisionId);
            if (!rev) return null;
            const isRef = col.revisionId === refId;
            const m = col.metrics;
            const d = col.deltaFromReference;
            return (
              <div
                key={col.revisionId}
                className="space-y-3 rounded-[11px] border border-[#e2e8eb] bg-[#f8fafb] p-4"
              >
                <RevisionHeader revision={rev} isReference={isRef} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <CompareKpiCard
                    label="Available"
                    value={formatHours(m.availableHours)}
                    delta={
                      <span
                        className={
                          isRef ? undefined : deltaToneClass(d.availableHours)
                        }
                      >
                        {referenceDeltaLabel(
                          isRef,
                          formatSignedDelta(d.availableHours, { suffix: "h" }),
                        )}
                      </span>
                    }
                  />
                  <CompareKpiCard
                    label="Committed"
                    value={formatHours(m.committedHours)}
                    delta={
                      <span
                        className={
                          isRef ? undefined : deltaToneClass(d.committedHours)
                        }
                      >
                        {referenceDeltaLabel(
                          isRef,
                          formatSignedDelta(d.committedHours, { suffix: "h" }),
                        )}
                      </span>
                    }
                    tone="teal"
                  />
                  <CompareKpiCard
                    label="Remaining"
                    value={formatHours(m.remainingHours)}
                    delta={
                      <span
                        className={
                          isRef ? undefined : deltaToneClass(d.remainingHours)
                        }
                      >
                        {referenceDeltaLabel(
                          isRef,
                          formatSignedDelta(d.remainingHours, { suffix: "h" }),
                        )}
                      </span>
                    }
                  />
                  <CompareKpiCard
                    label="Utilization"
                    value={formatUtilizationPercent(m.utilizationPercent)}
                    delta={
                      <span
                        className={
                          isRef
                            ? undefined
                            : deltaToneClass(d.utilizationPercent ?? 0)
                        }
                      >
                        {referenceDeltaLabel(
                          isRef,
                          formatSignedDeltaPercent(d.utilizationPercent),
                        )}
                      </span>
                    }
                  />
                  <CompareKpiCard
                    label="Overloaded teams"
                    value={m.overloadedTeamCount}
                    delta={
                      <span
                        className={
                          isRef
                            ? undefined
                            : deltaToneClass(d.overloadedTeamCount)
                        }
                      >
                        {referenceDeltaLabel(
                          isRef,
                          formatSignedDelta(d.overloadedTeamCount),
                        )}
                      </span>
                    }
                    tone={m.overloadedTeamCount > 0 ? "critical" : "default"}
                  />
                  <CompareKpiCard
                    label="Conflicts"
                    value={m.conflictCount}
                    delta={
                      <span
                        className={
                          isRef ? undefined : deltaToneClass(d.conflictCount)
                        }
                      >
                        {referenceDeltaLabel(
                          isRef,
                          formatSignedDelta(d.conflictCount),
                        )}
                      </span>
                    }
                    tone={m.blockerConflictCount > 0 ? "critical" : "warn"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="compare-teams-heading">
        <h2
          id="compare-teams-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Team capacity
        </h2>
        {comparison.byTeam.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No team rows to show.</p>
        ) : (
          <div
            className="overflow-x-auto rounded-[11px] border border-[#e2e8eb] bg-white"
            role="region"
            aria-label="Team capacity comparison. Scroll horizontally on small screens."
            tabIndex={0}
          >
            <table className="w-full min-w-[28rem] text-left text-sm sm:min-w-[40rem]">
              <caption className="sr-only">
                Team capacity comparison by scenario revision
              </caption>
              <thead>
                <tr className="border-b border-[#e2e8eb] bg-[#f8fafb] text-[11px] uppercase text-[var(--muted)]">
                  <th scope="col" className="p-3 font-medium">
                    Team
                  </th>
                  {comparison.revisions.map((r) => (
                    <th key={r.id} scope="col" className="p-3 font-medium">
                      {scenarioRevisionLabel(r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.byTeam.map((row) => (
                  <tr
                    key={`${row.teamId}-${row.iterationId}`}
                    className="border-b border-[#e2e8eb]/60"
                  >
                    <td className="p-3 align-top">
                      <span className="font-medium">{row.teamName}</span>
                    </td>
                    {comparison.revisions.map((rev) => {
                      const col = row.columns.find(
                        (c) => c.revisionId === rev.id,
                      );
                      if (!col) {
                        return (
                          <td key={rev.id} className="p-3 text-[var(--muted)]">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={rev.id} className="p-3 align-top">
                          <p className="tabular-nums">
                            {formatHours(col.committedHours)} /{" "}
                            {formatHours(col.availableHours)}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {formatUtilizationPercent(
                              col.utilization != null
                                ? col.utilization * 100
                                : null,
                            )}
                            {col.overloaded ? " · overloaded" : ""}
                          </p>
                          <div
                            className="mt-1 h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full bg-[#e2e8eb]"
                            role="img"
                            aria-label={`Utilization ${formatUtilizationPercent(
                              col.utilization != null
                                ? col.utilization * 100
                                : null,
                            )}${col.overloaded ? ", overloaded" : ""}`}
                          >
                            <div
                              className={`h-full ${utilizationBarClass(col.band)}`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  col.utilization != null
                                    ? col.utilization * 100
                                    : 0,
                                )}%`,
                              }}
                              aria-hidden="true"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="compare-projects-heading">
        <h2
          id="compare-projects-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Project commitments
        </h2>
        {comparison.byProject.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No project rows.</p>
        ) : (
          <div
            className="overflow-x-auto rounded-[11px] border border-[#e2e8eb] bg-white"
            role="region"
            tabIndex={0}
            aria-label="Project commitments comparison"
          >
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">
                Project committed hours by revision versus reference
              </caption>
              <thead>
                <tr className="border-b border-[#e2e8eb] bg-[#f8fafb] text-[11px] uppercase text-[var(--muted)]">
                  <th scope="col" className="p-3 font-medium">
                    Project
                  </th>
                  {comparison.revisions.map((r) => (
                    <th key={r.id} scope="col" className="p-3 font-medium">
                      Committed
                    </th>
                  ))}
                  <th scope="col" className="p-3 font-medium">
                    vs reference
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.byProject.map((row) => (
                  <tr
                    key={row.projectId}
                    className="border-b border-[#e2e8eb]/60"
                  >
                    <td className="p-3">
                      <span className="font-medium">{row.projectName}</span>
                      <span className="ml-1 text-xs text-[var(--muted)]">
                        {row.projectReferenceKey}
                      </span>
                    </td>
                    {comparison.revisions.map((rev) => {
                      const col = row.columns.find(
                        (c) => c.revisionId === rev.id,
                      );
                      return (
                        <td key={rev.id} className="p-3 tabular-nums">
                          {col ? formatHours(col.committedHours) : "—"}
                        </td>
                      );
                    })}
                    <td className="p-3 text-xs">
                      {row.deltaFromReferenceHours
                        .filter((d) => d.revisionId !== refId)
                        .map((d) => (
                          <span
                            key={d.revisionId}
                            className={`mr-2 ${deltaToneClass(d.deltaHours)}`}
                          >
                            {formatSignedDelta(d.deltaHours, { suffix: "h" })}
                          </span>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="compare-resources-heading">
        <h2
          id="compare-resources-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Resource allocation
        </h2>
        {comparison.byResource.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No resource rows (may be hidden by authorization scope).
          </p>
        ) : (
          <div
            className="overflow-x-auto rounded-[11px] border border-[#e2e8eb] bg-white"
            role="region"
            tabIndex={0}
            aria-label="Resource allocation comparison"
          >
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">
                Resource load hours by revision
              </caption>
              <thead>
                <tr className="border-b border-[#e2e8eb] bg-[#f8fafb] text-[11px] uppercase text-[var(--muted)]">
                  <th scope="col" className="p-3 font-medium">
                    Resource
                  </th>
                  {comparison.revisions.map((r) => (
                    <th key={r.id} scope="col" className="p-3 font-medium">
                      Load
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.byResource.map((row) => (
                  <tr
                    key={`${row.resourceId}-${row.iterationId}`}
                    className="border-b border-[#e2e8eb]/60"
                  >
                    <td className="p-3">{row.resourceName}</td>
                    {comparison.revisions.map((rev) => {
                      const col = row.columns.find(
                        (c) => c.revisionId === rev.id,
                      );
                      if (!col) {
                        return (
                          <td key={rev.id} className="p-3">
                            —
                          </td>
                        );
                      }
                      const pct =
                        col.availableHours > 0
                          ? Math.min(
                              100,
                              (col.committedHours / col.availableHours) * 100,
                            )
                          : col.committedHours > 0
                            ? 100
                            : 0;
                      return (
                        <td key={rev.id} className="p-3">
                          <p className="tabular-nums text-xs">
                            {formatHours(col.committedHours)} /{" "}
                            {formatHours(col.availableHours)}
                          </p>
                          <div className="mt-1 h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full bg-[#e2e8eb]">
                            <div
                              className={`h-full ${utilizationBarClass(col.band)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="compare-work-items-heading">
        <h2
          id="compare-work-items-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Work item allocation changes
        </h2>
        <p className="mb-3 text-xs text-[var(--muted)]">
          {comparison.allocationChanges.unchangedCount} allocations unchanged
          across selected revisions.
        </p>
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-medium text-[#102a43]">Added</h3>
            <WorkItemDiffTable rows={comparison.allocationChanges.added} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-[#102a43]">Removed</h3>
            <WorkItemDiffTable rows={comparison.allocationChanges.removed} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-[#102a43]">
              Modified
            </h3>
            <WorkItemDiffTable rows={comparison.allocationChanges.changed} />
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-conflicts-heading">
        <h2
          id="compare-conflicts-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Conflict differences
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {comparison.conflicts.onlyOnRevision.map((bucket) => {
            const rev = revisionMap.get(bucket.revisionId);
            return (
              <div
                key={bucket.revisionId}
                className="rounded-[11px] border border-[#e2e8eb] bg-white p-4"
              >
                <h3 className="mb-2 text-sm font-medium">
                  Only on {rev ? scenarioRevisionLabel(rev) : bucket.revisionId}
                </h3>
                <ConflictList conflicts={bucket.conflicts} />
              </div>
            );
          })}
          <div className="rounded-[11px] border border-[#e2e8eb] bg-white p-4">
            <h3 className="mb-2 text-sm font-medium">Only on reference</h3>
            <ConflictList conflicts={comparison.conflicts.onlyOnReference} />
          </div>
        </div>
      </section>

      <p className="text-xs text-[var(--muted)]">
        Compared at {new Date(comparison.asOf).toLocaleString()} · PI{" "}
        <Link href={`/pi/${piId}/board`} className="text-[#087f78] underline">
          {piId.slice(0, 8)}…
        </Link>
      </p>
    </div>
  );
}
