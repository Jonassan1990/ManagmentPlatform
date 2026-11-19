/**
 * Simple manager/employee hub — four jobs, not a KPI wall.
 * Uses existing HomeDashboardResponse only (no new aggregation).
 */
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { appendReturnContext } from "@/modules/navigation/return-context";
import type {
  HomeDashboardResponse,
  HomeMyWorkItem,
} from "@/modules/portfolio/domain/home-dashboard";
import {
  attributionLabel,
  modeDescription,
  roleContextLabel,
  workKindLabel,
} from "./home-labels";

function hrefWithHome(
  href: string,
  organizationId: string | null,
): string {
  if (!organizationId) return href;
  return appendReturnContext(href, { from: "home", organizationId });
}

function orgQuery(organizationId: string | null): string {
  return organizationId ? `?organizationId=${organizationId}` : "";
}

const STAGE_HINTS = [
  { label: "1. Idea", hint: "Capture the need" },
  { label: "2. Approve", hint: "Review & decide" },
  { label: "3. Next step", hint: "Requirements → build" },
  { label: "4. Own it", hint: "Budget, people, progress" },
] as const;

export function SimpleWorkHub({
  dashboard,
}: {
  dashboard: HomeDashboardResponse;
}) {
  const orgId = dashboard.userContext.preferredOrganizationId;
  const caps = dashboard.userContext.capabilities;
  const name = dashboard.userContext.displayName?.trim() || "there";
  const preferred = dashboard.userContext.organizations.find(
    (o) => o.id === orgId,
  );
  const roleLabel = preferred
    ? roleContextLabel(preferred.roleKeys)
    : roleContextLabel(dashboard.userContext.roleBindings.map((b) => b.roleKey));

  const approvalsWaiting =
    dashboard.needsAttention.counts.waitingForApproval ?? 0;
  const attentionItems = dashboard.needsAttention.items.slice(0, 5);
  const myWork = dashboard.myWork.items.slice(0, 8);
  const ownedInitiatives = myWork.filter((i) => i.kind === "initiative");
  const ownedProjects = myWork.filter(
    (i) => i.kind === "project" || i.kind === "work_item",
  );
  const pendingDecisions = myWork.filter(
    (i) => i.kind === "approval" || i.kind === "decision",
  );

  const canCreate = caps.canCreateInitiative;
  const canApprovals = caps.canViewApprovals || caps.canReviewVacation;
  const canDecisions = caps.canViewDecisions;
  const canInitiatives = caps.canViewInitiatives;
  const canVacation = caps.canViewVacation;

  return (
    <div className="mp-stagger space-y-8">
      <header className="mp-rise">
        <p className="ds-eyebrow text-[10px]">Your workspace</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          Hello, {name}
        </h1>
        <p className="mt-1 max-w-2xl text-[var(--muted)]">
          {modeDescription(dashboard.userContext.mode)} Four jobs: capture an
          idea, get decisions approved, track people and budget, handle leave
          and cover.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {preferred ? (
            <span className="inline-flex min-h-9 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--ink)]">
              {preferred.name}
            </span>
          ) : null}
          {roleLabel ? (
            <span className="inline-flex min-h-9 items-center rounded-md border border-[var(--color-accent)]/25 bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--color-accent)]">
              {roleLabel}
            </span>
          ) : null}
        </div>
      </header>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STAGE_HINTS.map((step) => (
          <li
            key={step.label}
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
          >
            <p className="text-sm font-semibold text-[var(--ink)]">
              {step.label}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{step.hint}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <JobPanel
          title="1. Ideas"
          description="Create an idea, document the need, then move it forward after each approval."
          actions={
            <>
              {canCreate ? (
                <Link
                  href={hrefWithHome("/initiatives/new", orgId)}
                  className={buttonClassName({ variant: "primary", size: "sm" })}
                >
                  New idea
                </Link>
              ) : null}
              {canInitiatives ? (
                <Link
                  href={hrefWithHome("/initiatives", orgId)}
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  All ideas & initiatives
                </Link>
              ) : null}
              <Link
                href={hrefWithHome("/delivery", orgId)}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                How stages work
              </Link>
            </>
          }
        >
          {ownedInitiatives.length === 0 ? (
            <EmptyHint text="No initiatives linked to you yet. Start with New idea." />
          ) : (
            <WorkList items={ownedInitiatives} organizationId={orgId} />
          )}
        </JobPanel>

        <JobPanel
          title="2. Decisions & approvals"
          description="Approve leave and gate packages. Record Go / No go with a clear owner."
          actions={
            <>
              {canApprovals ? (
                <Link
                  href={hrefWithHome("/approvals", orgId)}
                  className={buttonClassName({ variant: "primary", size: "sm" })}
                >
                  Open approvals
                  {approvalsWaiting > 0 ? ` (${approvalsWaiting})` : ""}
                </Link>
              ) : null}
              {canDecisions ? (
                <Link
                  href={hrefWithHome("/decisions", orgId)}
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  Decisions to make
                </Link>
              ) : null}
            </>
          }
        >
          {pendingDecisions.length > 0 ? (
            <WorkList items={pendingDecisions} organizationId={orgId} />
          ) : attentionItems.length > 0 ? (
            <ul className="divide-y divide-[var(--line)]">
              {attentionItems.map((item) => (
                <li key={item.id} className="py-2.5">
                  <Link
                    href={hrefWithHome(item.href, orgId)}
                    className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {item.label}
                  </Link>
                  {item.detail ? (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {item.detail}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="Nothing waiting on you right now." />
          )}
        </JobPanel>

        <JobPanel
          title="3. People, workload & budget"
          description="See who is on an initiative or project, how loaded they are, and what it costs."
          actions={
            <>
              <Link
                href={hrefWithHome(
                  `/portfolio/capacity${orgQuery(orgId)}`,
                  orgId,
                )}
                className={buttonClassName({ variant: "primary", size: "sm" })}
              >
                Capacity & workload
              </Link>
              <Link
                href={hrefWithHome(`/portfolio${orgQuery(orgId)}`, orgId)}
                className={buttonClassName({
                  variant: "secondary",
                  size: "sm",
                })}
              >
                Portfolio & budget
              </Link>
              <Link
                href={hrefWithHome(
                  `/portfolio/explorer${orgQuery(orgId)}`,
                  orgId,
                )}
                className={buttonClassName({
                  variant: "secondary",
                  size: "sm",
                })}
              >
                Find initiative / project
              </Link>
            </>
          }
        >
          {ownedProjects.length === 0 ? (
            <EmptyHint text="Open Capacity for team load, or Portfolio for budget across initiatives." />
          ) : (
            <WorkList items={ownedProjects} organizationId={orgId} />
          )}
        </JobPanel>

        <JobPanel
          title="4. Vacation & handover"
          description="Request leave, approve coverage, and see who is available when work must hand over."
          actions={
            <>
              {canVacation ? (
                <Link
                  href={hrefWithHome("/vacation", orgId)}
                  className={buttonClassName({ variant: "primary", size: "sm" })}
                >
                  My vacation
                </Link>
              ) : null}
              {canVacation ? (
                <Link
                  href={hrefWithHome("/vacation/cover", orgId)}
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  Cover & handover
                </Link>
              ) : null}
              {canVacation ? (
                <Link
                  href={hrefWithHome("/vacation/plan", orgId)}
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  Team plan
                </Link>
              ) : null}
              {canApprovals ? (
                <Link
                  href={hrefWithHome("/approvals", orgId)}
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  Leave waiting for me
                </Link>
              ) : null}
            </>
          }
        >
          <EmptyHint text="Use Cover & handover before approving overlapping leave. Approvals lists leave that needs you." />
        </JobPanel>
      </div>
    </div>
  );
}

function JobPanel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel className="flex h-full flex-col">
      <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      <div className="mt-4 min-h-[4rem] flex-1 border-t border-[var(--line)] pt-3">
        {children}
      </div>
    </Panel>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-[var(--muted)]">{text}</p>;
}

function WorkList({
  items,
  organizationId,
}: {
  items: HomeMyWorkItem[];
  organizationId: string | null;
}) {
  return (
    <ul className="divide-y divide-[var(--line)]">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status="in-progress"
                label={workKindLabel(item.kind)}
                size="compact"
              />
              <StatusBadge
                status="pending"
                label={attributionLabel(item.attribution)}
                size="compact"
              />
            </div>
            <Link
              href={hrefWithHome(item.href, organizationId)}
              className="mt-1 inline-flex min-h-10 items-center text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              {item.referenceKey ? `${item.referenceKey} · ` : null}
              {item.title}
            </Link>
          </div>
          {item.status ? (
            <span className="text-xs text-[var(--muted)]">{item.status}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
