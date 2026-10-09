import Link from "next/link";
import type { InitiativeStage } from "@prisma/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { mapInitiativeStageBadge } from "@/components/ui/status-adapters";
import {
  buildInitiativeTabGroups,
  buildLifecycleStageViews,
  type InitiativeTabKey,
  type InitiativeTabVisibility,
} from "@/modules/initiative/application/initiative-journey";
import { appendPreservedQuery } from "@/modules/navigation/return-context";

export type { InitiativeTabKey };

export function LifecycleRail({
  current,
  ownerName,
  nextActionLabel,
  blockedReason,
}: {
  current: InitiativeStage;
  ownerName?: string | null;
  nextActionLabel?: string | null;
  blockedReason?: string | null;
}) {
  const stages = buildLifecycleStageViews(current);
  const currentBadge = mapInitiativeStageBadge(current);

  return (
    <div
      className="space-y-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4"
      aria-label="Initiative lifecycle"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Lifecycle
          </p>
          <StatusBadge
            status={currentBadge.status}
            label={`Current · ${currentBadge.label}`}
            size="compact"
          />
          {ownerName ? (
            <span className="text-xs text-[var(--muted)]">
              Owner: <span className="text-[var(--ink)]">{ownerName}</span>
            </span>
          ) : null}
        </div>
        <p className="text-[10px] text-[var(--muted)]">
          Visual stage ≠ approval. Governance decisions remain separate.
        </p>
      </div>
      <ol className="flex flex-wrap gap-2 text-sm">
        {stages.map((stage) => {
          const badge = mapInitiativeStageBadge(stage.stage);
          return (
            <li
              key={stage.stage}
              aria-current={stage.state === "current" ? "step" : undefined}
              className={`rounded-md border px-3 py-1.5 ${
                stage.state === "current"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : stage.state === "completed"
                    ? "border-[var(--line)] text-[var(--ok)]"
                    : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>
                  {stage.state === "completed"
                    ? "✓"
                    : stage.state === "current"
                      ? "●"
                      : "○"}
                </span>
                {stage.label}
                {stage.state === "current" ? (
                  <StatusBadge
                    status={badge.status}
                    label={badge.label}
                    size="compact"
                  />
                ) : null}
              </span>
            </li>
          );
        })}
        <li className="rounded-md border border-[var(--line)] px-3 py-1.5 text-[var(--muted)]">
          <Link href="/pi" className="hover:text-[var(--accent)]">
            ○ PI Planning
          </Link>
          <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
            module
          </span>
        </li>
      </ol>
      {nextActionLabel ? (
        <p className="text-xs text-[var(--ink)]">
          <span className="font-semibold">Required next action: </span>
          {nextActionLabel}
          {blockedReason ? (
            <span className="mt-0.5 block text-[var(--danger)]">
              Blocked: {blockedReason}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function InitiativeTabs({
  initiativeId,
  active,
  currentStage,
  hasGovernance,
  hasPoC,
  hasPilot,
  hasProject,
  preserveQuery,
}: {
  initiativeId: string;
  active: InitiativeTabKey;
  currentStage?: InitiativeStage;
  hasGovernance?: boolean;
  hasPoC?: boolean;
  hasPilot?: boolean;
  hasProject?: boolean;
  /** Pack validated return-context query keys across initiative tabs. */
  preserveQuery?:
    | URLSearchParams
    | Record<string, string | string[] | undefined>;
}) {
  const visibility: InitiativeTabVisibility = {
    currentStage,
    hasGovernance,
    hasPoC,
    hasPilot,
    hasProject,
  };
  const groups = buildInitiativeTabGroups(visibility);

  return (
    <nav className="mb-5 space-y-3" aria-label="Initiative sections">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-4">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`min-w-0 ${
              group.emphasizesCurrentStage
                ? "rounded-[var(--radius-md)] border border-[var(--accent)]/40 bg-[var(--accent-soft)]/40 px-2 py-1.5"
                : ""
            }`}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {group.label}
              {group.emphasizesCurrentStage ? (
                <span className="ml-1 text-[var(--accent)]">· current</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-1 border-b border-[var(--line)] lg:border-b-0">
              {group.tabs.map(({ key, label, hrefPath }) => {
                const path =
                  hrefPath === ""
                    ? `/initiatives/${initiativeId}`
                    : `/initiatives/${initiativeId}/${hrefPath}`;
                const href = preserveQuery
                  ? appendPreservedQuery(path, preserveQuery)
                  : path;
                const isActive = active === key;
                return (
                  <Link
                    key={key}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={`border-b-2 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                      isActive
                        ? "border-[var(--accent)] font-medium text-[var(--accent)]"
                        : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function AttentionPanel({
  items,
}: {
  items: { key: string; severity: string; message: string }[];
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-medium">What needs attention</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          No attention items for the current state.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.key} className="text-sm">
              <span
                className={
                  item.severity === "blocker"
                    ? "text-[var(--danger)]"
                    : item.severity === "warning"
                      ? "text-[var(--warning)]"
                      : "text-[var(--muted)]"
                }
              >
                {item.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReadinessPanel({
  readiness,
}: {
  readiness: {
    ready: boolean;
    items: { key: string; label: string; status: string; detail: string }[];
  } | null;
}) {
  if (!readiness) return null;
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Pre-study readiness</h2>
        <span
          className={`text-sm font-medium ${
            readiness.ready ? "text-[var(--ok)]" : "text-[var(--danger)]"
          }`}
        >
          {readiness.ready ? "READY" : "NOT READY"}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Readiness means enough information to ask for a governance decision. It
        is not an approval.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {readiness.items.map((item) => (
          <li key={item.key} className="flex justify-between gap-3">
            <span>{item.label}</span>
            <span
              className={
                item.status === "complete"
                  ? "text-[var(--ok)]"
                  : item.status === "warning"
                    ? "text-[var(--warning)]"
                    : "text-[var(--danger)]"
              }
            >
              {item.status === "complete"
                ? "Complete"
                : item.status === "warning"
                  ? "Warning"
                  : "Incomplete"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
