"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CAPACITY_BAND_LABELS } from "@/components/portfolio/metric";
import { Alert } from "@/components/ui/alert";
import { CapacityBar } from "@/components/ui/capacity-bar";
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
  bandTone,
  buildDepartmentCards,
  capacityStatusLabel,
  committedLoadBarPct,
  conflictSubjectLabel,
  filterDepartmentCards,
  formatCapacityHours,
  formatUtilizationPct,
  initials,
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
        {level}
      </p>
      <h2
        id={id}
        className="font-[family-name:var(--font-display)] text-xl text-[#102a43]"
      >
        {title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-[#74848e]">{description}</p>
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
      ? "bg-[#d65d57]"
      : tone === "warn"
        ? "bg-[#e3a640]"
        : tone === "blue"
          ? "bg-[#5b8def]"
          : "bg-[#087f78]";
  return (
    <div className="relative overflow-hidden rounded-[11px] border border-[#e2e8eb] bg-white p-[14px_17px] shadow-[0_7px_22px_#1b33440a]">
      <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
      <p className="text-[11px] text-[#74848e]">{label}</p>
      <p className="my-[3px] text-[27px] font-extrabold tracking-[-0.04em] text-[#102a43] tabular-nums">
        {value}
      </p>
      {note ? <p className="text-[10px] text-[#829099]">{note}</p> : null}
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
      className="flex flex-wrap items-end gap-3 rounded-[11px] border border-[#e2e8eb] bg-white p-4 shadow-[0_7px_22px_#1b33440a]"
    >
      <label className="text-sm">
        <span className="mb-1 block text-[#74848e]">Organization</span>
        <select
          name="organizationId"
          defaultValue={organizationId}
          className="min-w-[12rem] rounded-md border border-[#e2e8eb] bg-white px-3 py-2"
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[#74848e]">Department</span>
        <select
          name="departmentId"
          defaultValue={departmentId ?? ""}
          className="min-w-[12rem] rounded-md border border-[#e2e8eb] bg-white px-3 py-2"
        >
          <option value="">All visible</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[#74848e]">Program Increment</span>
        <select
          name="piId"
          defaultValue={piId ?? ""}
          className="min-w-[14rem] rounded-md border border-[#e2e8eb] bg-white px-3 py-2"
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
        className="rounded-md bg-[#087f78] px-4 py-2 text-sm font-semibold text-white"
      >
        Apply
      </button>
    </form>
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
  return (
    <article
      className={`overflow-hidden rounded-[11px] border border-[#e2e8eb] bg-white shadow-[0_7px_22px_#1b33440a] ${
        open ? "ring-1 ring-[#087f78]/30" : ""
      }`}
      data-department-id={card.departmentId}
    >
      <div className="flex items-start justify-between gap-3 px-[17px] pb-3 pt-[15px]">
        <div>
          <div className="text-sm font-bold text-[#102a43]">
            {card.departmentName}
          </div>
          <div className="mt-[3px] text-[10px] text-[#74848e]">
            {card.teamCount} team{card.teamCount === 1 ? "" : "s"} ·{" "}
            {card.resourceCount} resource
            {card.resourceCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex gap-[15px] text-right">
          <div>
            <strong className="block text-[17px] text-[#102a43] tabular-nums">
              {formatCapacityHours(card.availableHours)}h
            </strong>
            <span className="text-[9px] uppercase tracking-wide text-[#74848e]">
              Available
            </span>
          </div>
          <div>
            <strong className="block text-[17px] text-[#102a43] tabular-nums">
              {formatCapacityHours(card.committedHours)}h
            </strong>
            <span className="text-[9px] uppercase tracking-wide text-[#74848e]">
              Committed
            </span>
          </div>
          <div>
            <strong
              className={`block text-[17px] tabular-nums ${
                card.overloadCount > 0 ? "text-[#d65d57]" : "text-[#102a43]"
              }`}
            >
              {card.overloadCount}
            </strong>
            <span className="text-[9px] uppercase tracking-wide text-[#74848e]">
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
        className="flex min-h-11 w-full items-center justify-between border-t border-[#e2e8eb] bg-[#fbfcfc] px-4 py-[10px] text-left text-[11px] font-bold text-[#087f78] hover:bg-[#f0f7f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
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
          className="border-t border-[#e2e8eb] px-4 pb-[10px] pt-1"
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
                <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#102a43]">
                  {team.teamName}
                  <StatusBadge
                    status={bandToStatus(team.band)}
                    label={capacityStatusLabel(team.band)}
                    size="compact"
                  />
                </p>
                <p className="text-[10px] text-[#74848e]">
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
              <div className="hidden grid-cols-[145px_minmax(120px,1fr)_48px_93px] gap-2.5 px-0 py-2 text-[9px] uppercase tracking-wide text-[#98a5ad] sm:grid">
                <div>Resource</div>
                <div>Committed load</div>
                <div className="text-right">Util</div>
                <div>Capacity status</div>
              </div>
              {team.resources.length === 0 ? (
                <p className="py-2 text-[11px] text-[#74848e]">
                  No resources visible for this team in the current scope.
                </p>
              ) : (
                team.resources.map((r) => {
                  const rTone = bandTone(r.band);
                  const bar = committedLoadBarPct(
                    r.availableHours,
                    r.committedHours,
                  );
                  return (
                    <div
                      key={`${r.resourceId}:${r.teamId}`}
                      className="grid grid-cols-1 gap-2 border-t border-[#edf1f2] py-[9px] sm:grid-cols-[145px_minmax(120px,1fr)_48px_93px] sm:items-center sm:gap-2.5"
                      data-resource-id={r.resourceId}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full bg-[#e8f0f4] text-[9px] font-extrabold text-[#31556c]"
                          aria-hidden
                        >
                          {initials(r.resourceName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[10px] font-bold text-[#344b59]">
                            {r.resourceName}
                          </div>
                          <div className="text-[9px] text-[#89969e]">
                            {r.teamName} · membership{" "}
                            {formatCapacityHours(r.membershipAllocationPercent)}
                            %
                          </div>
                        </div>
                      </div>
                      <div>
                        <div
                          className="flex h-[18px] overflow-hidden rounded bg-[#f0f3f4]"
                          role="img"
                          aria-label={`Committed ${formatCapacityHours(r.committedHours)} of ${formatCapacityHours(r.availableHours)} available hours`}
                          title={
                            bar.scale === "empty"
                              ? "No available or committed hours"
                              : `Committed ${formatCapacityHours(r.committedHours)}h / available ${formatCapacityHours(r.availableHours)}h`
                          }
                        >
                          {bar.committedPct > 0 ? (
                            <i
                              className={`block h-full min-w-[2px] ${
                                rTone === "over"
                                  ? "bg-[#d65d57]"
                                  : rTone === "high"
                                    ? "bg-[#e3a640]"
                                    : "bg-[#087f78]"
                              }`}
                              style={{ width: `${bar.committedPct}%` }}
                            />
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[9px] text-[#89969e]">
                          {formatCapacityHours(r.committedHours)}h committed ·{" "}
                          {formatCapacityHours(r.remainingHours)}h remaining
                        </p>
                      </div>
                      <div
                        className={`text-right text-[10px] font-extrabold ${
                          rTone === "over"
                            ? "text-[#d65d57]"
                            : rTone === "high"
                              ? "text-[#af7418]"
                              : "text-[#418a67]"
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
          <p className="mt-3 text-[9px] text-[#73828b]">
            Bars show committed load against available hours from
            capacity-policy on the CURRENT revision. Shared Resources use
            membership % from the canonical policy — full capacity is not
            counted independently per team. Per-project stacked segments per
            resource are not in the M2E-A contract — see Project commitments.
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
        <Alert tone="error" live="assertive">
          {capacityError}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#087f78]">
            Manager dashboard · {organizationName}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[25px] font-bold tracking-[-0.03em] text-[#102a43]">
            PI &amp; Resource Capacity
          </h1>
          <p className="mt-1 text-sm text-[#74848e]">
            Live capacity from the CURRENT planning revision. Hours come from
            capacity-policy — membership % is not project commitment. Draft
            scenarios are not shown as authoritative load.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/portfolio"
            className="inline-flex min-h-11 items-center rounded-md border border-[#e2e8eb] bg-white px-3 py-2 text-sm font-semibold text-[#425968] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
          >
            Portfolio
          </Link>
          <Link
            href={openPiHref}
            className="inline-flex min-h-11 items-center rounded-md bg-[#087f78] px-3 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
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
        <div className="rounded-[11px] border border-[#e2e8eb] bg-white p-4 text-sm shadow-[0_7px_22px_#1b33440a]">
          {!piId ? (
            <p role="status" className="text-[#74848e]">
              No PI selected — choose a Program Increment to load capacity. An
              explicit selection is never overridden.
            </p>
          ) : !capacity ? (
            <p role="status" className="text-[#74848e]">
              {capacityError
                ? "Capacity could not be loaded for the selected Program Increment."
                : "Capacity data was not returned for the selected Program Increment."}
            </p>
          ) : capacity.capacity.state === "no_pi_selected" ? (
            <p role="status" className="text-[#74848e]">
              {capacity.capacity.reason}
            </p>
          ) : capacity.capacity.state === "unavailable" ? (
            <Alert tone="warning" live="polite" title="Capacity unavailable">
              {capacity.capacity.reason}
            </Alert>
          ) : ready ? (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[#74848e]">
                  Selected PI
                </dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <Link
                    href={selectedPiMetaHref}
                    className="font-semibold text-[#087f78] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
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
                <dt className="text-[10px] uppercase tracking-wide text-[#74848e]">
                  Planning period
                </dt>
                <dd className="mt-1 font-semibold text-[#102a43]">
                  {formatPlanningPeriod(
                    ready.meta.startDate,
                    ready.meta.endDate,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[#74848e]">
                  CURRENT revision
                </dt>
                <dd className="mt-1">
                  <strong className="text-[#102a43]">
                    {ready.meta.revision.key} v{ready.meta.revision.version}
                  </strong>
                  <StatusBadge
                    status="in-progress"
                    label="CURRENT live"
                    size="compact"
                    className="ml-2"
                  />
                  <p className="mt-0.5 text-[10px] text-[#74848e]">
                    Authoritative commitments — not draft scenarios
                  </p>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[#74848e]">
                  Baseline comparison
                </dt>
                <dd className="mt-1">
                  {ready.baselineComparison.available ? (
                    <>
                      <strong className="text-[#102a43]">
                        Approved baseline v
                        {ready.baselineComparison.versionNumber}
                      </strong>
                      <p className="mt-0.5 text-[10px] text-[#74848e]">
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
                    <span className="text-[#74848e]">
                      Unavailable — {ready.baselineComparison.reason}
                    </span>
                  )}
                </dd>
              </div>
              <div className="text-[11px] text-[#74848e] sm:col-span-2 xl:col-span-4">
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
            <p className="text-[11px] text-[#74848e]">
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
            description="Overloaded teams, capacity shortages, planning conflicts, and missing capacity data that need action."
          />
          <div className="grid grid-cols-1 gap-[13px] lg:grid-cols-2">
            <article className="rounded-[11px] border border-[#e2e8eb] bg-white shadow-[0_7px_22px_#1b33440a]">
              <div className="border-b border-[#e2e8eb] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[#102a43]">
                  Overloaded teams
                </h3>
                <p className="mt-1 text-[10px] text-[#74848e]">
                  Jump into the department hierarchy without leaving this page
                </p>
              </div>
              <div className="px-4 py-3">
                {uniqueOverloadedTeams.length === 0 ? (
                  <p role="status" className="text-[11px] text-[#74848e]">
                    No overloaded teams in this scope.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {uniqueOverloadedTeams.map((t) => (
                      <li
                        key={t.teamId}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf1f2] py-2 last:border-0"
                      >
                        <div>
                          <p className="text-[11px] font-bold text-[#102a43]">
                            {t.teamName}
                          </p>
                          <p className="text-[9px] text-[#89969e]">
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
                            className="min-h-11 rounded-md border border-[#e2e8eb] bg-[#fbfcfc] px-3 py-1.5 text-[11px] font-bold text-[#087f78] hover:bg-[#f0f7f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
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

            <article className="rounded-[11px] border border-[#e2e8eb] bg-white shadow-[0_7px_22px_#1b33440a]">
              <div className="border-b border-[#e2e8eb] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[#102a43]">
                  Shortages &amp; data gaps
                </h3>
                <p className="mt-1 text-[10px] text-[#74848e]">
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
                  <p role="status" className="text-[11px] text-[#74848e]">
                    No missing capacity inputs reported.
                  </p>
                )}
                {shortageTeams.length === 0 ? (
                  <p role="status" className="text-[11px] text-[#74848e]">
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
                          className="min-h-11 text-left font-semibold text-[#087f78] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
                          onClick={() =>
                            expandDepartment(t.departmentId, t.teamId)
                          }
                        >
                          {t.teamName}
                          <span className="ml-1 font-normal text-[#89969e]">
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

            <article className="rounded-[11px] border border-[#e2e8eb] bg-white shadow-[0_7px_22px_#1b33440a] lg:col-span-2">
              <div className="border-b border-[#e2e8eb] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[#102a43]">
                  Planning conflicts
                </h3>
                <p className="mt-1 text-[10px] text-[#74848e]">
                  Derived from the existing conflict engine — not invented here
                </p>
              </div>
              <div className="px-4 py-3">
                {ready.conflicts.length === 0 ? (
                  <p role="status" className="text-[11px] text-[#74848e]">
                    No conflicts.
                  </p>
                ) : (
                  ready.conflicts.map((c, idx) => (
                    <div
                      key={`${c.type}-${c.subjectId}-${idx}`}
                      className="grid grid-cols-1 gap-2 border-b border-[#edf1f2] py-2 text-[9px] text-[#526572] last:border-0 sm:grid-cols-[1.5fr_1fr_auto] sm:items-center"
                    >
                      <span className="font-bold text-[#394f5c]">
                        {c.message}
                      </span>
                      <span>
                        {conflictSubjectLabel(
                          c,
                          ready.teams,
                          ready.resources.rows,
                        )}
                      </span>
                      <StatusBadge
                        status={
                          c.severity === "BLOCKER"
                            ? "blocked"
                            : c.severity === "WARNING"
                              ? "at-risk"
                              : "pending"
                        }
                        label={c.severity}
                        size="compact"
                      />
                    </div>
                  ))
                )}
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
              title="Department, team &amp; resource breakdown"
              description="Expand a department to inspect teams and resources in your authorized scope. Shared Resources use membership % from capacity-policy — full capacity is not counted independently per team."
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
                  className="min-h-11 w-full rounded-md border border-[#e2e8eb] px-3 py-2 sm:w-[12rem]"
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
              <label className="flex min-h-11 items-center gap-2 text-sm text-[#526572]">
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
                className="min-h-11 w-full rounded-md border border-[#e2e8eb] px-3 py-2 sm:w-[210px]"
                placeholder="Search departments or people"
                aria-label="Search departments or people"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {cards.length === 0 ? (
            <p
              role="status"
              className="rounded-[11px] border border-[#e2e8eb] bg-white p-6 text-sm text-[#74848e]"
            >
              No participating departments returned for this PI in your
              authorized scope.
            </p>
          ) : filtered.length === 0 ? (
            <p
              role="status"
              className="rounded-[11px] border border-[#e2e8eb] bg-white p-6 text-sm text-[#74848e]"
            >
              No departments match the current filters.
            </p>
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
            <article className="rounded-[11px] border border-[#e2e8eb] bg-white shadow-[0_7px_22px_#1b33440a]">
              <div className="border-b border-[#e2e8eb] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[#102a43]">
                  Project commitments
                </h3>
                <p className="mt-1 text-[10px] text-[#74848e]">
                  Hours from WorkAllocations on the CURRENT revision — not draft
                  scenarios
                </p>
              </div>
              <div className="px-4 py-3">
                {ready.projectCommitments.length === 0 ? (
                  <p role="status" className="text-[11px] text-[#74848e]">
                    Zero committed hours — no project allocations on this
                    revision.
                  </p>
                ) : (
                  ready.projectCommitments.map((p) => (
                    <div
                      key={p.projectId}
                      className="grid grid-cols-[1fr_auto] gap-2 border-b border-[#edf1f2] py-2 last:border-0"
                    >
                      <div>
                        <Link
                          href={p.href}
                          className="text-[10px] font-bold text-[#087f78] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
                        >
                          {p.referenceKey} · {p.name}
                        </Link>
                        <p className="mt-0.5 text-[9px] text-[#89969e]">
                          {p.workItemCount} work item
                          {p.workItemCount === 1 ? "" : "s"} ·{" "}
                          {p.allocationCount} allocation
                          {p.allocationCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right text-[10px] font-bold text-[#102a43]">
                        {formatCapacityHours(p.committedHours)}h
                        <small className="block text-[8px] font-normal text-[#74848e]">
                          committed
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-[11px] border border-[#e2e8eb] bg-white p-4 shadow-[0_7px_22px_#1b33440a]">
              <h3 className="text-sm font-bold text-[#102a43]">
                Shared resource policy
              </h3>
              <p className="mt-2 text-[11px] leading-relaxed text-[#74848e]">
                A Resource participating in multiple teams must not have full
                capacity counted independently in each team. Available hours
                already reflect membership allocation percent from the canonical
                capacity-policy. This UI sums returned hours only — it does not
                invent another aggregation formula. Per-project stacked segments
                per resource are not in the M2E-A contract; use Project
                commitments for CURRENT revision project load.
              </p>
              {ready.resources.total > ready.resources.rows.length ? (
                <p className="mt-3 text-[11px] text-[#74848e]">
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
          className="rounded-[11px] border border-[#e2e8eb] bg-white p-4"
          data-testid="capacity-pi-chips"
        >
          <p className="mb-2 text-sm font-semibold text-[#102a43]">
            Available Program Increments
          </p>
          <p className="mb-3 text-[11px] text-[#74848e]">
            Active, upcoming, and completed PIs you are authorized to see.
            Selecting one never overrides a later explicit choice.
          </p>
          <ul className="flex flex-wrap gap-2">
            {pis.slice(0, 12).map((p) => (
              <li key={p.piId}>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-md border border-[#e2e8eb] bg-[#f3f6f7] px-3 py-1.5 text-xs font-semibold text-[#087f78] hover:border-[#087f78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
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
