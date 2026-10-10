"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  clearScenarioSelectionAction,
  selectScenarioAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/alert";
import {
  PrimaryButton,
  SecondaryButton,
  permissionTitle,
} from "@/components/ui/forms";
import { StatusBadge } from "@/components/ui/status-badge";
import { mapScenarioStatusBadge } from "@/components/ui/status-adapters";
import { formatHours } from "@/components/pi-planning/pi-nav";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import { readinessClassificationLabel } from "@/modules/pi-planning/application/pi-planning-presentation";
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
  embedded = false,
  compareHref,
}: {
  piId: string;
  piVersion: number;
  selection: ScenarioSelectionState;
  readiness: ScenarioReadinessResult | null;
  history: ScenarioSelectionHistoryEntry[];
  scenarios: SelectableScenario[];
  capabilities?: Caps;
  /** When true, omit outer card chrome (used inside ReviewStageSection). */
  embedded?: boolean;
  compareHref?: string;
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

  const shellClass = embedded
    ? "space-y-4 p-3 sm:p-4"
    : "mb-6 space-y-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]";

  return (
    <section className={shellClass} aria-label="Scenario selection">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {embedded ? null : (
            <>
          <h2 className="text-sm font-semibold text-[var(--sidebar)]">
            Scenario selection
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Choose one preferred draft for review. This is not approval and does
            not change current plan allocations.
          </p>
            </>
          )}
        </div>
        <Link
          href={compareHref ?? `/pi/${piId}/compare`}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Compare scenarios
        </Link>
      </div>

      <div
        className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-3 py-2 text-sm text-[var(--sidebar)]"
        role="status"
      >
        <div className="flex flex-wrap items-center gap-2">
          <strong>Selected for review — not approved</strong>
          {selected ? (
            <>
              <span>· {selected.label ?? selected.key}</span>
              <StatusBadge
                {...mapScenarioStatusBadge(selected.status)}
                size="compact"
              />
            </>
          ) : (
            <span className="text-[var(--muted)]">· none selected</span>
          )}
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {readiness ? (
        <div className="space-y-3">
          <Alert tone={classificationTone(readiness.classification)}>
            Readiness:{" "}
            <strong>
              {readinessClassificationLabel(readiness.classification)}
            </strong>
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
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-error)]">
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
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-warning)]">
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
            <p className="text-xs text-[var(--muted)]">
              Data quality: {readiness.dataQuality.notes.join(" ")}
            </p>
          ) : null}

          {readiness.freshness && readiness.freshness.signals.length > 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Shared inputs may have changed since scenario creation (
              {readiness.freshness.signals.length} signal
              {readiness.freshness.signals.length === 1 ? "" : "s"}).
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-4">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Scenario</span>
          <select
            className="min-w-[14rem] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
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
          <span className="text-xs text-[var(--muted)]">Working…</span>
        ) : null}
      </div>

      {!canReview ? (
        <p className="text-xs text-[var(--muted)]">
          Viewers can inspect readiness; selecting a scenario requires PI review
          permission.
        </p>
      ) : null}

      {history.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Selection history
          </h3>
          <ul className="space-y-1 text-xs text-[var(--sidebar)]">
            {history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <span className="text-[var(--muted)]">
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
    <div className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--color-accent)]" aria-hidden />
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className="text-lg font-extrabold tracking-tight text-[var(--sidebar)] tabular-nums">
        {value}
      </p>
    </div>
  );
}
