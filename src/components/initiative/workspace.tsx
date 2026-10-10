/**
 * M5C-A — Premium Initiative Workspace chrome (presentation only).
 * Consumes existing workspace / journey helpers; no domain rule changes.
 */
import Link from "next/link";
import type { InitiativeStage, InitiativeStatus } from "@prisma/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { Panel } from "@/components/ui/page";
import { mapInitiativeStageBadge } from "@/components/ui/status-adapters";
import { stageLabel } from "@/modules/initiative/application/attention";
import {
  buildInitiativeTabGroups,
  buildPremiumLifecycleSteps,
  ownershipBasisLabel,
  resolveOwnershipParty,
  type InitiativeTabKey,
  type InitiativeTabVisibility,
  type OwnershipPartyDisplay,
  type PremiumLifecycleInput,
  type PremiumLifecycleStep,
} from "@/modules/initiative/application/initiative-journey";
import { appendPreservedQuery } from "@/modules/navigation/return-context";

export type { InitiativeTabKey };

function partyName(party: OwnershipPartyDisplay): string {
  return party.name ?? "Not set";
}

export function InitiativeHeader({
  referenceKey,
  title,
  currentStage,
  status,
  owner,
  departmentName,
  organizationName,
  priorityLabel,
  createdAt,
  updatedAt,
  actions,
}: {
  referenceKey: string;
  title: string;
  currentStage: InitiativeStage;
  status: InitiativeStatus;
  owner: OwnershipPartyDisplay;
  departmentName: string;
  organizationName?: string | null;
  priorityLabel?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  actions?: React.ReactNode;
}) {
  const stageBadge = mapInitiativeStageBadge(currentStage);
  const created =
    createdAt instanceof Date
      ? createdAt.toISOString().slice(0, 10)
      : createdAt
        ? String(createdAt).slice(0, 10)
        : null;
  const updated =
    updatedAt instanceof Date
      ? updatedAt.toISOString().slice(0, 10)
      : updatedAt
        ? String(updatedAt).slice(0, 10)
        : null;

  return (
    <header className="mb-5 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
            Initiative · {referenceKey}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Situation overview for discovery through delivery. Stage progress is
            visual orientation — governance decisions remain separate.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={stageBadge.status} label={stageBadge.label} />
          <StatusBadge
            status={status === "ACTIVE" ? "in-progress" : "archived"}
            label={status}
            size="compact"
          />
          {actions}
        </div>
      </div>

      <dl className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Business owner
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
            {partyName(owner)}
          </dd>
          <dd className="text-[11px] text-[var(--muted)]">
            {ownershipBasisLabel(owner.basis)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Requesting organization
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {organizationName ? `${organizationName} · ` : null}
            {departmentName}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Priority
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {priorityLabel ?? "Not set"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Current stage
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {stageLabel(currentStage)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Created
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">{created ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Updated
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">{updated ?? "—"}</dd>
        </div>
      </dl>
    </header>
  );
}

function stepMarker(state: PremiumLifecycleStep["state"]): string {
  switch (state) {
    case "completed":
      return "✓";
    case "current":
      return "●";
    case "blocked":
      return "!";
    default:
      return "○";
  }
}

export function LifecycleRail({
  current,
  ownerName,
  nextActionLabel,
  blockedReason,
  premium,
}: {
  current: InitiativeStage;
  ownerName?: string | null;
  nextActionLabel?: string | null;
  blockedReason?: string | null;
  /** When set, renders Demand→…→Governance→…→Project presentation spine. */
  premium?: PremiumLifecycleInput;
}) {
  const steps: PremiumLifecycleStep[] = premium
    ? buildPremiumLifecycleSteps(premium)
    : buildPremiumLifecycleSteps({ currentStage: current });
  const currentBadge = mapInitiativeStageBadge(current);
  const summary = steps
    .map((s) => `${s.label}: ${s.stateLabel}`)
    .join("; ");

  return (
    <div
      className="space-y-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4"
      aria-label="Initiative lifecycle progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Lifecycle progress
          </p>
          <StatusBadge
            status={currentBadge.status}
            label={`Domain stage · ${currentBadge.label}`}
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

      <ol className="flex flex-wrap gap-2 text-sm" aria-label={summary}>
        {steps.map((stage) => (
          <li
            key={stage.id}
            aria-current={stage.state === "current" ? "step" : undefined}
            className={`rounded-md border px-3 py-1.5 ${
              stage.state === "current"
                ? "border-[#087f78] bg-[var(--accent-soft)] text-[#087f78]"
                : stage.state === "completed"
                  ? "border-[var(--line)] text-[var(--ok)]"
                  : stage.state === "blocked"
                    ? "border-[var(--danger)] bg-red-50 text-[var(--danger)]"
                    : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden>{stepMarker(stage.state)}</span>
              <span>{stage.label}</span>
              <span className="sr-only">({stage.stateLabel})</span>
            </span>
          </li>
        ))}
        <li className="rounded-md border border-[var(--line)] px-3 py-1.5 text-[var(--muted)]">
          <Link
            href="/pi"
            className="hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
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
            <span className="mt-0.5 block text-[var(--danger)]" role="status">
              Blocked: {blockedReason}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function NextActionPanel({
  label,
  detail,
  blocked,
  children,
  href,
  ctaLabel,
}: {
  label: string;
  detail: string;
  blocked: boolean;
  children?: React.ReactNode;
  href?: string | null;
  ctaLabel?: string | null;
}) {
  return (
    <section
      aria-labelledby="initiative-next-action"
      className={`rounded-[var(--radius-md)] border-2 px-4 py-4 sm:px-5 ${
        blocked
          ? "border-[var(--danger)] bg-red-50/60"
          : "border-[#087f78]/50 bg-[var(--accent-soft)]/50"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
        Next action
      </p>
      <h2
        id="initiative-next-action"
        className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
      >
        {label}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
      {blocked ? (
        <p className="mt-2 text-sm font-medium text-[var(--danger)]" role="alert">
          Progression is blocked until the condition above is resolved.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {href && ctaLabel ? (
          <Link
            href={href}
            className="inline-flex min-h-11 items-center rounded-md bg-[#087f78] px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {ctaLabel}
          </Link>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export function SituationOverview({
  problem,
  expectedValue,
  strategicAlignment,
  priorityLabel,
  owner,
  requester,
  sponsor,
  risks,
  emptyMessages,
}: {
  problem?: string | null;
  expectedValue?: string | null;
  strategicAlignment?: string | null;
  priorityLabel?: string | null;
  owner: OwnershipPartyDisplay;
  requester: OwnershipPartyDisplay;
  sponsor: OwnershipPartyDisplay;
  risks: { id: string; referenceKey: string; title: string; status: string }[];
  emptyMessages?: {
    problem?: string;
    value?: string;
    risks?: string;
  };
}) {
  const openRisks = risks.filter(
    (r) => r.status !== "CLOSED" && r.status !== "ACCEPTED",
  );

  return (
    <Panel aria-labelledby="situation-overview">
      <h2
        id="situation-overview"
        className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]"
      >
        Situation overview
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Why this Initiative exists, who owns it, and what needs attention.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Business problem
          </h3>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {problem?.trim() ||
              emptyMessages?.problem ||
              "No problem statement captured yet."}
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Expected value
          </h3>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {expectedValue?.trim() ||
              emptyMessages?.value ||
              "No expected value captured yet."}
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Strategic alignment
          </h3>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {strategicAlignment?.trim() || "Not set"}
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Priority
          </h3>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {priorityLabel ?? "Not set"}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-3">
        {(
          [
            ["Owner", owner],
            ["Requester", requester],
            ["Sponsor", sponsor],
          ] as const
        ).map(([role, party]) => (
          <div key={role}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {role}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {partyName(party)}
            </dd>
            <dd className="text-[11px] text-[var(--muted)]">
              {ownershipBasisLabel(party.basis)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Current risks / blockers
        </h3>
        {openRisks.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {emptyMessages?.risks || "No open risks recorded."}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {openRisks.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {r.referenceKey}
                </span>
                <span className="text-[var(--muted)]">{r.title}</span>
                <StatusBadge status="at-risk" label={r.status} size="compact" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

export function ActivityHistoryPreview({
  transitions,
  historyHref,
}: {
  transitions: {
    id: string;
    fromStage: InitiativeStage;
    toStage: InitiativeStage;
    occurredAt: Date;
    comment?: string | null;
  }[];
  historyHref: string;
}) {
  const recent = [...transitions].slice(-5).reverse();

  return (
    <Panel aria-labelledby="activity-history">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="activity-history"
            className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]"
          >
            Activity
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Authorized lifecycle transitions only — no invented events.
          </p>
        </div>
        <Link
          href={historyHref}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Full history
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No lifecycle transitions yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {recent.map((t) => (
            <li
              key={t.id}
              className="border-b border-[var(--line)] pb-2 last:border-0"
            >
              <p className="font-medium text-[var(--ink)]">
                {stageLabel(t.fromStage)} → {stageLabel(t.toStage)}
              </p>
              <p className="text-[var(--muted)]">
                {t.occurredAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                {t.comment ? ` · ${t.comment}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
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
                ? "rounded-[var(--radius-md)] border border-[#087f78]/40 bg-[var(--accent-soft)]/40 px-2 py-1.5"
                : ""
            }`}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {group.label}
              {group.emphasizesCurrentStage ? (
                <span className="ml-1 text-[#087f78]">· current</span>
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
                    className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                      isActive
                        ? "border-[#087f78] font-medium text-[#087f78]"
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
    <section
      aria-labelledby="attention-heading"
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <h2 id="attention-heading" className="font-medium">
        What needs attention
      </h2>
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
    <section
      aria-labelledby="readiness-heading"
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="readiness-heading" className="font-medium">
          Pre-study readiness
        </h2>
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

/** Helpers re-exported for overview composition. */
export { resolveOwnershipParty, ownershipBasisLabel };
