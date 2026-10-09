"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  clearScenarioSelectionAction,
  selectScenarioAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/page";
import {
  PrimaryButton,
  SecondaryButton,
  permissionTitle,
} from "@/components/ui/forms";
import { formatHours } from "@/components/pi-planning/pi-nav";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import type {
  ScenarioReadinessResult,
  ScenarioSelectionHistoryEntry,
  ScenarioSelectionState,
} from "@/modules/pi-planning/application/scenario-selection-types";

type Caps = Partial<PrincipalCapabilities>;

export type SelectableScenario = {
  id: string;
  key: string;
  label: string | null;
  status: string;
  isCurrent: boolean;
  version: number;
  archivedAt?: string | Date | null;
};

function classificationTone(
  c: ScenarioReadinessResult["classification"],
): "ok" | "warning" | "danger" {
  switch (c) {
    case "READY":
      return "ok";
    case "READY_WITH_WARNINGS":
      return "warning";
    case "NOT_READY":
    case "UNAVAILABLE":
      return "danger";
  }
}

function utilizationLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function ScenarioSelectionPanel({
  piId,
  piVersion,
  selection,
  readiness,
  history,
  scenarios,
  capabilities,
}: {
  piId: string;
  piVersion: number;
  selection: ScenarioSelectionState;
  readiness: ScenarioReadinessResult | null;
  history: ScenarioSelectionHistoryEntry[];
  scenarios: SelectableScenario[];
  capabilities?: Caps;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickId, setPickId] = useState(
    selection.selectedRevision?.id ??
      scenarios.find((s) => !s.isCurrent && s.status !== "ARCHIVED")?.id ??
      "",
  );

  const canReview = capabilities?.canReviewPi === true;
  const eligible = scenarios.filter(
    (s) =>
      !s.isCurrent &&
      s.status !== "ARCHIVED" &&
      !s.archivedAt &&
      (s.status === "DRAFT" ||
        s.status === "READY_FOR_REVIEW" ||
        s.status === "SELECTED"),
  );

  function run(
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error?.message ?? "Selection action failed.");
        return;
      }
      router.refresh();
    });
  }

  const selected = selection.selectedRevision;

  return (
    <section className="mb-6 space-y-4 rounded-[11px] border border-[#e2e8eb] bg-white p-4 shadow-[0_7px_22px_#1b33440a]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#102a43]">
            Scenario selection
          </h2>
          <p className="mt-1 text-xs text-[#74848e]">
            Choose one preferred draft for review. This is not approval and does
            not change CURRENT allocations.
          </p>
        </div>
        <Link
          href={`/pi/${piId}/compare`}
          className="text-xs text-[#087f78] hover:underline"
        >
          Compare scenarios
        </Link>
      </div>

      <div
        className="rounded-md border border-[#087f78]/30 bg-[#087f78]/5 px-3 py-2 text-sm text-[#102a43]"
        role="status"
      >
        <strong>Selected for review — not approved</strong>
        {selected ? (
          <span className="ml-2">
            · {selected.label ?? selected.key} ({selected.status})
          </span>
        ) : (
          <span className="ml-2 text-[#74848e]">· none selected</span>
        )}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {readiness ? (
        <div className="space-y-3">
          <Alert tone={classificationTone(readiness.classification)}>
            Readiness: <strong>{readiness.classification}</strong>
            {readiness.revision
              ? ` for ${readiness.revision.label ?? readiness.revision.key}`
              : ""}
          </Alert>

          {readiness.metrics ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric
                label="Available"
                value={formatHours(readiness.metrics.availableHours)}
              />
              <Metric
                label="Committed"
                value={formatHours(readiness.metrics.committedHours)}
              />
              <Metric
                label="Remaining"
                value={formatHours(readiness.metrics.remainingHours)}
              />
              <Metric
                label="Utilization"
                value={utilizationLabel(readiness.metrics.utilizationPercent)}
              />
              <Metric
                label="Overloaded teams"
                value={String(readiness.metrics.overloadedTeamCount)}
              />
              <Metric
                label="Conflicts"
                value={`${readiness.metrics.conflictCount} (${readiness.metrics.blockerConflictCount} blockers)`}
              />
            </div>
          ) : null}

          {readiness.blockers.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#d65d57]">
                Blocking conditions
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {readiness.blockers.map((b) => (
                  <li key={`${b.code}-${b.message}`}>{b.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {readiness.warnings.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#e3a640]">
                Warnings
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {readiness.warnings.map((w) => (
                  <li key={`${w.code}-${w.message}`}>{w.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {readiness.dataQuality.notes.length > 0 ? (
            <p className="text-xs text-[#74848e]">
              Data quality: {readiness.dataQuality.notes.join(" ")}
            </p>
          ) : null}

          {readiness.freshness && readiness.freshness.signals.length > 0 ? (
            <p className="text-xs text-[#74848e]">
              Shared inputs may have changed since scenario creation (
              {readiness.freshness.signals.length} signal
              {readiness.freshness.signals.length === 1 ? "" : "s"}).
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 border-t border-[#e2e8eb] pt-4">
        <label className="text-sm">
          <span className="mb-1 block text-[#74848e]">Scenario</span>
          <select
            className="min-w-[14rem] rounded-md border border-[#e2e8eb] bg-white px-3 py-2"
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            disabled={!canReview || pending || eligible.length === 0}
            title={permissionTitle(canReview)}
          >
            <option value="">Select a draft…</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label ?? s.key} · {s.status}
              </option>
            ))}
          </select>
        </label>
        <PrimaryButton
          type="button"
          disabled={
            !canReview || pending || !pickId || eligible.length === 0
          }
          title={permissionTitle(canReview)}
          onClick={() => {
            const target = eligible.find((s) => s.id === pickId);
            if (!target) return;
            run(async () =>
              selectScenarioAction({
                piId,
                revisionId: target.id,
                expectedPiVersion: piVersion,
                expectedRevisionVersion: target.version,
              }),
            );
          }}
        >
          {selected ? "Change selection" : "Select for review"}
        </PrimaryButton>
        <SecondaryButton
          type="button"
          disabled={!canReview || pending || !selected}
          title={permissionTitle(canReview)}
          onClick={() =>
            run(async () =>
              clearScenarioSelectionAction({
                piId,
                expectedPiVersion: piVersion,
              }),
            )
          }
        >
          Clear selection
        </SecondaryButton>
        {pending ? (
          <span className="text-xs text-[#74848e]">Working…</span>
        ) : null}
      </div>

      {!canReview ? (
        <p className="text-xs text-[#74848e]">
          Viewers can inspect readiness; selecting a scenario requires PI review
          permission.
        </p>
      ) : null}

      {history.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#74848e]">
            Selection history
          </h3>
          <ul className="space-y-1 text-xs text-[#102a43]">
            {history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <span className="text-[#74848e]">
                  {new Date(h.createdAt).toLocaleString()}
                </span>{" "}
                · {h.actionType.replace("pi.scenario.", "")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-[11px] border border-[#e2e8eb] bg-[#f8fafb] p-3">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#087f78]" aria-hidden />
      <p className="text-[11px] text-[#74848e]">{label}</p>
      <p className="text-lg font-extrabold tracking-tight text-[#102a43] tabular-nums">
        {value}
      </p>
    </div>
  );
}
