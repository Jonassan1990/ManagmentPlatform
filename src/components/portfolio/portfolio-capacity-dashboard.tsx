"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CAPACITY_BAND_LABELS } from "@/components/portfolio/metric";
import { Alert } from "@/components/ui/alert";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { LiveRegion } from "@/components/ui/live-region";
import { EmptyState } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import {
  appendReturnContext,
  capacityReturnInput,
} from "@/modules/navigation/return-context";
import type {
  PortfolioCapacityHours,
  PortfolioPiCapacityResult,
  PortfolioPiListItem,
} from "@/modules/portfolio/domain/types";
import {
  availableCapacityDepartments,
  criticalityToBadge,
  dependencyStatusToBadge,
  explainConflict,
  formatNeededBy,
  isPiViewForbiddenMessage,
  type CapacityDependenciesView,
} from "./portfolio-capacity-coordination";
import {
  bandTone,
  buildDepartmentCards,
  buildProjectStackSegments,
  capacityStatusLabel,
  committedLoadBarPct,
  filterDepartmentCards,
  flattenAggregatedResources,
  formatCapacityHours,
  formatUtilizationPct,
  initials,
  utilTrackWidthPct,
  type StackSegmentView,
} from "./portfolio-capacity-model";
import {
  RESOURCE_WORKSPACE_NAV,
  summarizeManagerResourceKpis,
  type ResourceWorkspaceView,
} from "./resource-management-kpis";

function bandToStatus(
  band: PortfolioCapacityHours["band"],
): StatusBadgeVariant {
  switch (band) {
    case "overload":
      return "blocked";
    case "near":
      return "at-risk";
    case "ok":
    case "under":
      return "completed";
    default:
      return "unavailable";
  }
}

function piLifecycleToStatus(
  lifecycle: PortfolioPiListItem["lifecycle"] | undefined,
  status: string | undefined,
): StatusBadgeVariant {
  if (lifecycle === "ACTIVE") return "in-progress";
  if (lifecycle === "UPCOMING") return "pending";
  if (lifecycle === "COMPLETED") return "completed";
  if (status === "CANCELLED" || status === "ARCHIVED") return "cancelled";
  return "draft";
}

function formatPlanningPeriod(startDate: string, endDate: string): string {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const opts: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  } catch {
    return `${startDate} – ${endDate}`;
  }
}

function SectionHeading({
  id,
  level,
  title,
  description,
}: {
  id: string;
  level: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3">
      <p className="ds-eyebrow text-[10px]">
        {level}
      </p>
      <h2
        id={id}
        className="scania-title text-xl text-[var(--scania-blue-900)]"
      >
        {title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}

export type CapacityOrgOption = { id: string; name: string };
export type CapacityDeptOption = { id: string; name: string };

function capacityHref(opts: {
  organizationId: string;
  departmentId?: string;
  piId?: string;
}): string {
  const params = new URLSearchParams();
  params.set("organizationId", opts.organizationId);
  if (opts.departmentId) params.set("departmentId", opts.departmentId);
  if (opts.piId) params.set("piId", opts.piId);
  return `/portfolio/capacity?${params.toString()}`;
}

function KpiCard({
  label,
  value,
  note,
  tone = "default",
  barPct,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  tone?: "default" | "critical" | "warn" | "blue";
  barPct?: number | null;
}) {
  const toneClass =
    tone === "critical"
      ? "critical"
      : tone === "warn"
        ? "warn"
        : tone === "blue"
          ? "blue"
          : "";
  return (
    <div className={`rm-card rm-kpi ${toneClass}`}>
      <div className="rm-kpi-label">{label}</div>
      <div className="rm-kpi-value">{value}</div>
      {note ? <div className="rm-kpi-note">{note}</div> : null}
      {barPct != null && Number.isFinite(barPct) ? (
        <div className="rm-barline" aria-hidden>
          <i style={{ width: `${Math.max(0, Math.min(100, barPct))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function ScopeForm({
  organizations,
  departments,
  organizationId,
  departmentId,
  piId,
  pis,
}: {
  organizations: CapacityOrgOption[];
  departments: CapacityDeptOption[];
  organizationId: string;
  departmentId?: string;
  piId?: string;
  pis: PortfolioPiListItem[];
}) {
  return (
    <form
      method="get"
      action="/portfolio/capacity"
      className="rm-card rm-scope"
      aria-label="Capacity scope filters"
    >
      <label className="min-w-0 flex-1 basis-full text-sm sm:basis-[12rem] sm:flex-none">
        <span className="mb-1 block text-[var(--muted)]">Organization</span>
        <select
          name="organizationId"
          defaultValue={organizationId}
          className="input min-h-11 w-full max-w-full"
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 flex-1 basis-full text-sm sm:basis-[12rem] sm:flex-none">
        <span className="mb-1 block text-[var(--muted)]">Department</span>
        <select
          name="departmentId"
          defaultValue={departmentId ?? ""}
          className="input min-h-11 w-full max-w-full"
        >
          <option value="">All visible</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 flex-1 basis-full text-sm sm:basis-[14rem] sm:flex-none sm:max-w-md">
        <span className="mb-1 block text-[var(--muted)]">Program Increment</span>
        <select
          name="piId"
          defaultValue={piId ?? ""}
          className="input min-h-11 w-full max-w-full"
          aria-label="Select Program Increment"
        >
          <option value="">Select a PI…</option>
          {pis.map((p) => (
            <option key={p.piId} value={p.piId}>
              {p.referenceKey} · {p.name} ({p.lifecycle})
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary-button">
        Apply
      </button>
    </form>
  );
}

function collectProjectLegend(
  card: ReturnType<typeof buildDepartmentCards>[number],
): StackSegmentView[] {
  const byProject = new Map<string, StackSegmentView>();
  for (const team of card.teams) {
    for (const r of team.resources) {
      const stack = buildProjectStackSegments(
        r.availableHours,
        r.projectSegments,
      );
      for (const seg of stack) {
        const existing = byProject.get(seg.projectId);
        if (existing) {
          existing.committedHours += seg.committedHours;
        } else {
          byProject.set(seg.projectId, { ...seg });
        }
      }
    }
  }
  return [...byProject.values()].sort(
    (a, b) => b.committedHours - a.committedHours,
  );
}

function DepartmentCard({
  card,
  open,
  onToggle,
}: {
  card: ReturnType<typeof buildDepartmentCards>[number];
  open: boolean;
  onToggle: () => void;
}) {
  const projectLegend = open ? collectProjectLegend(card) : [];
  const tone = bandTone(card.band);
  const utilLabel =
    card.utilization == null
      ? "No load"
      : `${formatUtilizationPct(card.utilization)} avg. load`;
  const trackPct = utilTrackWidthPct(card.utilization);

  return (
    <article
      className={`rm-card rm-dept-card ${open ? "open" : ""}`}
      data-department-id={card.departmentId}
    >
      <div className="rm-dept-top">
        <div>
          <div className="rm-dept-name">{card.departmentName}</div>
          <div className="rm-dept-sub">
            {card.teamCount} team{card.teamCount === 1 ? "" : "s"} ·{" "}
            {formatCapacityHours(card.committedHours)}h of{" "}
            {formatCapacityHours(card.availableHours)}h planned
          </div>
        </div>
        <div className="rm-dept-metrics">
          <div className="rm-metric">
            <strong>{card.resourceCount}</strong>
            <span>Resources</span>
          </div>
          <div className="rm-metric">
            <strong className={card.overloadCount > 0 ? "over" : undefined}>
              {card.overloadCount}
            </strong>
            <span>Overloaded</span>
          </div>
        </div>
      </div>
      <div className="rm-dept-util">
        <div className="rm-util-track" aria-hidden>
          <i
            className={tone === "none" ? undefined : tone}
            style={{ width: `${trackPct}%` }}
          />
        </div>
        <div className="rm-util-label">{utilLabel}</div>
      </div>
      <button
        type="button"
        className="rm-dept-toggle"
        aria-expanded={open}
        aria-controls={`dept-panel-${card.departmentId}`}
        id={`dept-toggle-${card.departmentId}`}
        onClick={onToggle}
      >
        <span>
          {open ? "Hide" : "View"} {card.resourceCount} resource
          {card.resourceCount === 1 ? "" : "s"} &amp; allocation
          {card.overloadCount > 0
            ? ` · ${card.overloadCount} overloaded`
            : ""}
        </span>
        <span className="rm-arrow" aria-hidden>
          ⌄
        </span>
      </button>
      <div
        className="rm-dept-resources"
        id={`dept-panel-${card.departmentId}`}
        role="region"
        aria-labelledby={`dept-toggle-${card.departmentId}`}
        hidden={!open}
      >
        {open ? (
          <>
            <div className="rm-resource-head">
              <div>Resource</div>
              <div>Project allocation</div>
              <div style={{ textAlign: "right" }}>Load</div>
              <div className="cap-col">Capacity status</div>
            </div>
            {card.teams.map((team) => (
              <div
                key={team.teamId}
                className="rm-team-block"
                data-team-id={team.teamId}
                id={`team-${team.teamId}`}
              >
                <div className="rm-team-label">
                  <span>
                    {team.teamName}
                    <span className="rm-person-role">
                      {" "}
                      · {formatCapacityHours(team.committedHours)}h /{" "}
                      {formatCapacityHours(team.availableHours)}h
                    </span>
                  </span>
                  <span className={`rm-capacity ${bandTone(team.band)}`}>
                    {capacityStatusLabel(team.band)}
                  </span>
                </div>
                {team.resources.length === 0 ? (
                  <p className="rm-person-role" style={{ padding: "8px 0" }}>
                    No resources visible for this team in the current scope.
                  </p>
                ) : (
                  team.resources.map((r) => {
                    const rTone = bandTone(r.band);
                    const stack = buildProjectStackSegments(
                      r.availableHours,
                      r.projectSegments,
                    );
                    const bar = committedLoadBarPct(
                      r.availableHours,
                      r.committedHours,
                    );
                    const stackLabel =
                      stack.length > 0
                        ? `Project commitments: ${stack
                            .map(
                              (s) =>
                                `${s.label} ${formatCapacityHours(s.committedHours)}h`,
                            )
                            .join("; ")}. Total ${formatCapacityHours(r.committedHours)} of ${formatCapacityHours(r.availableHours)} available hours.`
                        : `Committed ${formatCapacityHours(r.committedHours)} of ${formatCapacityHours(r.availableHours)} available hours`;
                    return (
                      <div
                        key={`${r.resourceId}:${r.teamId}`}
                        className="rm-resource-row"
                        data-resource-id={r.resourceId}
                      >
                        <div className="rm-person">
                          <div className="rm-initials" aria-hidden>
                            {initials(r.resourceName)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="rm-person-name">
                              {r.resourceName}
                            </div>
                            <div className="rm-person-role">
                              {r.teamName} · membership{" "}
                              {formatCapacityHours(
                                r.membershipAllocationPercent,
                              )}
                              %
                            </div>
                          </div>
                        </div>
                        <div
                          className="rm-stack"
                          role="img"
                          aria-label={stackLabel}
                          title={stackLabel}
                        >
                          {stack.length > 0
                            ? stack.map((seg) => (
                                <i
                                  key={seg.projectId}
                                  className="rm-seg"
                                  style={{
                                    width: `${seg.widthPct}%`,
                                    background: seg.color,
                                  }}
                                  title={`${seg.label}: ${formatCapacityHours(seg.committedHours)}h`}
                                />
                              ))
                            : bar.committedPct > 0 ? (
                                <i
                                  className="rm-seg"
                                  style={{
                                    width: `${bar.committedPct}%`,
                                    background:
                                      rTone === "over"
                                        ? "#d65d57"
                                        : rTone === "high"
                                          ? "#e3a640"
                                          : "#087f78",
                                  }}
                                />
                              ) : null}
                        </div>
                        <div className={`rm-load ${rTone === "none" ? "ok" : rTone}`}>
                          {formatUtilizationPct(r.utilization)}
                        </div>
                        <div className={`rm-capacity ${rTone === "none" ? "ok" : rTone}`}>
                          {capacityStatusLabel(r.band) === "Within capacity"
                            ? "Available"
                            : capacityStatusLabel(r.band) === "Underutilized"
                              ? "Available"
                              : capacityStatusLabel(r.band)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
            {projectLegend.length > 0 ? (
              <div
                className="rm-legend"
                data-testid="capacity-project-legend"
                aria-label="Project commitment legend"
              >
                {projectLegend.map((seg) => (
                  <span key={seg.projectId}>
                    <i
                      className="rm-dot"
                      style={{ background: seg.color }}
                      aria-hidden
                    />
                    {seg.label} ({formatCapacityHours(seg.committedHours)}h)
                  </span>
                ))}
                <span>
                  Bars show each project share of planned hours; load shows
                  total planned capacity.
                </span>
              </div>
            ) : null}
            <p className="rm-person-role" style={{ marginTop: 8 }}>
              Stacked bars use real CURRENT project commitment hours — not FTE
              or invented workstream %. Shared resources keep membership % from
              capacity-policy.
            </p>
          </>
        ) : null}
      </div>
    </article>
  );
}

export function PortfolioCapacityDashboard({
  organizationName,
  organizations,
  departments,
  organizationId,
  departmentId,
  piId,
  pis,
  listError,
  capacity,
  capacityError,
  capacityErrorCode,
  dependencies = {
    state: "unavailable",
    reason: "PlanningDependencies were not loaded for this view.",
  },
}: {
  organizationName: string;
  organizations: CapacityOrgOption[];
  departments: CapacityDeptOption[];
  organizationId: string;
  departmentId?: string;
  piId?: string;
  pis: PortfolioPiListItem[];
  listError?: string | null;
  capacity: PortfolioPiCapacityResult | null;
  capacityError?: string | null;
  capacityErrorCode?: string | null;
  dependencies?: CapacityDependenciesView;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState("");
  const [overloadedOnly, setOverloadedOnly] = useState(false);
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const [workspaceView, setWorkspaceView] =
    useState<ResourceWorkspaceView>("overview");

  const selectedPi = pis.find((p) => p.piId === piId) ?? null;
  const ready =
    capacity?.capacity.state === "ready" ? capacity.capacity : null;
  const returnInput = capacityReturnInput({
    organizationId,
    departmentId,
    piId,
  });
  const openPiTarget =
    selectedPi?.href ??
    (piId ? `/pi/${piId}` : null) ??
    (ready?.meta.piId ? `/pi/${ready.meta.piId}` : null) ??
    "/pi";
  const openPiHref =
    openPiTarget === "/pi"
      ? "/pi"
      : appendReturnContext(openPiTarget, returnInput);
  const selectedPiMetaHref = ready?.meta.piId
    ? appendReturnContext(`/pi/${ready.meta.piId}`, returnInput)
    : openPiHref;
  const piIdForNav = ready?.meta.piId ?? piId ?? null;
  const dependenciesHref = piIdForNav
    ? appendReturnContext(`/pi/${piIdForNav}/dependencies`, returnInput)
    : "/pi";
  const boardHref = piIdForNav
    ? appendReturnContext(`/pi/${piIdForNav}/board`, returnInput)
    : openPiHref;
  const piViewForbidden =
    capacityErrorCode === "FORBIDDEN" ||
    isPiViewForbiddenMessage(capacityError);

  const cards = useMemo(() => {
    if (!ready) return [];
    return buildDepartmentCards(
      ready.departments,
      ready.teams,
      ready.resources.rows,
    );
  }, [ready]);

  const aggregatedResources = useMemo(
    () => flattenAggregatedResources(cards),
    [cards],
  );

  const managerKpis = useMemo(() => {
    if (!ready) return null;
    return summarizeManagerResourceKpis({
      availableHours: ready.totals.availableHours,
      committedHours: ready.totals.committedHours,
      utilization: ready.totals.utilization,
      cards,
      aggregatedResources,
      dependencies,
    });
  }, [ready, cards, aggregatedResources, dependencies]);

  /** Dense A/B hour KPIs + planning context live on Capacity & demand only. */
  const showOverviewChrome = workspaceView === "capacity-demand";
  const showHierarchy =
    workspaceView === "overview" ||
    workspaceView === "allocation" ||
    workspaceView === "cross-functional" ||
    workspaceView === "capacity-demand";
  const showDependenciesPanel =
    workspaceView === "overview" || workspaceView === "dependencies";
  /** Overloaded-team / conflict deep dive — Capacity & demand (keeps overview clear). */
  const showManagementAttention = workspaceView === "capacity-demand";
  const showCrossFunctionalOnly = workspaceView === "cross-functional";
  const showManagerChrome =
    workspaceView === "overview" ||
    workspaceView === "allocation" ||
    workspaceView === "cross-functional" ||
    workspaceView === "dependencies";
  const hierarchyCards = useMemo(() => {
    if (!showCrossFunctionalOnly) return cards;
    const counts = new Map<string, number>();
    for (const r of aggregatedResources) {
      counts.set(r.resourceId, (counts.get(r.resourceId) ?? 0) + 1);
    }
    const multiTeam = new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id),
    );
    return cards
      .map((c) => ({
        ...c,
        teams: c.teams
          .map((t) => ({
            ...t,
            resources: t.resources.filter((r) => multiTeam.has(r.resourceId)),
          }))
          .filter((t) => t.resources.length > 0),
      }))
      .filter((c) => c.teams.length > 0)
      .map((c) => ({
        ...c,
        resourceCount: c.teams.reduce((n, t) => n + t.resources.length, 0),
        overloadCount: c.teams.reduce(
          (n, t) => n + t.resources.filter((r) => r.band === "overload").length,
          0,
        ),
      }));
  }, [cards, aggregatedResources, showCrossFunctionalOnly]);

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cards) {
      for (const t of c.teams) map.set(t.teamId, t.teamName);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const filtered = useMemo(
    () =>
      filterDepartmentCards(hierarchyCards, {
        search,
        teamId: teamId || undefined,
        overloadedOnly,
      }),
    [hierarchyCards, search, teamId, overloadedOnly],
  );

  const uniqueOverloadedTeams = useMemo(() => {
    if (!ready) return [];
    const seen = new Set<string>();
    const rows: Array<{
      teamId: string;
      teamName: string;
      departmentId: string;
      availableHours: number;
      committedHours: number;
      remainingHours: number;
      utilization: number | null;
      band: PortfolioCapacityHours["band"];
    }> = [];
    for (const t of ready.overloadedTeams) {
      if (seen.has(t.teamId)) continue;
      seen.add(t.teamId);
      rows.push({
        teamId: t.teamId,
        teamName: t.teamName,
        departmentId: t.departmentId,
        availableHours: t.availableHours,
        committedHours: t.committedHours,
        remainingHours: t.remainingHours,
        utilization: t.utilization,
        band: t.band,
      });
    }
    return rows;
  }, [ready]);

  const shortageTeams = useMemo(() => {
    if (!ready) return [];
    return ready.teams.filter(
      (t) => t.remainingHours < 0 || t.band === "near" || t.band === "overload",
    );
  }, [ready]);

  const availableDepts = useMemo(
    () => (ready ? availableCapacityDepartments(ready.departments) : []),
    [ready],
  );

  const conflictExplanations = useMemo(() => {
    if (!ready) return [];
    return ready.conflicts.map((c) =>
      explainConflict(c, ready.teams, ready.resources.rows),
    );
  }, [ready]);

  function expandDepartment(departmentId: string, teamIdFocus?: string) {
    setOpenDepts((prev) => new Set(prev).add(departmentId));
    if (teamIdFocus) {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`team-${teamIdFocus}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  function expandMatchingDepartments(nextCards: typeof cards) {
    setOpenDepts((prev) => {
      const next = new Set(prev);
      for (const card of nextCards) next.add(card.departmentId);
      return next;
    });
  }

  const controlCount = 3; /* team filter + overloaded checkbox + search */

  return (
    <div
      className="rm-clear space-y-4"
      data-testid="portfolio-capacity-dashboard"
    >
      <ScopeForm
        organizations={organizations}
        departments={departments}
        organizationId={organizationId}
        departmentId={departmentId}
        piId={piId}
        pis={pis}
      />

      {listError ? (
        <Alert tone="error" live="assertive">
          {listError}
        </Alert>
      ) : null}
      {capacityError ? (
        <Alert
          tone="error"
          live="assertive"
          title={piViewForbidden ? "PI capacity unavailable for this scope" : undefined}
        >
          {piViewForbidden ? (
            <>
              {capacityError} Department Managers with only department-scoped
              PI_VIEW cannot open section- or organization-scoped Program
              Increments. This is intentional Phase 0C isolation — not a missing
              KPI. Ask for section/org PI access, or use department portfolio
              views that remain in scope.
            </>
          ) : (
            capacityError
          )}
        </Alert>
      ) : null}

      <div
        className="rm-layout"
        data-testid="resource-management-workspace"
      >
        <aside className="rm-sidebar" aria-label="Resource Management workspace">
          <div className="rm-nav-label">Workspace</div>
          {RESOURCE_WORKSPACE_NAV.filter((n) => n.group === "workspace").map(
            (item) => (
              <button
                key={item.id}
                type="button"
                className="rm-nav-item"
                aria-current={workspaceView === item.id ? "page" : undefined}
                onClick={() => {
                  if (item.id === "reports") {
                    router.push(
                      `/portfolio/reports?organizationId=${organizationId}`,
                    );
                    return;
                  }
                  setWorkspaceView(item.id);
                }}
              >
                <span className="icon" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ),
          )}
          <div className="rm-nav-label" style={{ marginTop: 14 }}>
            Management
          </div>
          {RESOURCE_WORKSPACE_NAV.filter((n) => n.group === "management").map(
            (item) => (
              <button
                key={item.id}
                type="button"
                className="rm-nav-item"
                aria-current={workspaceView === item.id ? "page" : undefined}
                onClick={() => {
                  if (item.id === "reports") {
                    router.push(
                      `/portfolio/reports?organizationId=${organizationId}`,
                    );
                    return;
                  }
                  setWorkspaceView(item.id);
                }}
              >
                <span className="icon" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ),
          )}
        </aside>

        <div className="rm-main">
      {showManagerChrome ? (
      <div className="rm-topline">
        <div>
          <div className="rm-eyebrow">
            Manager dashboard · {organizationName}
          </div>
          <h1 className="rm-title">Resource allocation overview</h1>
          <p className="rm-subtitle">
            Select a department to see its people, workstream allocation and
            capacity. Hours come from capacity-policy; stacked bars use real
            CURRENT project commitments — not FTE or invented workstream %.
          </p>
        </div>
        <div className="rm-actions">
          <Link
            href={appendReturnContext(
              `/portfolio/reports?organizationId=${organizationId}&type=resource_allocation${piId ? `&piId=${piId}` : ""}`,
              returnInput,
            )}
            aria-label="Export view"
            className="rm-btn"
          >
            ↧ &nbsp;Export view
          </Link>
          <Link href={boardHref} aria-label="Plan allocation" className="rm-btn primary">
            ＋ &nbsp;Plan allocation
          </Link>
        </div>
      </div>
      ) : null}

      {showManagerChrome && !piId ? (
        <p role="status" className="rm-subtitle" style={{ marginBottom: 12 }}>
          No PI selected — choose a Program Increment above to load capacity.
        </p>
      ) : null}

      {showManagerChrome &&
      capacity?.capacity.state === "unavailable" ? (
        <Alert tone="warning" live="polite" title="Capacity unavailable">
          {capacity.capacity.reason}
        </Alert>
      ) : null}

      {managerKpis && showManagerChrome ? (
        <section
          aria-label="Manager resource KPIs"
          data-testid="manager-resource-kpis"
          className="rm-kpis"
        >
          <KpiCard
            label="Capacity allocated"
            value={managerKpis.capacityAllocatedPctLabel}
            note={managerKpis.capacityAllocatedNote}
            barPct={
              managerKpis.capacityAllocatedUtil == null
                ? null
                : Math.min(
                    100,
                    Math.round(managerKpis.capacityAllocatedUtil * 100),
                  )
            }
            tone={
              ready?.totals.band === "overload"
                ? "critical"
                : ready?.totals.band === "near"
                  ? "warn"
                  : "default"
            }
          />
          <KpiCard
            label="Overloaded resources"
            value={String(managerKpis.overloadedResources)}
            note={managerKpis.overloadedNote}
            tone={
              managerKpis.overloadedResources > 0 ? "critical" : "default"
            }
          />
          <KpiCard
            label="Cross-functional assignments"
            value={String(managerKpis.crossFunctionalAssignments)}
            note={managerKpis.crossFunctionalNote}
            tone="blue"
          />
          <KpiCard
            label="External dependencies"
            value={String(managerKpis.externalDependencies)}
            note={managerKpis.externalDependenciesNote}
            tone={
              managerKpis.externalDependenciesAttention > 0
                ? "warn"
                : "default"
            }
          />
        </section>
      ) : null}

      {/* ——— A. Planning Context ——— */}
      {showOverviewChrome ? (
      <section
        aria-labelledby="capacity-planning-context"
        data-testid="capacity-planning-context"
      >
        <SectionHeading
          id="capacity-planning-context"
          level="A · Planning context"
          title="Planning context"
          description="Selected PI, planning period, CURRENT revision, and baseline comparison — never draft scenarios."
        />
        <div className="tegel-card p-4 text-sm">
          {!piId ? (
            <p role="status" className="text-[var(--muted)]">
              No PI selected — choose a Program Increment to load capacity. An
              explicit selection is never overridden.
            </p>
          ) : !capacity ? (
            <p role="status" className="text-[var(--muted)]">
              {capacityError
                ? "Capacity could not be loaded for the selected Program Increment."
                : "Capacity data was not returned for the selected Program Increment."}
            </p>
          ) : capacity.capacity.state === "no_pi_selected" ? (
            <p role="status" className="text-[var(--muted)]">
              {capacity.capacity.reason}
            </p>
          ) : capacity.capacity.state === "unavailable" ? (
            <Alert tone="warning" live="polite" title="Capacity unavailable">
              {capacity.capacity.reason}
            </Alert>
          ) : ready ? (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Selected PI
                </dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <Link
                    href={selectedPiMetaHref}
                    className="font-semibold text-[var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  >
                    {ready.meta.referenceKey} · {ready.meta.name}
                  </Link>
                  <StatusBadge
                    status={piLifecycleToStatus(
                      selectedPi?.lifecycle,
                      ready.meta.status,
                    )}
                    label={selectedPi?.lifecycle ?? ready.meta.status}
                    size="compact"
                  />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Planning period
                </dt>
                <dd className="mt-1 font-semibold text-[var(--sidebar)]">
                  {formatPlanningPeriod(
                    ready.meta.startDate,
                    ready.meta.endDate,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  CURRENT revision
                </dt>
                <dd className="mt-1">
                  <strong className="text-[var(--sidebar)]">
                    {ready.meta.revision.key} v{ready.meta.revision.version}
                  </strong>
                  <StatusBadge
                    status="in-progress"
                    label="CURRENT live"
                    size="compact"
                    className="ml-2"
                  />
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                    Authoritative commitments — not draft scenarios
                  </p>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Baseline comparison
                </dt>
                <dd className="mt-1">
                  {ready.baselineComparison.available ? (
                    <>
                      <strong className="text-[var(--sidebar)]">
                        Approved baseline v
                        {ready.baselineComparison.versionNumber}
                      </strong>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        Live{" "}
                        {formatCapacityHours(
                          ready.baselineComparison.liveCommittedHours,
                        )}
                        h vs baseline{" "}
                        {formatCapacityHours(
                          ready.baselineComparison.baselineCommittedHours,
                        )}
                        h · Δ{" "}
                        {formatCapacityHours(
                          ready.baselineComparison.deltaHours,
                        )}
                        h
                      </p>
                    </>
                  ) : (
                    <span className="text-[var(--muted)]">
                      Unavailable — {ready.baselineComparison.reason}
                    </span>
                  )}
                </dd>
              </div>
              <div className="text-[11px] text-[var(--muted)] sm:col-span-2 xl:col-span-4">
                As of {new Date(capacity.asOf).toLocaleString()} · Source{" "}
                {ready.meta.source.replace(/_/g, " ")}
              </div>
            </dl>
          ) : null}
        </div>
      </section>
      ) : null}

      {/* ——— B. Capacity Summary ——— */}
      {ready && showOverviewChrome ? (
        <section
          aria-labelledby="capacity-summary"
          data-testid="capacity-summary"
        >
          <SectionHeading
            id="capacity-summary"
            level="B · Capacity summary"
            title="Capacity summary"
            description="Available, committed, remaining, utilization, overloaded teams, and planning conflicts from the M2E query — no browser recalculation."
          />
          <div
            className="grid grid-cols-2 gap-2 sm:gap-[13px] lg:grid-cols-3 xl:grid-cols-6"
            aria-label="Capacity KPIs"
            data-testid="capacity-kpis"
          >
            <KpiCard
              label="Available hours"
              value={`${formatCapacityHours(ready.totals.availableHours)}h`}
              note="Effective capacity (policy)"
            />
            <KpiCard
              label="Committed hours"
              value={`${formatCapacityHours(ready.totals.committedHours)}h`}
              note={
                ready.totals.committedHours === 0
                  ? "Zero committed — valid empty load"
                  : "WorkAllocation planned hours (CURRENT)"
              }
            />
            <KpiCard
              label="Remaining hours"
              value={`${formatCapacityHours(ready.totals.remainingHours)}h`}
              note="From service totals"
              tone={ready.totals.remainingHours < 0 ? "critical" : "default"}
            />
            <KpiCard
              label="Utilization"
              value={formatUtilizationPct(ready.totals.utilization)}
              note={CAPACITY_BAND_LABELS[ready.totals.band] ?? ready.totals.band}
              tone={
                ready.totals.band === "overload"
                  ? "critical"
                  : ready.totals.band === "near"
                    ? "warn"
                    : "default"
              }
            />
            <KpiCard
              label="Overloaded teams"
              value={String(uniqueOverloadedTeams.length)}
              note="Distinct teams with overload band"
              tone={
                uniqueOverloadedTeams.length > 0 ? "critical" : "default"
              }
            />
            <KpiCard
              label="Planning conflicts"
              value={String(ready.conflicts.length)}
              note={
                ready.conflicts.length === 0
                  ? "No conflicts"
                  : "From conflict engine"
              }
              tone={ready.conflicts.length > 0 ? "warn" : "blue"}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge
              status={bandToStatus(ready.totals.band)}
              label={`Portfolio ${capacityStatusLabel(ready.totals.band)}`}
            />
            <p className="text-[11px] text-[var(--muted)]">
              Hierarchy controls: {controlCount} (team, overloaded-only, search)
            </p>
          </div>
        </section>
      ) : null}

      {/* ——— D. Management Attention (elevated before hierarchy for scan speed) ——— */}
      {ready && showManagementAttention ? (
        <section
          aria-labelledby="capacity-management-attention"
          data-testid="capacity-management-attention"
        >
          <SectionHeading
            id="capacity-management-attention"
            level="D · Management attention"
            title="Management attention"
            description="Overloaded teams, capacity shortages, planning conflicts, missing capacity data, and coordination signals that need action."
          />
          <div className="grid grid-cols-1 gap-[13px] lg:grid-cols-2">
            <article className="tegel-card">
              <div className="border-b border-[var(--line)] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[var(--sidebar)]">
                  Overloaded teams
                </h3>
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Jump into the department hierarchy without leaving this page
                </p>
              </div>
              <div className="px-4 py-3">
                {uniqueOverloadedTeams.length === 0 ? (
                  <p role="status" className="text-[11px] text-[var(--muted)]">
                    No overloaded teams in this scope.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {uniqueOverloadedTeams.map((t) => (
                      <li
                        key={t.teamId}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bg)] py-2 last:border-0"
                      >
                        <div>
                          <p className="text-[11px] font-bold text-[var(--sidebar)]">
                            {t.teamName}
                          </p>
                          <p className="text-[9px] text-[var(--muted)]">
                            {formatCapacityHours(t.committedHours)}h /{" "}
                            {formatCapacityHours(t.availableHours)}h ·{" "}
                            {formatUtilizationPct(t.utilization)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status="blocked"
                            label="Over capacity"
                            size="compact"
                          />
                          <button
                            type="button"
                            className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-accent)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                            onClick={() => {
                              setOverloadedOnly(true);
                              expandDepartment(t.departmentId, t.teamId);
                            }}
                          >
                            Inspect team
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>

            <article className="tegel-card">
              <div className="border-b border-[var(--line)] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[var(--sidebar)]">
                  Shortages &amp; data gaps
                </h3>
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Near-limit / negative remaining · missing capacity inputs
                </p>
              </div>
              <div className="space-y-3 px-4 py-3">
                {ready.dataQuality.missingCapacityInputs ? (
                  <Alert
                    tone="warning"
                    live="polite"
                    title="Missing capacity data"
                  >
                    {ready.dataQuality.notes[0] ??
                      "Some resources lack capacityHoursPerWeek; treated as 0 hours, not unavailable."}
                  </Alert>
                ) : (
                  <p role="status" className="text-[11px] text-[var(--muted)]">
                    No missing capacity inputs reported.
                  </p>
                )}
                {shortageTeams.length === 0 ? (
                  <p role="status" className="text-[11px] text-[var(--muted)]">
                    No capacity shortages (near or overload) in returned teams.
                  </p>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {shortageTeams.slice(0, 8).map((t) => (
                      <li
                        key={`${t.teamId}-${t.iterationId}`}
                        className="flex items-center justify-between gap-2 text-[10px]"
                      >
                        <button
                          type="button"
                          className="min-h-11 text-left font-semibold text-[var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                          onClick={() =>
                            expandDepartment(t.departmentId, t.teamId)
                          }
                        >
                          {t.teamName}
                          <span className="ml-1 font-normal text-[var(--muted)]">
                            · {t.iterationName}
                          </span>
                        </button>
                        <StatusBadge
                          status={bandToStatus(t.band)}
                          label={capacityStatusLabel(t.band)}
                          size="compact"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>

            <article
              className="tegel-card lg:col-span-2"
              data-testid="capacity-conflict-explanations"
            >
              <div className="border-b border-[var(--line)] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[var(--sidebar)]">
                  Planning conflicts
                </h3>
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  What conflicts, who is affected, which iteration, severity, and
                  the next authorized navigation — from the existing conflict
                  engine only
                </p>
              </div>
              <div className="px-4 py-3">
                {conflictExplanations.length === 0 ? (
                  <p role="status" className="text-[11px] text-[var(--muted)]">
                    No conflicts.
                  </p>
                ) : (
                  conflictExplanations.map((ex, idx) => (
                    <div
                      key={`${ex.type}-${ex.affected}-${idx}`}
                      className="border-b border-[var(--bg)] py-3 last:border-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-[var(--ink)]">
                            {ex.headline}
                          </p>
                          <p className="mt-1 text-[10px] text-[var(--muted)]">
                            {ex.what}
                          </p>
                          <dl className="mt-2 grid grid-cols-1 gap-1 text-[10px] sm:grid-cols-3">
                            <div>
                              <dt className="uppercase tracking-wide text-[var(--muted)]">
                                Affected
                              </dt>
                              <dd className="font-semibold text-[var(--sidebar)]">
                                {ex.affected}
                              </dd>
                            </div>
                            <div>
                              <dt className="uppercase tracking-wide text-[var(--muted)]">
                                Iteration / PI
                              </dt>
                              <dd className="font-semibold text-[var(--sidebar)]">
                                {ex.iterationHint ??
                                  ready.meta.referenceKey ??
                                  "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="uppercase tracking-wide text-[var(--muted)]">
                                Type
                              </dt>
                              <dd className="font-semibold text-[var(--sidebar)]">
                                {ex.type.replace(/_/g, " ")}
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <StatusBadge
                          status={
                            ex.severity === "BLOCKER"
                              ? "blocked"
                              : ex.severity === "WARNING"
                                ? "at-risk"
                                : "pending"
                          }
                          label={ex.severity}
                          size="compact"
                        />
                      </div>
                      <div className="mt-2">
                        {ex.actionKind === "expand_team" &&
                        ex.departmentId &&
                        ex.teamId ? (
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-accent)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                            onClick={() =>
                              expandDepartment(ex.departmentId!, ex.teamId)
                            }
                          >
                            {ex.actionLabel}
                          </button>
                        ) : ex.actionKind === "open_dependencies" ? (
                          <Link
                            href={dependenciesHref}
                            className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-accent)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                          >
                            {ex.actionLabel}
                          </Link>
                        ) : ex.actionKind === "open_pi_board" ? (
                          <Link
                            href={boardHref}
                            className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-accent)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                          >
                            {ex.actionLabel}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {/* ——— C. Department / Team / Resource Breakdown ——— */}
      {ready && showHierarchy ? (
        <section
          aria-labelledby="capacity-hierarchy"
          data-testid="capacity-hierarchy"
        >
          <div className="rm-section-head">
            <div>
              <h2 id="capacity-hierarchy">
                {showCrossFunctionalOnly
                  ? "Cross-functional resource allocation"
                  : "Department allocation"}
              </h2>
              <p>
                {showCrossFunctionalOnly
                  ? "People shared across more than one team in the CURRENT plan. Membership % remains the capacity-policy split — not project load."
                  : "Departments are grouped below. Expand any department to inspect individual resource allocation."}
              </p>
            </div>
            <div
              className="rm-filters"
              data-testid="capacity-hierarchy-controls"
            >
              <label className="text-sm">
                <span className="sr-only">Team filter</span>
                <select
                  value={teamId}
                  onChange={(e) => {
                    const nextTeam = e.target.value;
                    setTeamId(nextTeam);
                    if (nextTeam) {
                      expandMatchingDepartments(
                        filterDepartmentCards(cards, {
                          search,
                          teamId: nextTeam,
                          overloadedOnly,
                        }),
                      );
                    }
                  }}
                  className="rm-search"
                  style={{ width: "12rem" }}
                  aria-label="Filter by team"
                >
                  <option value="">All teams</option>
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--rm-muted)]">
                <input
                  type="checkbox"
                  checked={overloadedOnly}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setOverloadedOnly(on);
                    if (on) {
                      expandMatchingDepartments(
                        filterDepartmentCards(cards, {
                          search,
                          teamId: teamId || undefined,
                          overloadedOnly: true,
                        }),
                      );
                    }
                  }}
                  className="h-4 w-4"
                />
                Overloaded only
              </label>
              <input
                className="rm-search"
                placeholder="⌕  Search departments or people"
                aria-label="Search departments or people"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <LiveRegion
            message={
              cards.length === 0
                ? "No participating departments for this PI."
                : filtered.length === 0
                  ? "No departments match the current capacity filters."
                  : `Showing ${filtered.length} of ${cards.length} department${cards.length === 1 ? "" : "s"} in the capacity hierarchy.`
            }
          />

          {cards.length === 0 ? (
            <EmptyState
              title="No participating departments"
              description="No departments were returned for this PI in your authorized scope."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No departments match"
              description="No departments match the current team, overloaded-only, or search filters. Clear filters to widen the hierarchy."
            />
          ) : (
            <div className="rm-dept-grid">
              {filtered.map((card) => (
                <DepartmentCard
                  key={card.departmentId}
                  card={card}
                  open={openDepts.has(card.departmentId)}
                  onToggle={() => {
                    setOpenDepts((prev) => {
                      const next = new Set(prev);
                      if (next.has(card.departmentId)) {
                        next.delete(card.departmentId);
                      } else {
                        next.add(card.departmentId);
                      }
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-[13px] lg:grid-cols-2">
            <article className="tegel-card">
              <div className="border-b border-[var(--line)] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[var(--sidebar)]">
                  Project commitments
                </h3>
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Hours from WorkAllocations on the CURRENT revision — not draft
                  scenarios
                </p>
              </div>
              <div className="px-4 py-3">
                {ready.projectCommitments.length === 0 ? (
                  <p role="status" className="text-[11px] text-[var(--muted)]">
                    Zero committed hours — no project allocations on this
                    revision.
                  </p>
                ) : (
                  ready.projectCommitments.map((p) => (
                    <div
                      key={p.projectId}
                      className="grid grid-cols-[1fr_auto] gap-2 border-b border-[var(--bg)] py-2 last:border-0"
                    >
                      <div>
                        <Link
                          href={p.href}
                          className="text-[10px] font-bold text-[var(--color-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                        >
                          {p.referenceKey} · {p.name}
                        </Link>
                        <p className="mt-0.5 text-[9px] text-[var(--muted)]">
                          {p.workItemCount} work item
                          {p.workItemCount === 1 ? "" : "s"} ·{" "}
                          {p.allocationCount} allocation
                          {p.allocationCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right text-[10px] font-bold text-[var(--sidebar)]">
                        {formatCapacityHours(p.committedHours)}h
                        <small className="block text-[8px] font-normal text-[var(--muted)]">
                          committed
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="tegel-card p-4">
              <h3 className="text-sm font-bold text-[var(--sidebar)]">
                Shared resource policy
              </h3>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
                A Resource participating in multiple teams must not have full
                capacity counted independently in each team. Available hours
                already reflect membership allocation percent from the canonical
                capacity-policy. This UI sums returned hours only — it does not
                invent FTE or workstream percentages. Stacked bars use the same
                CURRENT WorkAllocation → Project hours as the Project
                commitments panel.
              </p>
              {ready.resources.total > ready.resources.rows.length ? (
                <p className="mt-3 text-[11px] text-[var(--muted)]">
                  Showing {ready.resources.rows.length} of{" "}
                  {ready.resources.total} resource-iteration rows (bounded page
                  from M2E-A).
                </p>
              ) : null}
            </article>
          </div>
        </section>
      ) : null}

      {/* ——— E. Cross-department coordination (mock bottom grid) ——— */}
      {ready && showDependenciesPanel ? (
        <section
          aria-labelledby="capacity-cross-department"
          data-testid="capacity-cross-department"
          className="rm-bottom-grid"
        >
          <h2 id="capacity-cross-department" className="sr-only">
            Dependencies on other departments
          </h2>
            <article className="rm-card">
              <div className="rm-panel-head">
                <h3>Dependencies on other departments</h3>
                <p>
                  Support {organizationName} needs from partner teams —
                  departments with remaining capacity
                </p>
              </div>
              <div className="rm-panel-body">
                {availableDepts.length === 0 ? (
                  <p role="status" className="rm-person-role">
                    No departments with remaining capacity in the returned
                    scope.
                  </p>
                ) : (
                  availableDepts.map((d) => (
                    <div key={d.departmentId} className="rm-dep-row">
                      <div className="rm-dep-icon" aria-hidden>
                        ⌘
                      </div>
                      <div>
                        <div className="rm-dep-name">{d.departmentName}</div>
                        <div className="rm-dep-meta">
                          {formatCapacityHours(d.remainingHours)}h remaining ·{" "}
                          {d.statusLabel}
                        </div>
                      </div>
                      <div className="rm-dep-count">
                        {formatCapacityHours(d.availableHours)}h
                        <small>available</small>
                      </div>
                    </div>
                  ))
                )}
                <p className="sr-only">Departments with available capacity</p>
              </div>
            </article>

            <article
              className="rm-card"
              data-testid="capacity-dependencies-panel"
            >
              <div className="rm-panel-head">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3>Dependency actions to watch</h3>
                    <p>
                      Partner actions affecting {organizationName} plans
                    </p>
                  </div>
                </div>
              </div>
              <div className="rm-panel-body">
                {dependencies.state === "unavailable" ? (
                  <div className="space-y-2">
                    <Alert tone="warning" live="polite" title="Scoped / unavailable">
                      {dependencies.reason}
                    </Alert>
                    {dependencies.openCount != null ? (
                      <p className="text-[11px] text-[var(--muted)]">
                        Portfolio snapshot counts in your scope:{" "}
                        <strong>{dependencies.openCount}</strong> open ·{" "}
                        <strong>{dependencies.criticalCount ?? 0}</strong>{" "}
                        critical/high. Individual dependency rows are not shown
                        without organization-scoped PI_VIEW.
                      </p>
                    ) : null}
                  </div>
                ) : dependencies.rows.length === 0 ? (
                  <p role="status" className="text-[11px] text-[var(--muted)]">
                    No PlanningDependencies in this organization.
                  </p>
                ) : (
                  <div>
                    {dependencies.rows.slice(0, 12).map((dep) => {
                      const badgeClass =
                        dep.criticality === "HIGH" ||
                        dep.criticality === "CRITICAL"
                          ? "risk"
                          : dep.status === "OPEN"
                            ? "active"
                            : "";
                      const badgeLabel =
                        dep.criticality === "HIGH" ||
                        dep.criticality === "CRITICAL"
                          ? "At risk"
                          : dep.status === "OPEN"
                            ? "In progress"
                            : dep.status.replace(/_/g, " ");
                      return (
                        <div
                          key={dep.id}
                          className="rm-action-row"
                          data-dependency-id={dep.id}
                        >
                          <span className="rm-action-title">
                            {dep.description?.trim() ||
                              `${dep.sourceLabel} → ${dep.targetLabel}`}
                          </span>
                          <span>{dep.targetLabel}</span>
                          <span>{formatNeededBy(dep.neededByDate)}</span>
                          <span className={`rm-badge ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                          <span className="sr-only">
                            {dep.sourceLabel} {dep.status} {dep.criticality}
                          </span>
                        </div>
                      );
                    })}
                    {piIdForNav ? (
                      <Link
                        href={dependenciesHref}
                        className="rm-btn"
                        style={{ marginTop: 10 }}
                      >
                        Open PI dependencies
                      </Link>
                    ) : null}
                  </div>
                )}
                {dependencies.state === "ready" ? (
                  <p className="mt-3 text-[10px] text-[var(--muted)]">
                    {dependencies.openCount} open · {dependencies.criticalCount}{" "}
                    critical/high (authorized org list — not a new reporting
                    permission)
                  </p>
                ) : null}
              </div>
            </article>
        </section>
      ) : null}


      {!piId && pis.length > 0 ? (
        <div
          className="tegel-card p-4"
          data-testid="capacity-pi-chips"
        >
          <p className="mb-2 text-sm font-semibold text-[var(--sidebar)]">
            Available Program Increments
          </p>
          <p className="mb-3 text-[11px] text-[var(--muted)]">
            Active, upcoming, and completed PIs you are authorized to see.
            Selecting one never overrides a later explicit choice.
          </p>
          <ul className="flex flex-wrap gap-2">
            {pis.slice(0, 12).map((p) => (
              <li key={p.piId}>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  onClick={() =>
                    router.push(
                      capacityHref({
                        organizationId,
                        departmentId,
                        piId: p.piId,
                      }),
                    )
                  }
                >
                  {p.referenceKey} · {p.lifecycle}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );
}
