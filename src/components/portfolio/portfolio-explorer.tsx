import Link from "next/link";
import { fieldClassName } from "@/components/ui/forms";
import { LiveRegion } from "@/components/ui/live-region";
import { EmptyState, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  mapDeliveryHealthBadge,
  mapExplorerStatusBadge,
} from "@/components/ui/status-adapters";
import {
  appendReturnContext,
  explorerReturnInput,
} from "@/modules/navigation/return-context";
import type {
  PortfolioExplorerResult,
  PortfolioExplorerRow,
} from "@/modules/portfolio/domain/types";

export type ExplorerFilterState = {
  organizationId: string;
  departmentId?: string;
  sectionId?: string;
  q?: string;
  kind?: string;
  initiativeStage?: string;
  projectStatus?: string;
  ownerResourceId?: string;
  delivery?: string;
  deliveryHealth?: string;
  sortBy?: string;
  sortDir?: string;
  page?: string;
};

function buildExplorerHref(
  base: ExplorerFilterState,
  overrides: Partial<ExplorerFilterState> & { page?: string },
): string {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  params.set("organizationId", merged.organizationId);
  for (const key of [
    "departmentId",
    "sectionId",
    "q",
    "kind",
    "initiativeStage",
    "projectStatus",
    "ownerResourceId",
    "delivery",
    "deliveryHealth",
    "sortBy",
    "sortDir",
    "page",
  ] as const) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  return `/portfolio/explorer?${params.toString()}`;
}

/** Preserve explorer filters when opening Initiative/Project detail. */
function contextualRowHref(
  row: PortfolioExplorerRow,
  filters: ExplorerFilterState,
): string {
  return appendReturnContext(
    row.href,
    explorerReturnInput({
      organizationId: filters.organizationId,
      departmentId: filters.departmentId,
      sectionId: filters.sectionId,
      q: filters.q,
      kind: filters.kind,
      initiativeStage: filters.initiativeStage,
      projectStatus: filters.projectStatus,
      ownerResourceId: filters.ownerResourceId,
      delivery: filters.delivery,
      deliveryHealth: filters.deliveryHealth,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      page: filters.page,
    }),
  );
}

function DeliveryCell({ row }: { row: PortfolioExplorerRow }) {
  if (row.kind === "INITIATIVE") {
    return (
      <StatusBadge
        status="unavailable"
        label="Unavailable"
        size="compact"
      />
    );
  }
  const health = row.delivery.health
    ? mapDeliveryHealthBadge(row.delivery.health)
    : null;
  const parts: string[] = [];
  if (row.delivery.delayed) parts.push("Delayed");
  if (row.delivery.activeBlocker) parts.push("Active blocker");
  if (row.delivery.criticalOpenIssue) parts.push("Critical issue");
  return (
    <div className="space-y-1 text-xs">
      {health ? (
        <StatusBadge
          status={health.status}
          label={health.label}
          size="compact"
        />
      ) : null}
      {parts.length === 0 ? (
        <span className="text-[var(--muted)]">
          {health ? "No legacy signals" : "No signals"}
        </span>
      ) : (
        <ul className="space-y-0.5">
          {parts.map((p) => (
            <li key={p}>
              <span className="font-medium text-[var(--warning)]">{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExplorerStatusCell({ row }: { row: PortfolioExplorerRow }) {
  const mapped = mapExplorerStatusBadge(row.kind, row.statusLabel);
  return (
    <StatusBadge status={mapped.status} label={mapped.label} size="compact" />
  );
}

export function PortfolioExplorerFilters({
  filters,
  organizations,
  sections,
  departments,
  owners,
}: {
  filters: ExplorerFilterState;
  organizations: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  owners: Array<{ id: string; name: string }>;
}) {
  const resetHref = `/portfolio/explorer?organizationId=${filters.organizationId}`;

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Search and filters</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Filters and sorting run on the server within your authorized scope.
          </p>
        </div>
        <Link
          href={resetHref}
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Reset filters
        </Link>
      </div>
      <form
        method="get"
        role="search"
        aria-label="Portfolio explorer filters"
        className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      >
        <label className="block text-sm md:col-span-2">
          <span className="text-[var(--muted)]">Search title or reference</span>
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="e.g. M2B-1 or modernization"
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Organization</span>
          <select
            name="organizationId"
            defaultValue={filters.organizationId}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Type</span>
          <select
            name="kind"
            defaultValue={filters.kind ?? ""}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="">Initiatives and projects</option>
            <option value="INITIATIVE">Initiatives only</option>
            <option value="PROJECT">Projects only</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Section</span>
          <select
            name="sectionId"
            defaultValue={filters.sectionId ?? ""}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="">All visible sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Department</span>
          <select
            name="departmentId"
            defaultValue={filters.departmentId ?? ""}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="">All visible departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Initiative stage</span>
          <select
            name="initiativeStage"
            defaultValue={filters.initiativeStage ?? ""}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="">Any</option>
            <option value="DEMAND">Demand</option>
            <option value="REQUIREMENTS">Requirements</option>
            <option value="PRE_STUDY">Pre-study</option>
            <option value="POC">PoC</option>
            <option value="PILOT">Pilot</option>
            <option value="PROJECT">Project</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Project status</span>
          <select
            name="projectStatus"
            defaultValue={filters.projectStatus ?? ""}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="">Any</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Owner (resource)</span>
          <select
            name="ownerResourceId"
            defaultValue={filters.ownerResourceId ?? ""}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="">Any structured owner</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Delivery signal</span>
          <select
            name="delivery"
            defaultValue={filters.delivery ?? ""}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="">Any</option>
            <option value="DELAYED">Delayed projects</option>
            <option value="ACTIVE_BLOCKER">Active blocker</option>
            <option value="CRITICAL_ISSUE">Critical open issue</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Delivery health</span>
          <select
            name="deliveryHealth"
            defaultValue={filters.deliveryHealth ?? ""}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="">Any classification</option>
            <option value="BLOCKED">Blocked</option>
            <option value="AT_RISK">At risk</option>
            <option value="ON_TRACK">On track</option>
            <option value="UNKNOWN">Unknown / insufficient data</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Sort by</span>
          <select
            name="sortBy"
            defaultValue={filters.sortBy ?? "updatedAt"}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="updatedAt">Updated</option>
            <option value="name">Name</option>
            <option value="status">Lifecycle / status</option>
            <option value="targetDate">Target date</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Direction</span>
          <select
            name="sortDir"
            defaultValue={filters.sortDir ?? "desc"}
            className={`mt-1 block min-h-11 ${fieldClassName}`}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <div className="flex items-end md:col-span-2 xl:col-span-4">
          <button
            type="submit"
            className="min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Apply filters
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function PortfolioExplorerResults({
  result,
  filters,
}: {
  result: PortfolioExplorerResult;
  filters: ExplorerFilterState;
}) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);
  const rowHref = (row: PortfolioExplorerRow) => contextualRowHref(row, filters);

  const resultsMessage =
    result.total === 0
      ? "No matching portfolio items for the current filters."
      : `Showing ${from} to ${to} of ${result.total} portfolio results, sorted by ${result.sortBy}, ${result.sortDir}.`;

  if (result.total === 0) {
    return (
      <>
        <LiveRegion message={resultsMessage} />
        <EmptyState
          title="No matching portfolio items"
          description="Nothing matched the current search and filters in your authorized scope. Try clearing filters or broadening the search."
          action={
            <Link
              href={`/portfolio/explorer?organizationId=${filters.organizationId}`}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Reset filters
            </Link>
          }
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <LiveRegion message={resultsMessage} />
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
          <p aria-hidden="true">
            Showing{" "}
            <span className="font-medium text-[var(--ink)] tabular-nums">
              {from}–{to}
            </span>{" "}
            of{" "}
            <span className="font-medium text-[var(--ink)] tabular-nums">
              {result.total}
            </span>
            {" · "}
            sorted by {result.sortBy} ({result.sortDir})
          </p>
          <p>
            Scope:{" "}
            {result.scope.mode === "organization"
              ? "organization-wide"
              : `${result.scope.departmentIds.length} department(s)`}
          </p>
        </div>

        {/* Desktop table */}
        <div
          className="hidden overflow-x-auto md:block"
          role="region"
          aria-label="Portfolio explorer results table. Scroll horizontally to see all columns."
          tabIndex={0}
        >
          <table className="w-full min-w-[640px] text-left text-sm lg:min-w-[880px]">
            <caption className="sr-only">
              Portfolio explorer results
            </caption>
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Type
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Reference
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Title
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Status
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Department
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Owner
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Delivery
                </th>
                <th scope="col" className="py-2 font-medium">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {result.rows.map((row) => (
                <tr key={`${row.kind}-${row.id}`}>
                  <td className="py-3 pr-3 text-[var(--muted)]">
                    {row.kind === "INITIATIVE" ? "Initiative" : "Project"}
                  </td>
                  <td className="py-3 pr-3 font-medium">
                    <Link href={rowHref(row)} className="text-[var(--accent)]">
                      {row.referenceKey}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    <Link href={rowHref(row)} className="hover:text-[var(--accent)]">
                      {row.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    <ExplorerStatusCell row={row} />
                  </td>
                  <td className="py-3 pr-3 text-[var(--muted)]">
                    {row.sectionName} / {row.departmentName}
                  </td>
                  <td className="py-3 pr-3">
                    {row.owner.displayName}
                    {row.owner.source === "legacy" ? (
                      <span className="ml-1 text-xs text-[var(--muted)]">
                        (legacy)
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    <DeliveryCell row={row} />
                  </td>
                  <td className="py-3 text-[var(--muted)] tabular-nums">
                    {new Date(row.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="space-y-3 md:hidden">
          {result.rows.map((row) => (
            <li
              key={`${row.kind}-${row.id}`}
              className="rounded-md border border-[var(--line)] p-3"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {row.kind === "INITIATIVE" ? "Initiative" : "Project"}
              </p>
              <Link
                href={rowHref(row)}
                className="mt-1 block font-medium text-[var(--accent)]"
              >
                {row.referenceKey} · {row.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <ExplorerStatusCell row={row} />
                <span className="text-[var(--muted)]">{row.departmentName}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Owner: {row.owner.displayName}
                {row.owner.source === "legacy" ? " (legacy)" : ""}
              </p>
              <div className="mt-2 text-sm">
                <DeliveryCell row={row} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {totalPages > 1 ? (
        <nav
          aria-label="Explorer pagination"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-[var(--muted)]">
            Page {result.page} of {totalPages}
          </p>
          <div className="flex flex-wrap gap-2">
            {result.page > 1 ? (
              <Link
                href={buildExplorerHref(filters, {
                  page: String(result.page - 1),
                })}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Previous
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)]">
                Previous
              </span>
            )}
            {result.page < totalPages ? (
              <Link
                href={buildExplorerHref(filters, {
                  page: String(result.page + 1),
                })}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Next
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)]">
                Next
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
