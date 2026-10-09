import Link from "next/link";
import { EmptyState, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { mapDeliveryHealthBadge } from "@/components/ui/status-adapters";
import { appendReturnContext } from "@/modules/navigation/return-context";
import type {
  DeliveryHealthAttentionResult,
  DeliveryHealthAttentionRow,
  DeliveryHealthClassification,
  DeliveryHealthEvaluation,
  DeliveryHealthReason,
  DeliveryHealthSummary,
} from "@/modules/portfolio/domain/types";

export const HEALTH_LABELS: Record<DeliveryHealthClassification, string> = {
  BLOCKED: "Blocked",
  AT_RISK: "At risk",
  ON_TRACK: "On track",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  UNKNOWN: "Unknown / insufficient data",
};

const HEALTH_ORDER: DeliveryHealthClassification[] = [
  "BLOCKED",
  "AT_RISK",
  "ON_TRACK",
  "UNKNOWN",
  "COMPLETED",
  "CANCELLED",
];

const SEVERITY_RANK: Record<DeliveryHealthReason["severity"], number> = {
  blocker: 0,
  critical: 1,
  warning: 2,
  info: 3,
};

/** Primary reason = highest severity, then first listed (deterministic). */
export function primaryReason(
  reasons: DeliveryHealthReason[],
): DeliveryHealthReason | null {
  if (reasons.length === 0) return null;
  return [...reasons].sort((a, b) => {
    const bySev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySev !== 0) return bySev;
    return a.code.localeCompare(b.code);
  })[0]!;
}

export function countReasonsByCode(
  reasons: DeliveryHealthReason[],
  code: DeliveryHealthReason["code"],
): number {
  return reasons.filter((r) => r.code === code).length;
}

export function healthBadgeClass(
  classification: DeliveryHealthClassification,
): string {
  switch (classification) {
    case "BLOCKED":
      return "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]";
    case "AT_RISK":
      return "border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[var(--warning)]";
    case "ON_TRACK":
      return "border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]";
    case "UNKNOWN":
      return "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]";
    case "COMPLETED":
      return "border-[var(--line)] bg-white text-[var(--ink)]";
    case "CANCELLED":
      return "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]";
    default:
      return "border-[var(--line)] bg-white text-[var(--ink)]";
  }
}

export function HealthBadge({
  classification,
}: {
  classification: DeliveryHealthClassification;
}) {
  const mapped = mapDeliveryHealthBadge(classification);
  return (
    <StatusBadge
      status={mapped.status}
      label={mapped.label}
      size="compact"
    />
  );
}

/** Truthful source navigation — only real project section anchors. */
export function reasonEvidenceHref(
  evaluationOrHref: { href: string } | string,
  reason: DeliveryHealthReason,
): { href: string; label: string } {
  const projectHref =
    typeof evaluationOrHref === "string"
      ? evaluationOrHref
      : evaluationOrHref.href;

  switch (reason.sourceType) {
    case "PROJECT_ISSUE":
      return {
        href: `${projectHref}#issues`,
        label: "Open project issues section",
      };
    case "PROJECT_MILESTONE":
      return {
        href: `${projectHref}#milestones`,
        label: "Open project milestones section",
      };
    case "PLANNING_DEPENDENCY":
      return {
        href: projectHref,
        label: "Open project (dependency detail has no dedicated route)",
      };
    case "PROJECT_CLOSURE":
    case "PROJECT":
    case "EVALUATION":
    default:
      return { href: projectHref, label: "Open project" };
  }
}

/** M4E-D: classification chips target the Delivery Health hub (not Portfolio). */
export function buildHealthHubHref(opts: {
  organizationId: string;
  departmentId?: string | null;
  healthFocus?: DeliveryHealthClassification | "ATTENTION" | null;
}): string {
  const params = new URLSearchParams();
  params.set("organizationId", opts.organizationId);
  if (opts.departmentId) params.set("departmentId", opts.departmentId);
  if (opts.healthFocus) params.set("healthFocus", opts.healthFocus);
  return `/portfolio/health?${params.toString()}`;
}

function healthReturn(
  organizationId: string,
  departmentId?: string | null,
) {
  return {
    from: "health" as const,
    organizationId,
    departmentId: departmentId ?? undefined,
  };
}

export function DeliveryHealthCountsSection({
  summary,
  organizationId,
  departmentId,
  healthFocus,
}: {
  summary: DeliveryHealthSummary;
  organizationId: string;
  departmentId?: string | null;
  healthFocus?: string | null;
}) {
  return (
    <section aria-labelledby="delivery-health-counts">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="delivery-health-counts"
            className="text-sm font-medium tracking-wide text-[var(--muted)]"
          >
            Delivery health
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Classifications from the M2D-A query service (not recalculated in the
            browser). Unknown is distinct from On track.
          </p>
        </div>
        <p className="rounded-md bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--accent)]">
          Attention (blocked + at risk):{" "}
          <span className="font-medium tabular-nums">
            {summary.attentionCount}
          </span>
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {HEALTH_ORDER.map((key) => {
          const count = summary.counts[key];
          const active = healthFocus === key;
          const tone =
            key === "BLOCKED" || key === "AT_RISK"
              ? count > 0
                ? "attention"
                : "default"
              : "default";
          return (
            <Panel
              key={key}
              className={`h-full ${
                tone === "attention" ? "border-[var(--warning)]/40" : ""
              } ${active ? "ring-2 ring-[var(--accent)]" : ""}`}
            >
              <Link
                href={buildHealthHubHref({
                  organizationId,
                  departmentId,
                  healthFocus: key,
                })}
                className="block min-h-11 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <p className="text-sm text-[var(--muted)]">
                  {HEALTH_LABELS[key]}
                </p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tabular-nums">
                  {count}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {key === "UNKNOWN"
                    ? "Insufficient schedule evidence — not On track"
                    : key === "CANCELLED"
                      ? "Terminal — not successful completion"
                      : "View matching projects below"}
                </p>
              </Link>
            </Panel>
          );
        })}
      </div>
      {summary.totalProjects === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No projects in this portfolio scope (count 0).
        </p>
      ) : null}
    </section>
  );
}

export function DeliveryHealthAttentionList({
  attention,
  organizationId,
  departmentId,
  healthFocus,
}: {
  attention: DeliveryHealthAttentionResult;
  organizationId: string;
  departmentId?: string | null;
  healthFocus?: string | null;
}) {
  const title =
    healthFocus && healthFocus !== "ATTENTION"
      ? `${HEALTH_LABELS[healthFocus as DeliveryHealthClassification] ?? healthFocus} projects`
      : "Management attention — blocked & at risk";

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ordered by classification severity (Blocked before At risk), then
            reference key. Open Explain for full reasons.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {healthFocus ? (
            <Link
              href={buildHealthHubHref({
                organizationId,
                departmentId,
                healthFocus: null,
              })}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Clear health focus
            </Link>
          ) : null}
          <Link
            href={`/portfolio/explorer?organizationId=${organizationId}${
              departmentId ? `&departmentId=${departmentId}` : ""
            }${
              healthFocus &&
              ["BLOCKED", "AT_RISK", "ON_TRACK", "COMPLETED", "CANCELLED", "UNKNOWN"].includes(
                healthFocus,
              )
                ? `&deliveryHealth=${healthFocus}&kind=PROJECT`
                : "&kind=PROJECT&deliveryHealth=AT_RISK"
            }`}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Open in explorer
          </Link>
        </div>
      </div>

      {attention.total === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No projects in this attention view"
            description={
              healthFocus
                ? `No projects classified as ${HEALTH_LABELS[healthFocus as DeliveryHealthClassification] ?? healthFocus} in the current scope.`
                : "No blocked or at-risk projects in the current scope."
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Project</th>
                  <th className="py-2 pr-3 font-medium">Health</th>
                  <th className="py-2 pr-3 font-medium">Primary reason</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Department</th>
                  <th className="py-2 pr-3 font-medium">Relevant date</th>
                  <th className="py-2 pr-3 font-medium">Signals</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {attention.rows.map((row) => (
                  <AttentionRowDesktop
                    key={row.projectId}
                    row={row}
                    organizationId={organizationId}
                    departmentId={departmentId}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <ul className="mt-4 space-y-3 md:hidden">
            {attention.rows.map((row) => (
              <li
                key={row.projectId}
                className="rounded-md border border-[var(--line)] p-3"
              >
                <AttentionRowMobile
                  row={row}
                  organizationId={organizationId}
                  departmentId={departmentId}
                />
              </li>
            ))}
          </ul>

          {attention.total > attention.rows.length ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Showing {attention.rows.length} of {attention.total}. Use Explorer
              for full pagination.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

function AttentionSignals({ row }: { row: DeliveryHealthAttentionRow }) {
  const blockers = countReasonsByCode(row.reasons, "ACTIVE_BLOCKER_ISSUE");
  const critical = countReasonsByCode(row.reasons, "CRITICAL_OPEN_ISSUE");
  const parts: string[] = [];
  if (blockers > 0) parts.push(`${blockers} active blocker${blockers === 1 ? "" : "s"}`);
  if (critical > 0)
    parts.push(`${critical} critical issue${critical === 1 ? "" : "s"}`);
  if (parts.length === 0) return <span className="text-[var(--muted)]">—</span>;
  return <span>{parts.join(" · ")}</span>;
}

function AttentionRowDesktop({
  row,
  organizationId,
  departmentId,
}: {
  row: DeliveryHealthAttentionRow;
  organizationId: string;
  departmentId?: string | null;
}) {
  const primary = primaryReason(row.reasons);
  const ret = healthReturn(organizationId, departmentId);
  const explainHref = `/portfolio/health?organizationId=${organizationId}${departmentId ? `&departmentId=${departmentId}` : ""}&projectId=${row.projectId}`;
  const projectTarget = primary
    ? reasonEvidenceHref(row.href, primary)
    : { href: row.href, label: "Open project" };
  const projectHref = appendReturnContext(projectTarget.href, ret);
  return (
    <tr>
      <td className="py-3 pr-3">
        <Link
          href={projectHref}
          className="font-medium text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {row.referenceKey}
        </Link>
        <p className="text-[var(--muted)]">{row.name}</p>
      </td>
      <td className="py-3 pr-3">
        <HealthBadge classification={row.classification} />
      </td>
      <td className="py-3 pr-3">
        {primary ? (
          <span title={primary.message}>{primary.code.replaceAll("_", " ")}</span>
        ) : (
          <span className="text-[var(--muted)]">—</span>
        )}
      </td>
      <td className="py-3 pr-3">
        {row.owner.displayName}
        {row.owner.source === "legacy" ? (
          <span className="ml-1 text-xs text-[var(--muted)]">(legacy)</span>
        ) : null}
      </td>
      <td className="py-3 pr-3 text-[var(--muted)]">
        {row.sectionName} / {row.departmentName}
      </td>
      <td className="py-3 pr-3 tabular-nums text-[var(--muted)]">
        {row.plannedEnd
          ? new Date(row.plannedEnd).toLocaleDateString()
          : primary?.relevantAt
            ? new Date(primary.relevantAt).toLocaleDateString()
            : "—"}
      </td>
      <td className="py-3 pr-3 text-xs">
        <AttentionSignals row={row} />
      </td>
      <td className="py-3">
        <div className="flex flex-col gap-1">
          <Link
            href={explainHref}
            className="inline-flex min-h-11 items-center text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Explain
          </Link>
          <Link
            href={projectHref}
            className="inline-flex min-h-11 items-center text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {projectTarget.label.startsWith("Open project")
              ? "Open project"
              : projectTarget.label}
          </Link>
        </div>
      </td>
    </tr>
  );
}

function AttentionRowMobile({
  row,
  organizationId,
  departmentId,
}: {
  row: DeliveryHealthAttentionRow;
  organizationId: string;
  departmentId?: string | null;
}) {
  const primary = primaryReason(row.reasons);
  const ret = healthReturn(organizationId, departmentId);
  const explainHref = `/portfolio/health?organizationId=${organizationId}${departmentId ? `&departmentId=${departmentId}` : ""}&projectId=${row.projectId}`;
  const projectTarget = primary
    ? reasonEvidenceHref(row.href, primary)
    : { href: row.href, label: "Open project" };
  const projectHref = appendReturnContext(projectTarget.href, ret);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={projectHref}
          className="font-medium text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {row.referenceKey} · {row.name}
        </Link>
        <HealthBadge classification={row.classification} />
      </div>
      <p className="mt-2 text-sm">
        {primary
          ? `${primary.code.replaceAll("_", " ")} — ${primary.message}`
          : "No structured reasons"}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Owner: {row.owner.displayName} · {row.departmentName}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        <AttentionSignals row={row} />
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        <Link
          href={explainHref}
          className="inline-flex min-h-11 items-center text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Explain health
        </Link>
        <Link
          href={projectHref}
          className="inline-flex min-h-11 items-center text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Open project
        </Link>
      </div>
    </>
  );
}

export function DeliveryHealthExplanation({
  evaluation,
  organizationId,
  projectLabel,
}: {
  evaluation: DeliveryHealthEvaluation;
  organizationId: string;
  projectLabel?: { referenceKey: string; name: string } | null;
}) {
  const sorted = [...evaluation.reasons].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.code.localeCompare(b.code),
  );
  const ret = healthReturn(organizationId);
  const projectHref = appendReturnContext(evaluation.href, ret);
  const hubHref = buildHealthHubHref({ organizationId });

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Current delivery health</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <HealthBadge classification={evaluation.classification} />
              {projectLabel ? (
                <h2 className="font-[family-name:var(--font-display)] text-xl">
                  {projectLabel.referenceKey} · {projectLabel.name}
                </h2>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Project status {evaluation.projectStatus}
              {evaluation.closureOutcome
                ? ` · Closure outcome ${evaluation.closureOutcome}`
                : ""}
              {" · "}
              As of {new Date(evaluation.asOf).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={projectHref}
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Open project
            </Link>
            <Link
              href={hubHref}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Health hub
            </Link>
            <Link
              href={appendReturnContext(
                `/portfolio?organizationId=${organizationId}`,
                ret,
              )}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Portfolio
            </Link>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="font-medium">Contributing reasons</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Structured explainability from M2D-A. Source-level links only go to
          supported project sections — never placeholder routes.
        </p>
        {sorted.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No reasons returned.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {sorted.map((reason, idx) => {
              const nav = reasonEvidenceHref(evaluation, reason);
              return (
                <li key={`${reason.code}-${reason.sourceId ?? "x"}-${idx}`} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {reason.code.replaceAll("_", " ")}
                        <span className="ml-2 text-xs font-normal uppercase tracking-wide text-[var(--muted)]">
                          {reason.severity}
                        </span>
                      </p>
                      <p className="mt-1 text-sm">{reason.message}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Source: {reason.sourceType}
                        {reason.sourceId ? ` · ${reason.sourceId}` : ""}
                        {reason.relevantStatus
                          ? ` · Status ${reason.relevantStatus}`
                          : ""}
                        {reason.relevantAt
                          ? ` · ${new Date(reason.relevantAt).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                    <Link
                      href={appendReturnContext(nav.href, ret)}
                      className="text-sm text-[var(--accent)] underline"
                    >
                      {nav.label}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
