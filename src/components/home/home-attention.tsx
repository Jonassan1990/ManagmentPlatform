import Link from "next/link";
import { HealthBadge } from "@/components/portfolio/delivery-health";
import { Alert } from "@/components/ui/alert";
import { Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  DeliveryHealthAttentionResult,
  DeliveryHealthSummary,
} from "@/modules/portfolio/domain/types";
import { appendReturnContext } from "@/modules/navigation/return-context";

/**
 * Compact Home attention strip — reuses portfolio delivery-health query results.
 * No client-side recalculation.
 */
export function HomeAttentionPanel({
  organizationId,
  summary,
  attention,
  error,
  initiativeNeedsAttention,
  piNeedsAttention,
  waitingApproval,
}: {
  organizationId: string;
  summary: DeliveryHealthSummary | null;
  attention: DeliveryHealthAttentionResult | null;
  error: string | null;
  initiativeNeedsAttention: number;
  piNeedsAttention: number;
  waitingApproval: number;
}) {
  const deliveryAttention = summary?.attentionCount ?? 0;
  const rows = attention?.rows.slice(0, 5) ?? [];

  const healthHref = `/portfolio/health?organizationId=${organizationId}`;
  const portfolioAttentionHref = `/portfolio?organizationId=${organizationId}&healthFocus=ATTENTION`;

  return (
    <Panel className="border-[var(--color-warning)]/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--color-text)]">
            Needs attention
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Live signals from portfolio delivery health and overview metrics —
            not a separate scoring engine.
          </p>
        </div>
        <Link
          href={healthHref}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          Open delivery health
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AttentionStat
          label="Delivery (blocked + at risk)"
          value={deliveryAttention}
          href={portfolioAttentionHref}
          tone={deliveryAttention > 0 ? "warning" : "ok"}
        />
        <AttentionStat
          label="Initiatives needing attention"
          value={initiativeNeedsAttention}
          href="/initiatives"
          tone={initiativeNeedsAttention > 0 ? "warning" : "ok"}
        />
        <AttentionStat
          label="Waiting for approval"
          value={waitingApproval}
          href={appendReturnContext("/approvals", {
            from: "home",
            organizationId,
          })}
          tone={waitingApproval > 0 ? "warning" : "ok"}
        />
        <AttentionStat
          label="PIs needing attention"
          value={piNeedsAttention}
          href={appendReturnContext("/pi", {
            from: "home",
            organizationId,
          })}
          tone={piNeedsAttention > 0 ? "warning" : "ok"}
        />
      </div>

      {error ? (
        <div className="mt-4">
          <Alert tone="warning">
            Delivery attention could not be loaded: {error}. Other Home metrics
            remain available.
          </Alert>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Top delivery items
          </h3>
          <ul className="mt-2 divide-y divide-[var(--color-border)]">
            {rows.map((row) => (
              <li
                key={row.projectId}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={appendReturnContext(row.href, {
                      from: "home",
                      organizationId,
                    })}
                    className="inline-flex min-h-11 items-center font-medium text-[var(--color-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  >
                    {row.referenceKey} · {row.name}
                  </Link>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {row.departmentName}
                  </p>
                </div>
                <HealthBadge classification={row.classification} />
              </li>
            ))}
          </ul>
          {(attention?.total ?? 0) > rows.length ? (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Showing {rows.length} of {attention!.total}.{" "}
              <Link
                href={healthHref}
                className="text-[var(--color-primary)] hover:underline"
              >
                View all
              </Link>
            </p>
          ) : null}
        </div>
      ) : !error && deliveryAttention === 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <StatusBadge
            status="completed"
            label="No delivery blockers"
            size="compact"
          />
          Blocked and at-risk project queues are empty in this organization.
        </p>
      ) : null}
    </Panel>
  );
}

function AttentionStat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "ok" | "warning";
}) {
  return (
    <Link
      href={href}
      className={`min-h-11 rounded-[var(--radius-md)] border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
        tone === "warning"
          ? "border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-bg)]"
      }`}
    >
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl tabular-nums text-[var(--color-text)]">
        {value}
      </p>
    </Link>
  );
}
