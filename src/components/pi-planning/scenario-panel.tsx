"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  archiveScenarioAction,
  cloneScenarioAction,
  createScenarioFromCurrentAction,
  markScenarioReadyAction,
  renameScenarioAction,
  reopenScenarioAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  FormField,
  fieldClassName,
  permissionTitle,
} from "@/components/ui/forms";
import { StatusBadge } from "@/components/ui/status-badge";
import { mapPiStatusBadge, mapScenarioStatusBadge } from "@/components/ui/status-adapters";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import {
  appendPreservedQuery,
  PI_CONTEXT_QUERY_KEYS,
} from "@/modules/navigation/return-context";
import {
  describeEditability,
  scenarioChipLabel,
} from "@/modules/pi-planning/application/pi-planning-presentation";

type Caps = Partial<PrincipalCapabilities>;

export type ScenarioListItem = {
  id: string;
  key: string;
  label: string | null;
  isCurrent: boolean;
  status: string;
  version: number;
  kind: "CURRENT" | "SCENARIO";
  archivedAt?: string | Date | null;
};

/** Aggregated from capacity/conflict service views — not recalculated in React. */
export type BoardCapacitySummary = {
  availableHours: number | null;
  committedHours: number;
  overloadSlots: number;
  blockerConflictCount: number;
  teamSlotCount: number;
};

export type ActiveRevision = {
  id: string;
  key: string;
  label: string | null;
  isCurrent: boolean;
  status: string;
};

function scenarioBadgeFor(item: {
  isCurrent: boolean;
  status: string;
  archivedAt?: string | Date | null;
}) {
  if (item.isCurrent) return mapScenarioStatusBadge("ACTIVE_PLAN");
  if (item.archivedAt || item.status === "ARCHIVED") {
    return mapScenarioStatusBadge("ARCHIVED");
  }
  return mapScenarioStatusBadge(item.status);
}

/**
 * Compact mode banner (legacy export). Prefer the planning context inside ScenarioPanel.
 */
export function ScenarioModeBanner({
  revision,
}: {
  revision: ActiveRevision;
}) {
  const badge = scenarioBadgeFor(revision);
  if (revision.isCurrent) {
    return (
      <Alert tone="info" title="Current plan" live="polite" className="mb-4">
        Viewing the authoritative <strong>current plan</strong>
        {revision.label ? ` — ${revision.label}` : ""}. Scenario drafts do not
        change this plan until you apply one in Review.
      </Alert>
    );
  }
  const readOnly = revision.status !== "DRAFT";
  return (
    <Alert
      tone={readOnly ? "warning" : "info"}
      title="Scenario mode"
      live="polite"
      className="mb-4"
    >
      <span className="inline-flex flex-wrap items-center gap-2">
        Viewing scenario <strong>{revision.label ?? revision.key}</strong>
        <StatusBadge status={badge.status} label={badge.label} size="compact" />
      </span>
      <span className="mt-1 block text-[var(--color-text)]">
        {readOnly
          ? "Read-only for this status — reopen a draft to edit allocations. The current plan is unchanged."
          : "Edits apply only to this draft scenario — the current plan is unchanged."}
      </span>
      {(revision.status === "SELECTED" || revision.status === "PROMOTED") && (
        <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
          Selected or applied does not mean the plan is approved.
        </span>
      )}
    </Alert>
  );
}

const SCENARIO_PRESERVE_KEYS = PI_CONTEXT_QUERY_KEYS.filter(
  (k) => k !== "revisionId",
);

export function ScenarioPanel({
  piId,
  piStatus,
  activeRevision,
  activeRevisionId,
  scenarios,
  capacitySummary,
  capabilities,
  boardHrefBase,
  preserveQuery,
  showPlanningContext = true,
}: {
  piId: string;
  piStatus?: string;
  /** Preferred: full active revision for context strip. */
  activeRevision?: ActiveRevision;
  activeRevisionId: string;
  scenarios: ScenarioListItem[];
  capacitySummary?: BoardCapacitySummary;
  capabilities?: Caps;
  boardHrefBase?: string;
  preserveQuery?:
    | URLSearchParams
    | Record<string, string | string[] | undefined>;
  /** When false, only the scenario switcher / manage disclosure is shown (parent supplies header). */
  showPlanningContext?: boolean;
}) {
  const router = useRouter();
  const manageId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createLabel, setCreateLabel] = useState("");
  const [cloneFromId, setCloneFromId] = useState("");
  const [cloneLabel, setCloneLabel] = useState("");
  const [renameId, setRenameId] = useState("");
  const [renameLabel, setRenameLabel] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    version: number;
    label: string;
  } | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const revision =
    activeRevision ??
    scenarios.find((s) => s.id === activeRevisionId) ??
    scenarios.find((s) => s.isCurrent) ??
    null;

  const viewingCurrent = revision?.isCurrent ?? true;
  const [manageOpen, setManageOpen] = useState(!viewingCurrent);

  const canAllocate = capabilities?.canAllocatePi !== false;
  const draftScenarios = scenarios.filter(
    (s) => !s.isCurrent && s.status === "DRAFT",
  );
  const basePath = boardHrefBase ?? `/pi/${piId}/board`;
  const base = preserveQuery
    ? appendPreservedQuery(basePath, preserveQuery, SCENARIO_PRESERVE_KEYS)
    : basePath;

  function hrefFor(revisionId: string, isCurrent: boolean) {
    if (isCurrent) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}revisionId=${revisionId}`;
  }

  function compareHref(): string {
    const currentId = scenarios.find((s) => s.isCurrent)?.id;
    const activeNonCurrent =
      revision && !revision.isCurrent ? revision.id : undefined;
    const other =
      activeNonCurrent ?? scenarios.find((s) => !s.isCurrent)?.id;
    const revs = [currentId, other].filter(Boolean).join(",");
    const ref = currentId ?? scenarios[0]!.id;
    const path = `/pi/${piId}/compare?revs=${encodeURIComponent(revs)}&ref=${encodeURIComponent(ref)}`;
    return preserveQuery
      ? appendPreservedQuery(path, preserveQuery, SCENARIO_PRESERVE_KEYS)
      : path;
  }

  function reviewHref(): string {
    const path = `/pi/${piId}/review`;
    const withCtx = preserveQuery
      ? appendPreservedQuery(path, preserveQuery, SCENARIO_PRESERVE_KEYS)
      : path;
    if (!revision || revision.isCurrent) return withCtx;
    const sep = withCtx.includes("?") ? "&" : "?";
    return `${withCtx}${sep}revisionId=${revision.id}`;
  }

  function run(
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error?.message ?? "Scenario action failed.");
        setManageOpen(true);
        return;
      }
      router.refresh();
    });
  }

  const piBadge = piStatus ? mapPiStatusBadge(piStatus) : null;
  const revBadge = revision ? scenarioBadgeFor(revision) : null;
  const capacityUnavailable =
    capacitySummary == null ||
    capacitySummary.availableHours == null ||
    capacitySummary.teamSlotCount === 0;
  const hasWarnings =
    (capacitySummary?.blockerConflictCount ?? 0) > 0 ||
    (capacitySummary?.overloadSlots ?? 0) > 0 ||
    (revision != null && !revision.isCurrent && revision.status !== "DRAFT");

  return (
    <div className="mb-6 space-y-3">
      {/* A. Planning context */}
      {showPlanningContext ? (
      <section
        aria-label="Planning context"
        className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Planning context
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {piBadge ? (
                <StatusBadge
                  status={piBadge.status}
                  label={`PI · ${piBadge.label}`}
                  size="compact"
                />
              ) : null}
              {revBadge ? (
                <StatusBadge
                  status={revBadge.status}
                  label={
                    viewingCurrent
                      ? "Current plan"
                      : revBadge.label
                  }
                  size="compact"
                />
              ) : null}
              {revision && !revision.isCurrent ? (
                <span className="truncate text-sm text-[var(--ink)]">
                  {revision.label ?? revision.key}
                </span>
              ) : (
                <span className="text-sm text-[var(--ink)]">
                  Authoritative plan
                </span>
              )}
            </div>
            {revision ? (
              <p className="text-xs text-[var(--muted)]">
                {
                  describeEditability({
                    isCurrent: revision.isCurrent,
                    status: revision.status,
                    canAllocate,
                  }).detail
                }
              </p>
            ) : null}
          </div>

          {capacitySummary ? (
            <div className="w-full max-w-sm shrink-0 space-y-1">
              <p className="text-xs font-medium text-[var(--muted)]">
                Capacity (board total)
              </p>
              <CapacityBar
                available={capacitySummary.availableHours ?? 0}
                committed={capacitySummary.committedHours}
                unavailable={capacityUnavailable}
                showPercent
              />
            </div>
          ) : null}
        </div>

        {hasWarnings ? (
          <div className="mt-3 space-y-2">
            {(capacitySummary?.blockerConflictCount ?? 0) > 0 ? (
              <Alert tone="warning" title="Conflicts" live="assertive">
                {capacitySummary!.blockerConflictCount} blocker conflict
                {capacitySummary!.blockerConflictCount === 1 ? "" : "s"} on this
                revision. Review Dependencies or overloaded cells before
                applying a scenario.
              </Alert>
            ) : null}
            {(capacitySummary?.overloadSlots ?? 0) > 0 &&
            (capacitySummary?.blockerConflictCount ?? 0) === 0 ? (
              <Alert tone="warning" title="Overload" live="assertive">
                {capacitySummary!.overloadSlots} team×iteration slot
                {capacitySummary!.overloadSlots === 1 ? "" : "s"} overloaded.
              </Alert>
            ) : null}
            {revision &&
            !revision.isCurrent &&
            revision.status !== "DRAFT" ? (
              <Alert tone="info" title="Read-only scenario" live="polite">
                Viewing a non-draft scenario. Allocation edits are disabled.
              </Alert>
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}

      {/* C. Scenarios (selector always visible; admin disclosed) */}
      <section
        aria-label="Scenarios"
        className="rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-3 sm:px-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Scenarios
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Switch the current plan or a draft scenario without leaving the
              board.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scenarios.length >= 2 ? (
              <Link
                href={compareHref()}
                className="rounded-[var(--radius-md)] border border-[var(--line)] px-2.5 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                Compare scenarios
              </Link>
            ) : null}
            <Link
              href={reviewHref()}
              className="rounded-[var(--radius-md)] border border-[var(--line)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              Review
            </Link>
            {pending ? (
              <span className="text-xs text-[var(--muted)]" aria-live="polite">
                Working…
              </span>
            ) : null}
          </div>
        </div>

        <ul
          className="mt-3 flex flex-wrap gap-2"
          aria-label="Scenario list"
        >
          {scenarios.map((s) => {
            const active = s.id === activeRevisionId;
            const badge = scenarioBadgeFor(s);
            return (
              <li key={s.id} className="max-w-full list-none">
                <Link
                  href={hrefFor(s.id, s.isCurrent)}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]"
                      : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <span className="truncate font-medium">
                    {scenarioChipLabel(s)}
                  </span>
                  <StatusBadge
                    status={badge.status}
                    label={badge.label}
                    size="compact"
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        {error ? (
          <div className="mt-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}

        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-1 py-1 text-left text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            aria-expanded={manageOpen}
            aria-controls={manageId}
            onClick={() => setManageOpen((o) => !o)}
          >
            <span>Manage scenarios</span>
            <span className="text-xs font-normal text-[var(--muted)]">
              {manageOpen ? "Hide create, clone, rename, archive" : "Create, clone, rename, archive"}
            </span>
          </button>

          {manageOpen ? (
            <div id={manageId} className="mt-3 space-y-4">
              {!canAllocate ? (
                <p className="text-xs text-[var(--muted)]" role="status">
                  Scenario create and lifecycle actions require planning
                  permission. You can still switch plans and open Compare /
                  Review.
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!canAllocate || !createLabel.trim() || pending) return;
                    run(async () => {
                      const result = await createScenarioFromCurrentAction({
                        piId,
                        label: createLabel.trim(),
                      });
                      if (result.ok) {
                        setCreateLabel("");
                        router.push(hrefFor(result.data.id, false));
                      }
                      return result;
                    });
                  }}
                >
                  <p className="text-xs font-medium">Create from current plan</p>
                  <FormField
                    label="Scenario name"
                    htmlFor="scenario-create-label"
                    hint="Starts as a draft copy of the current plan."
                  >
                    <input
                      id="scenario-create-label"
                      className={fieldClassName}
                      value={createLabel}
                      onChange={(e) => setCreateLabel(e.target.value)}
                      maxLength={200}
                      required
                      disabled={!canAllocate || pending}
                      title={permissionTitle(canAllocate)}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={pending}
                    disabled={!canAllocate || pending}
                    title={permissionTitle(canAllocate)}
                  >
                    Create scenario
                  </Button>
                </form>

                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      !canAllocate ||
                      !cloneFromId ||
                      !cloneLabel.trim() ||
                      pending
                    )
                      return;
                    const source = draftScenarios.find(
                      (s) => s.id === cloneFromId,
                    );
                    if (!source) return;
                    run(async () => {
                      const result = await cloneScenarioAction({
                        revisionId: cloneFromId,
                        label: cloneLabel.trim(),
                        expectedVersion: source.version,
                      });
                      if (result.ok) {
                        setCloneLabel("");
                        router.push(hrefFor(result.data.id, false));
                      }
                      return result;
                    });
                  }}
                >
                  <p className="text-xs font-medium">Clone DRAFT scenario</p>
                  <FormField label="Source" htmlFor="scenario-clone-from">
                    <select
                      id="scenario-clone-from"
                      className={fieldClassName}
                      value={cloneFromId}
                      onChange={(e) => setCloneFromId(e.target.value)}
                      disabled={
                        !canAllocate || pending || draftScenarios.length === 0
                      }
                      title={
                        draftScenarios.length === 0
                          ? "No DRAFT scenarios available to clone"
                          : permissionTitle(canAllocate)
                      }
                    >
                      <option value="">Select…</option>
                      {draftScenarios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label ?? s.key}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="New name" htmlFor="scenario-clone-label">
                    <input
                      id="scenario-clone-label"
                      className={fieldClassName}
                      value={cloneLabel}
                      onChange={(e) => setCloneLabel(e.target.value)}
                      maxLength={200}
                      required
                      disabled={!canAllocate || pending}
                      title={permissionTitle(canAllocate)}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={pending}
                    disabled={
                      !canAllocate || pending || draftScenarios.length === 0
                    }
                    title={
                      draftScenarios.length === 0
                        ? "No DRAFT scenarios available to clone"
                        : permissionTitle(canAllocate)
                    }
                  >
                    Clone scenario
                  </Button>
                </form>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      !canAllocate ||
                      !renameId ||
                      !renameLabel.trim() ||
                      pending
                    )
                      return;
                    const source = scenarios.find(
                      (s) => s.id === renameId && !s.isCurrent,
                    );
                    if (!source) return;
                    run(async () => {
                      const result = await renameScenarioAction({
                        revisionId: renameId,
                        label: renameLabel.trim(),
                        expectedVersion: source.version,
                      });
                      if (result.ok) setRenameLabel("");
                      return result;
                    });
                  }}
                >
                  <p className="text-xs font-medium">Rename scenario</p>
                  <FormField label="Scenario" htmlFor="scenario-rename-id">
                    <select
                      id="scenario-rename-id"
                      className={fieldClassName}
                      value={renameId}
                      onChange={(e) => {
                        setRenameId(e.target.value);
                        const s = scenarios.find(
                          (x) => x.id === e.target.value,
                        );
                        setRenameLabel(s?.label ?? "");
                      }}
                      disabled={!canAllocate || pending}
                      title={permissionTitle(canAllocate)}
                    >
                      <option value="">Select…</option>
                      {scenarios
                        .filter((s) => !s.isCurrent && s.status !== "ARCHIVED")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label ?? s.key}
                          </option>
                        ))}
                    </select>
                  </FormField>
                  <FormField label="New label" htmlFor="scenario-rename-label">
                    <input
                      id="scenario-rename-label"
                      className={fieldClassName}
                      value={renameLabel}
                      onChange={(e) => setRenameLabel(e.target.value)}
                      maxLength={200}
                      required
                      disabled={!canAllocate || pending}
                      title={permissionTitle(canAllocate)}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    loading={pending}
                    disabled={!canAllocate || pending}
                    title={permissionTitle(canAllocate)}
                  >
                    Rename
                  </Button>
                </form>

                <div className="space-y-2">
                  <p className="text-xs font-medium">Lifecycle</p>
                  <p className="text-xs text-[var(--muted)]">
                    Mark ready for review, reopen drafts, or archive. Does not
                    approve or baseline the plan.
                  </p>
                  <ul className="space-y-2 text-sm">
                    {scenarios
                      .filter((s) => !s.isCurrent && s.status !== "ARCHIVED")
                      .map((s) => {
                        const badge = scenarioBadgeFor(s);
                        return (
                          <li
                            key={s.id}
                            className="flex flex-wrap items-center gap-2 rounded border border-[var(--line)] px-2 py-1.5"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {s.label ?? s.key}
                            </span>
                            <StatusBadge
                              status={badge.status}
                              label={badge.label}
                              size="compact"
                            />
                            {s.status === "DRAFT" ? (
                              <button
                                type="button"
                                className="text-xs text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                                disabled={!canAllocate || pending}
                                title={permissionTitle(canAllocate)}
                                onClick={() =>
                                  run(() =>
                                    markScenarioReadyAction({
                                      revisionId: s.id,
                                      expectedVersion: s.version,
                                    }),
                                  )
                                }
                              >
                                Mark ready
                              </button>
                            ) : null}
                            {s.status === "READY_FOR_REVIEW" ? (
                              <button
                                type="button"
                                className="text-xs text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                                disabled={!canAllocate || pending}
                                title={permissionTitle(canAllocate)}
                                onClick={() =>
                                  run(() =>
                                    reopenScenarioAction({
                                      revisionId: s.id,
                                      expectedVersion: s.version,
                                    }),
                                  )
                                }
                              >
                                Reopen
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="min-h-9 text-xs text-[var(--danger)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                              disabled={!canAllocate || pending}
                              title={permissionTitle(canAllocate)}
                              onClick={() => {
                                setArchiveError(null);
                                setArchiveTarget({
                                  id: s.id,
                                  version: s.version,
                                  label: s.label ?? s.key,
                                });
                              }}
                            >
                              Archive
                            </button>
                          </li>
                        );
                      })}
                    {scenarios.every(
                      (s) => s.isCurrent || s.status === "ARCHIVED",
                    ) ? (
                      <li className="text-xs text-[var(--muted)]">
                        No active scenario drafts. Create one to explore an
                        alternative plan.
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <ConfirmDialog
          open={archiveTarget != null}
          onOpenChange={(open) => {
            if (!open && !pending) {
              setArchiveTarget(null);
              setArchiveError(null);
            }
          }}
          title="Archive scenario?"
          description={
            archiveTarget
              ? `Archive “${archiveTarget.label}”. It will leave the active scenario list. The current plan, selected scenario, and approvals are unchanged. Archiving is reversible only by creating a new scenario.`
              : "Archive this scenario."
          }
          confirmLabel="Archive scenario"
          cancelLabel="Cancel"
          variant="destructive"
          pending={pending}
          error={archiveError}
          onConfirm={() => {
            if (!archiveTarget || !canAllocate) return;
            const target = archiveTarget;
            setArchiveError(null);
            startTransition(async () => {
              const result = await archiveScenarioAction({
                revisionId: target.id,
                expectedVersion: target.version,
              });
              if (!result.ok) {
                setArchiveError(
                  result.error?.message ?? "Could not archive scenario.",
                );
                return;
              }
              setArchiveTarget(null);
              setArchiveError(null);
              router.refresh();
            });
          }}
        />
      </section>
    </div>
  );
}
