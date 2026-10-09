import Link from "next/link";
import { humanize } from "@/components/governance/governance-panels";
import { EmptyState, Panel } from "@/components/ui/page";
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

function DeliveryCell({ row }: { row: PortfolioExplorerRow }) {
  if (row.kind === "INITIATIVE") {
    return (
      <span className="text-[var(--muted)]" title="Delivery signals apply to projects">
        Unavailable
      </span>
    );
  }
  const healthLabel =
    row.delivery.health === "BLOCKED"
      ? "Blocked"
      : row.delivery.health === "AT_RISK"
        ? "At risk"
        : row.delivery.health === "ON_TRACK"
          ? "On track"
          : row.delivery.health === "UNKNOWN"
            ? "Unknown"
            : row.delivery.health === "COMPLETED"
              ? "Completed"
              : row.delivery.health === "CANCELLED"
                ? "Cancelled"
                : null;
  const parts: string[] = [];
  if (row.delivery.delayed) parts.push("Delayed");
  if (row.delivery.activeBlocker) parts.push("Active blocker");
  if (row.delivery.criticalOpenIssue) parts.push("Critical issue");
  return (
    <div className="space-y-0.5 text-xs">
      {healthLabel ? (
        <p className="font-medium">{healthLabel}</p>
      ) : null}
      {parts.length === 0 ? (
        <span className="text-[var(--muted)]">
          {healthLabel ? "No legacy signals" : "No signals"}
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
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
        >
          Reset filters
        </Link>
      </div>
      <form method="get" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm md:col-span-2">
          <span className="text-[var(--muted)]">Search title or reference</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="e.g. M2B-1 or modernization"
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Organization</span>
          <select
            name="organizationId"
            defaultValue={filters.organizationId}
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <div className="flex items-end md:col-span-2 xl:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Apply
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

  if (result.total === 0) {
    return (
      <EmptyState
        title="No matching portfolio items"
        description="Nothing matched the current search and filters in your authorized scope. Try clearing filters or broadening the search."
        action={
          <Link
            href={`/portfolio/explorer?organizationId=${filters.organizationId}`}
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
          >
            Reset filters
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
          <p>
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
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Reference</th>
                <th className="py-2 pr-3 font-medium">Title</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Department</th>
                <th className="py-2 pr-3 font-medium">Owner</th>
                <th className="py-2 pr-3 font-medium">Delivery</th>
                <th className="py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {result.rows.map((row) => (
                <tr key={`${row.kind}-${row.id}`}>
                  <td className="py-3 pr-3 text-[var(--muted)]">
                    {row.kind === "INITIATIVE" ? "Initiative" : "Project"}
                  </td>
                  <td className="py-3 pr-3 font-medium">
                    <Link href={row.href} className="text-[var(--accent)]">
                      {row.referenceKey}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    <Link href={row.href} className="hover:text-[var(--accent)]">
                      {row.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">{humanize(row.statusLabel)}</td>
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
                href={row.href}
                className="mt-1 block font-medium text-[var(--accent)]"
              >
                {row.referenceKey} · {row.title}
              </Link>
              <p className="mt-1 text-sm">
                {humanize(row.statusLabel)} · {row.departmentName}
              </p>
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
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)]">
                Previous
              </span>
            )}
            {result.page < totalPages ? (
              <Link
                href={buildExplorerHref(filters, {
                  page: String(result.page + 1),
                })}
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)]">
                Next
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
