"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CAPACITY_BAND_LABELS } from "@/components/portfolio/metric";
import type {
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
  utilTrackWidthPct,
} from "./portfolio-capacity-model";

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
  const tone = bandTone(card.band);
  const utilLabel = formatUtilizationPct(card.utilization);
  const trackPct = utilTrackWidthPct(card.utilization);

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
      <div className="grid grid-cols-[1fr_auto] items-center gap-[9px] px-[17px] pb-[13px]">
        <div
          className="h-[7px] overflow-hidden rounded-lg bg-[#eef2f3]"
          role="img"
          aria-label={`Utilization ${utilLabel}`}
        >
          <i
            className={`block h-full rounded-lg ${
              tone === "over"
                ? "bg-[#d65d57]"
                : tone === "high"
                  ? "bg-[#e3a640]"
                  : "bg-[#087f78]"
            }`}
            style={{ width: `${trackPct}%` }}
          />
        </div>
        <div className="text-[10px] font-bold text-[#526572]">{utilLabel}</div>
      </div>
      <button
        type="button"
        className="flex w-full items-center justify-between border-t border-[#e2e8eb] bg-[#fbfcfc] px-4 py-[10px] text-left text-[11px] font-bold text-[#087f78] hover:bg-[#f0f7f6]"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>
          {open ? "Hide" : "View"} {card.teamCount} team
          {card.teamCount === 1 ? "" : "s"} &amp; resource allocation
        </span>
        <span
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ⌄
        </span>
      </button>
      {open ? (
        <div className="border-t border-[#e2e8eb] px-4 pb-[10px] pt-1">
          {card.teams.map((team) => (
            <div key={team.teamId} className="mt-3">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-[#102a43]">
                  {team.teamName}
                  {team.band === "overload" ? (
                    <span className="ml-2 rounded-full bg-[#fcebea] px-2 py-0.5 text-[9px] font-bold text-[#b94d47]">
                      Overloaded
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-[#74848e]">
                  {formatCapacityHours(team.committedHours)}h /{" "}
                  {formatCapacityHours(team.availableHours)}h ·{" "}
                  {formatUtilizationPct(team.utilization)}
                </p>
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
                      <div
                        className={`hidden text-center text-[9px] font-bold sm:block rounded-full px-1.5 py-1 ${
                          rTone === "over"
                            ? "bg-[#fcebea] text-[#b94d47]"
                            : rTone === "high"
                              ? "bg-[#fff4df] text-[#a86a0d]"
                              : "bg-[#e8f5ed] text-[#367652]"
                        }`}
                      >
                        {capacityStatusLabel(r.band)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ))}
          <p className="mt-3 text-[9px] text-[#73828b]">
            Bars show committed load against available hours from capacity-policy
            (CURRENT revision). Per-project stacked shares per resource are not
            in the M2E-A contract — see Project commitments below.
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

  return (
    <div className="space-y-4">
      <ScopeForm
        organizations={organizations}
        departments={departments}
        organizationId={organizationId}
        departmentId={departmentId}
        piId={piId}
        pis={pis}
      />

      {listError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {listError}
        </p>
      ) : null}
      {capacityError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {capacityError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#087f78]">
            Manager dashboard · {organizationName}
          </p>
          <h2 className="mt-1 text-[25px] font-bold tracking-[-0.03em] text-[#102a43]">
            PI &amp; Resource Capacity
          </h2>
          <p className="mt-1 text-sm text-[#74848e]">
            Live capacity from the CURRENT planning revision. Hours only —
            membership % is not project commitment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/portfolio"
            className="rounded-md border border-[#e2e8eb] bg-white px-3 py-2 text-sm font-semibold text-[#425968]"
          >
            Portfolio
          </Link>
          <Link
            href={selectedPi ? selectedPi.href : "/pi"}
            className="rounded-md bg-[#087f78] px-3 py-2 text-sm font-semibold text-white"
          >
            {selectedPi ? "Open PI Planning" : "PI Planning"}
          </Link>
        </div>
      </div>

      {/* Context strip */}
      <div className="rounded-[11px] border border-[#e2e8eb] bg-white p-4 text-sm shadow-[0_7px_22px_#1b33440a]">
        {!piId ? (
          <p className="text-[#74848e]">No PI selected — choose a Program Increment to load capacity.</p>
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
          <p role="status" className="rounded-md border border-[#e2e8eb] bg-[#f3f6f7] px-3 py-2 text-[#526572]">
            Unavailable — {capacity.capacity.reason}
          </p>
        ) : ready ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <span className="text-[#74848e]">Selected PI </span>
              <Link
                href={ready.meta.piId ? `/pi/${ready.meta.piId}` : "/pi"}
                className="font-semibold text-[#087f78] underline-offset-2 hover:underline"
              >
                {ready.meta.referenceKey} · {ready.meta.name}
              </Link>
              <span className="ml-2 text-[11px] text-[#74848e]">
                {ready.meta.status}
              </span>
            </div>
            <div>
              <span className="text-[#74848e]">Planning revision </span>
              <strong className="text-[#102a43]">
                {ready.meta.revision.key} v{ready.meta.revision.version}{" "}
                (CURRENT)
              </strong>
            </div>
            <div>
              <span className="text-[#74848e]">Baseline </span>
              {ready.baselineComparison.available ? (
                <strong className="text-[#102a43]">
                  v{ready.baselineComparison.versionNumber} · Δ{" "}
                  {formatCapacityHours(ready.baselineComparison.deltaHours)}h
                  vs live
                </strong>
              ) : (
                <span className="text-[#74848e]">
                  Unavailable — {ready.baselineComparison.reason}
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#74848e]">
              As of {new Date(capacity.asOf).toLocaleString()}
            </div>
          </div>
        ) : null}
      </div>

      {/* KPIs */}
      {ready ? (
        <section
          className="grid grid-cols-2 gap-2 sm:gap-[13px] lg:grid-cols-3 xl:grid-cols-6"
          aria-label="Capacity KPIs"
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
                : "WorkAllocation planned hours"
            }
          />
          <KpiCard
            label="Remaining hours"
            value={`${formatCapacityHours(ready.totals.remainingHours)}h`}
            note="Available − committed"
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
            value={String(
              new Set(ready.overloadedTeams.map((t) => t.teamId)).size,
            )}
            note="Team-iterations with overload band"
            tone={
              ready.overloadedTeams.length > 0 ? "critical" : "default"
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
        </section>
      ) : null}

      {ready?.dataQuality.missingCapacityInputs ? (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          Missing capacity inputs —{" "}
          {ready.dataQuality.notes[0] ??
            "Some resources lack capacityHoursPerWeek; treated as 0 hours, not unavailable."}
        </p>
      ) : null}

      {/* Filters */}
      {ready ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#102a43]">
                Department allocation
              </h3>
              <p className="mt-1 text-[11px] text-[#74848e]">
                Expand a department to inspect teams and resources in your
                authorized scope.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label className="text-sm">
                <span className="sr-only">Team filter</span>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full rounded-md border border-[#e2e8eb] px-3 py-2 sm:w-[12rem]"
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
              <label className="flex items-center gap-2 text-sm text-[#526572]">
                <input
                  type="checkbox"
                  checked={overloadedOnly}
                  onChange={(e) => setOverloadedOnly(e.target.checked)}
                />
                Overloaded only
              </label>
              <input
                className="w-full rounded-md border border-[#e2e8eb] px-3 py-2 sm:w-[210px]"
                placeholder="Search departments or people"
                aria-label="Search departments or people"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p
              role="status"
              className="rounded-[11px] border border-[#e2e8eb] bg-white p-6 text-sm text-[#74848e]"
            >
              No departments match the current filters.
            </p>
          ) : (
            <section className="grid grid-cols-1 gap-[13px] lg:grid-cols-2">
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
            </section>
          )}

          {/* Bottom panels */}
          <div className="grid grid-cols-1 gap-[13px] lg:grid-cols-2">
            <section className="rounded-[11px] border border-[#e2e8eb] bg-white shadow-[0_7px_22px_#1b33440a]">
              <div className="border-b border-[#e2e8eb] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[#102a43]">
                  Project commitments
                </h3>
                <p className="mt-1 text-[10px] text-[#74848e]">
                  Hours from WorkAllocations on the CURRENT revision
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
                          className="text-[10px] font-bold text-[#087f78] hover:underline"
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
            </section>

            <section className="rounded-[11px] border border-[#e2e8eb] bg-white shadow-[0_7px_22px_#1b33440a]">
              <div className="border-b border-[#e2e8eb] px-4 py-[14px]">
                <h3 className="text-sm font-bold text-[#102a43]">
                  Planning conflicts
                </h3>
                <p className="mt-1 text-[10px] text-[#74848e]">
                  Derived from the existing conflict engine
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
                      className="grid grid-cols-[1.5fr_1fr_auto] gap-2 border-b border-[#edf1f2] py-2 text-[9px] text-[#526572] last:border-0"
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
                      <span
                        className={`rounded-full px-2 py-1 text-[8px] font-bold ${
                          c.severity === "BLOCKER"
                            ? "bg-[#fcebea] text-[#b94d47]"
                            : c.severity === "WARNING"
                              ? "bg-[#fff3e0] text-[#9b6b19]"
                              : "bg-[#eef4f6] text-[#54717e]"
                        }`}
                      >
                        {c.severity}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {ready.resources.total > ready.resources.rows.length ? (
            <p className="text-[11px] text-[#74848e]">
              Showing {ready.resources.rows.length} of {ready.resources.total}{" "}
              resource-iteration rows (bounded page from M2E-A).
            </p>
          ) : null}
        </>
      ) : null}

      {/* Quick PI chips when none selected */}
      {!piId && pis.length > 0 ? (
        <div className="rounded-[11px] border border-[#e2e8eb] bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-[#102a43]">
            Available Program Increments
          </p>
          <ul className="flex flex-wrap gap-2">
            {pis.slice(0, 12).map((p) => (
              <li key={p.piId}>
                <button
                  type="button"
                  className="rounded-md border border-[#e2e8eb] bg-[#f3f6f7] px-3 py-1.5 text-xs font-semibold text-[#087f78] hover:border-[#087f78]"
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
