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
  formatCapacityHours,
  formatUtilizationPct,
  initials,
  type StackSegmentView,
} from "./portfolio-capacity-model";

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
        className="font-[family-name:var(--font-display)] text-xl text-[var(--sidebar)]"
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
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  tone?: "default" | "critical" | "warn" | "blue";
}) {
  const bar =
    tone === "critical"
      ? "bg-[var(--color-error)]"
      : tone === "warn"
        ? "bg-[var(--color-warning)]"
        : tone === "blue"
          ? "bg-[var(--color-info)]"
          : "bg-[var(--color-accent)]";
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
      <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className="my-[3px] text-[27px] font-extrabold tracking-[-0.04em] text-[var(--sidebar)] tabular-nums">
        {value}
      </p>
      {note ? <p className="text-[10px] text-[var(--muted)]">{note}</p> : null}
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
      className="flex max-w-full flex-wrap items-end gap-3 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]"
      aria-label="Capacity scope filters"
    >
      <label className="min-w-0 flex-1 basis-full text-sm sm:basis-[12rem] sm:flex-none">
        <span className="mb-1 block text-[var(--muted)]">Organization</span>
        <select
          name="organizationId"
          defaultValue={organizationId}
          className="min-h-11 w-full max-w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
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
          className="min-h-11 w-full max-w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
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
          className="min-h-11 w-full max-w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
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
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
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
  return (
    <article
      className={`overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] ${
        open ? "ring-1 ring-[var(--color-accent)]/30" : ""
      }`}
      data-department-id={card.departmentId}
    >
      <div className="flex items-start justify-between gap-3 px-[17px] pb-3 pt-[15px]">
        <div>
          <div className="text-sm font-bold text-[var(--sidebar)]">
            {card.departmentName}
          </div>
          <div className="mt-[3px] text-[10px] text-[var(--muted)]">
            {card.teamCount} team{card.teamCount === 1 ? "" : "s"} ·{" "}
            {card.resourceCount} resource
            {card.resourceCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex gap-[15px] text-right">
          <div>
            <strong className="block text-[17px] text-[var(--sidebar)] tabular-nums">
              {formatCapacityHours(card.availableHours)}h
            </strong>
            <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">
              Available
            </span>
          </div>
          <div>
            <strong className="block text-[17px] text-[var(--sidebar)] tabular-nums">
              {formatCapacityHours(card.committedHours)}h
            </strong>
            <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">
              Committed
            </span>
          </div>
          <div>
            <strong
              className={`block text-[17px] tabular-nums ${
                card.overloadCount > 0 ? "text-[var(--color-error)]" : "text-[var(--sidebar)]"
              }`}
            >
              {card.overloadCount}
            </strong>
            <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">
              Overloaded
            </span>
          </div>
        </div>
      </div>
      <div className="px-[17px] pb-[13px]">
        <CapacityBar
          available={card.availableHours}
          committed={card.committedHours}
          unavailable={card.band === "none"}
        />
      </div>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between border-t border-[var(--line)] bg-[var(--bg)] px-4 py-[10px] text-left text-[11px] font-bold text-[var(--color-accent)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        aria-expanded={open}
        aria-controls={`dept-panel-${card.departmentId}`}
        id={`dept-toggle-${card.departmentId}`}
        onClick={onToggle}
      >
        <span>
          {open ? "Hide" : "View"} {card.teamCount} team
          {card.teamCount === 1 ? "" : "s"} &amp; resource allocation
          {card.overloadCount > 0
            ? ` · ${card.overloadCount} overloaded`
            : ""}
        </span>
        <span
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ⌄
        </span>
      </button>
      {open ? (
        <div
          className="border-t border-[var(--line)] px-4 pb-[10px] pt-1"
          id={`dept-panel-${card.departmentId}`}
          role="region"
          aria-labelledby={`dept-toggle-${card.departmentId}`}
        >
          {card.teams.map((team) => (
            <div
              key={team.teamId}
              className="mt-3"
              data-team-id={team.teamId}
              id={`team-${team.teamId}`}
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--sidebar)]">
                  {team.teamName}
                  <StatusBadge
                    status={bandToStatus(team.band)}
                    label={capacityStatusLabel(team.band)}
                    size="compact"
                  />
                </p>
                <p className="text-[10px] text-[var(--muted)]">
                  {formatCapacityHours(team.committedHours)}h /{" "}
                  {formatCapacityHours(team.availableHours)}h ·{" "}
                  {formatUtilizationPct(team.utilization)}
                </p>
              </div>
              <div className="mb-2">
                <CapacityBar
                  available={team.availableHours}
                  committed={team.committedHours}
                  unavailable={team.band === "none"}
                  showPercent
                />
              </div>
              <div className="hidden grid-cols-[145px_minmax(120px,1fr)_48px_93px] gap-2.5 px-0 py-2 text-[9px] uppercase tracking-wide text-[var(--muted)] sm:grid">
                <div>Resource</div>
                <div>Project commitments</div>
                <div className="text-right">Util</div>
                <div>Capacity status</div>
              </div>
              {team.resources.length === 0 ? (
                <p className="py-2 text-[11px] text-[var(--muted)]">
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
                      className="grid grid-cols-1 gap-2 border-t border-[var(--bg)] py-[9px] sm:grid-cols-[145px_minmax(120px,1fr)_48px_93px] sm:items-center sm:gap-2.5"
                      data-resource-id={r.resourceId}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full bg-[var(--bg)] text-[9px] font-extrabold text-[var(--ink)]"
                          aria-hidden
                        >
                          {initials(r.resourceName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[10px] font-bold text-[var(--ink)]">
                            {r.resourceName}
                          </div>
                          <div className="text-[9px] text-[var(--muted)]">
                            {r.teamName} · membership{" "}
                            {formatCapacityHours(r.membershipAllocationPercent)}
                            %
                          </div>
                        </div>
                      </div>
                      <div>
                        <div
                          className="flex h-[18px] overflow-hidden rounded bg-[var(--bg)]"
                          role="img"
                          aria-label={stackLabel}
                          title={stackLabel}
                        >
                          {stack.length > 0
                            ? stack.map((seg) => (
                                <i
                                  key={seg.projectId}
                                  className="block h-full min-w-[2px]"
                                  style={{
                                    width: `${seg.widthPct}%`,
                                    background: seg.color,
                                  }}
                                  title={`${seg.label}: ${formatCapacityHours(seg.committedHours)}h`}
                                />
                              ))
                            : bar.committedPct > 0 ? (
                                <i
                                  className={`block h-full min-w-[2px] ${
                                    rTone === "over"
                                      ? "bg-[var(--color-error)]"
                                      : rTone === "high"
                                        ? "bg-[var(--color-warning)]"
                                        : "bg-[var(--color-accent)]"
                                  }`}
                                  style={{ width: `${bar.committedPct}%` }}
                                />
                              ) : null}
                        </div>
                        <p className="mt-0.5 text-[9px] text-[var(--muted)]">
                          {formatCapacityHours(r.committedHours)}h committed ·{" "}
                          {formatCapacityHours(r.remainingHours)}h remaining
                          {stack.length > 0
                            ? ` · ${stack.length} project${stack.length === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </div>
                      <div
                        className={`text-right text-[10px] font-extrabold ${
                          rTone === "over"
                            ? "text-[var(--color-error)]"
                            : rTone === "high"
                              ? "text-[var(--color-warning)]"
                              : "text-[var(--color-success)]"
                        }`}
                      >
                        {formatUtilizationPct(r.utilization)}
                      </div>
                      <div className="hidden sm:block">
                        <StatusBadge
                          status={bandToStatus(r.band)}
                          label={capacityStatusLabel(r.band)}
                          size="compact"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ))}
          {projectLegend.length > 0 ? (
            <div
              className="mt-3 flex flex-wrap gap-3 px-0.5 text-[9px] text-[var(--muted)]"
              data-testid="capacity-project-legend"
              aria-label="Project commitment legend"
            >
              {projectLegend.map((seg) => (
                <span
                  key={seg.projectId}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: seg.color }}
                    aria-hidden
                  />
                  {seg.label} ({formatCapacityHours(seg.committedHours)}h)
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-[9px] text-[var(--muted)]">
            Stacked bars show real CURRENT project commitment hours against
            available capacity from capacity-policy. Shared Resources use
            membership % from the canonical policy — full capacity is not
            counted independently per team. No FTE or workstream percentages.
          </p>
        </div>
      ) : null}
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
      filterDepartmentCards(cards, {
        search,
        teamId: teamId || undefined,
        overloadedOnly,
      }),
    [cards, search, teamId, overloadedOnly],
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
    <div className="space-y-6" data-testid="portfolio-capacity-dashboard">
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ds-eyebrow text-[10px]">
            Resource Planning · {organizationName}
          </p>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            Department, team, and resource capacity on the current plan —
            not a second Portfolio dashboard or Resource ledger. Hours come
            from capacity-policy; stacked bars use real project commitments;
            draft scenarios are never authoritative load.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={appendReturnContext(
              `/portfolio?organizationId=${organizationId}${departmentId ? `&departmentId=${departmentId}` : ""}`,
              returnInput,
            )}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Portfolio
          </Link>
          <Link
            href={openPiHref}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {openPiTarget === "/pi" ? "PI Planning" : "Open PI Planning"}
          </Link>
        </div>
      </div>

      {/* ——— A. Planning Context ——— */}
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
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-sm shadow-[var(--shadow-md)]">
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

      {/* ——— B. Capacity Summary ——— */}
      {ready ? (
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
      {ready ? (
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
            <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
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

            <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
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
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] lg:col-span-2"
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

      {/* ——— E. Cross-department coordination ——— */}
      {ready ? (
        <section
          aria-labelledby="capacity-cross-department"
          data-testid="capacity-cross-department"
        >
          <SectionHeading
            id="capacity-cross-department"
            level="E · Cross-department"
            title="Cross-department coordination"
            description="Authorized available capacity, PlanningDependencies, and project commitments that need coordination. Sibling departments outside your scope are never loaded."
          />
          <div className="grid grid-cols-1 gap-[13px] lg:grid-cols-2">
            <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
              <div className="border-b border-[var(--line)] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[var(--sidebar)]">
                  Departments with available capacity
                </h3>
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Remaining hours &gt; 0 in your authorized capacity response
                </p>
              </div>
              <div className="px-4 py-3">
                {availableDepts.length === 0 ? (
                  <p role="status" className="text-[11px] text-[var(--muted)]">
                    No departments with remaining capacity in the returned
                    scope.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {availableDepts.map((d) => (
                      <li
                        key={d.departmentId}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bg)] py-2 last:border-0"
                      >
                        <div>
                          <p className="text-[11px] font-bold text-[var(--sidebar)]">
                            {d.departmentName}
                          </p>
                          <p className="text-[9px] text-[var(--muted)]">
                            {formatCapacityHours(d.remainingHours)}h remaining ·{" "}
                            {formatCapacityHours(d.committedHours)}h /{" "}
                            {formatCapacityHours(d.availableHours)}h
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={bandToStatus(d.band)}
                            label={d.statusLabel}
                            size="compact"
                          />
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-accent)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                            onClick={() => expandDepartment(d.departmentId)}
                          >
                            Open department
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>

            <article
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)]"
              data-testid="capacity-dependencies-panel"
            >
              <div className="border-b border-[var(--line)] px-4 py-[14px]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--sidebar)]">
                      Planning dependencies
                    </h3>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      Existing PlanningDependency records — status, severity,
                      owner, required-by
                    </p>
                  </div>
                  {piIdForNav ? (
                    <Link
                      href={dependenciesHref}
                      className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                    >
                      Open PI dependencies
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="px-4 py-3">
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
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {dependencies.rows.slice(0, 12).map((dep) => (
                      <li
                        key={dep.id}
                        className="border-b border-[var(--bg)] py-2 last:border-0"
                        data-dependency-id={dep.id}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={dependencyStatusToBadge(dep.status)}
                            label={dep.status}
                            size="compact"
                          />
                          <StatusBadge
                            status={criticalityToBadge(dep.criticality)}
                            label={dep.criticality}
                            size="compact"
                          />
                          <span className="text-[10px] font-bold text-[var(--sidebar)]">
                            {dep.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-[var(--muted)]">
                          <span className="font-semibold text-[var(--ink)]">
                            {dep.sourceLabel}
                          </span>
                          {" → "}
                          <span className="font-semibold text-[var(--ink)]">
                            {dep.targetLabel}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[9px] text-[var(--muted)]">
                          Owner: {dep.ownerName ?? "Unassigned"} · Needed by:{" "}
                          {formatNeededBy(dep.neededByDate)}
                        </p>
                        {dep.description ? (
                          <p className="mt-0.5 text-[9px] text-[var(--muted)]">
                            {dep.description}
                          </p>
                        ) : null}
                        {dep.sourceType === "PROJECT" ? (
                          (() => {
                            const commitment = ready.projectCommitments.find(
                              (p) => p.projectId === dep.sourceId,
                            );
                            return commitment ? (
                              <Link
                                href={commitment.href}
                                className="mt-1 inline-flex min-h-11 items-center text-[10px] font-bold text-[var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                              >
                                Open source project
                              </Link>
                            ) : (
                              <Link
                                href={dependenciesHref}
                                className="mt-1 inline-flex min-h-11 items-center text-[10px] font-bold text-[var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                              >
                                View on PI dependencies
                              </Link>
                            );
                          })()
                        ) : (
                          <Link
                            href={dependenciesHref}
                            className="mt-1 inline-flex min-h-11 items-center text-[10px] font-bold text-[var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                          >
                            View on PI dependencies
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
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
          </div>
        </section>
      ) : null}

      {/* ——— C. Department / Team / Resource Breakdown ——— */}
      {ready ? (
        <section
          aria-labelledby="capacity-hierarchy"
          data-testid="capacity-hierarchy"
        >
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <SectionHeading
              id="capacity-hierarchy"
              level="C · Hierarchy"
              title="Department → team → resource"
              description="Expand a department to inspect teams and resources in your authorized scope. Stacked bars show CURRENT project hours. Shared Resources use membership % from capacity-policy — full capacity is not counted independently per team."
            />
            <div
              className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
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
                  className="min-h-11 w-full rounded-md border border-[var(--line)] px-3 py-2 sm:w-[12rem]"
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
              <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--muted)]">
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
                className="min-h-11 w-full rounded-md border border-[var(--line)] px-3 py-2 sm:w-[210px]"
                placeholder="Search departments or people"
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
            <div className="grid grid-cols-1 gap-[13px] lg:grid-cols-2">
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
            <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
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

            <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
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

      {!piId && pis.length > 0 ? (
        <div
          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
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
  );
}
