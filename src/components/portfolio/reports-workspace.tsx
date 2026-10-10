"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, EmptyState } from "@/components/ui/page";
import { LiveRegion } from "@/components/ui/live-region";
import { Button } from "@/components/ui/button";
import type { ManagementReportPreview } from "@/modules/portfolio/domain/management-reports";
import { MANAGEMENT_REPORT_TYPES } from "@/modules/portfolio/domain/management-reports";

const REPORT_LABELS: Record<(typeof MANAGEMENT_REPORT_TYPES)[number], string> =
  {
    portfolio_summary: "Portfolio Summary",
    project_status: "Project Status",
    pi_capacity: "PI Capacity",
    resource_allocation: "Resource Allocation",
    risks_blockers: "Risks & Blockers",
    governance_decisions: "Governance Decision Summary",
  };

type OrgOption = { id: string; name: string };
type DeptOption = { id: string; name: string };
type PiOption = { piId: string; referenceKey: string; name: string };

export function ReportsWorkspace({
  organizations,
  departments,
  pis,
  organizationId,
  departmentId,
  piId,
  reportType,
  preview,
  previewError,
}: {
  organizations: OrgOption[];
  departments: DeptOption[];
  pis: PiOption[];
  organizationId: string;
  departmentId?: string;
  piId?: string;
  reportType: (typeof MANAGEMENT_REPORT_TYPES)[number];
  preview: ManagementReportPreview | null;
  previewError?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("organizationId", organizationId);
    params.set("reportType", reportType);
    if (departmentId) params.set("departmentId", departmentId);
    if (piId) params.set("piId", piId);
    return `/api/reports/export?${params.toString()}`;
  }, [organizationId, departmentId, piId, reportType]);

  function applyFilters(form: HTMLFormElement) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    const org = String(data.get("organizationId") || "");
    const dept = String(data.get("departmentId") || "");
    const pi = String(data.get("piId") || "");
    const type = String(data.get("reportType") || reportType);
    if (org) params.set("organizationId", org);
    if (dept) params.set("departmentId", dept);
    if (pi) params.set("piId", pi);
    params.set("reportType", type);
    startTransition(() => {
      router.push(`/portfolio/reports?${params.toString()}`);
    });
  }

  async function downloadCsv() {
    setExportError(null);
    try {
      const res = await fetch(exportHref, { credentials: "same-origin" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const asOf = res.headers.get("X-Report-As-Of") ?? "";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}-${asOf.slice(0, 10) || "export"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="space-y-6" data-testid="reports-workspace">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters(e.currentTarget);
        }}
        data-testid="reports-filters"
      >
        <label className="min-w-[10rem] flex-1 text-sm">
          <span className="mb-1 block text-[var(--muted)]">Organization</span>
          <select
            name="organizationId"
            defaultValue={organizationId}
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1 text-sm">
          <span className="mb-1 block text-[var(--muted)]">Department</span>
          <select
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
          >
            <option value="">All visible</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="mb-1 block text-[var(--muted)]">Program Increment</span>
          <select
            name="piId"
            defaultValue={piId ?? ""}
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
            aria-label="Program Increment for capacity reports"
          >
            <option value="">Not required</option>
            {pis.map((p) => (
              <option key={p.piId} value={p.piId}>
                {p.referenceKey} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[14rem] flex-[1.2] text-sm">
          <span className="mb-1 block text-[var(--muted)]">Report type</span>
          <select
            name="reportType"
            defaultValue={reportType}
            className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
            aria-label="Report type"
          >
            {MANAGEMENT_REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {REPORT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" loading={pending}>
          Preview
        </Button>
      </form>

      {previewError ? (
        <Alert tone="error" live="assertive">
          {previewError}
        </Alert>
      ) : null}
      {exportError ? (
        <Alert tone="error" live="assertive">
          {exportError}
        </Alert>
      ) : null}

      {!preview ? (
        <EmptyState
          title="Select filters and preview"
          description="Reports compose existing portfolio, capacity, and governance read models. Nothing is invented."
        />
      ) : (
        <section
          className="space-y-4"
          data-testid="reports-preview"
          aria-labelledby="report-preview-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 print:block">
            <div>
              <p className="ds-eyebrow text-[10px]">
                Management report
              </p>
              <h2
                id="report-preview-title"
                className="font-[family-name:var(--font-display)] text-xl text-[var(--sidebar)]"
              >
                {preview.title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
                {preview.description}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]" data-testid="report-as-of">
                As of <time dateTime={preview.asOf}>{preview.asOf}</time>
                {" · "}
                Scope: {preview.scopeLabel}
                {" · "}
                Source: {preview.sourceOfTruth}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button
                type="button"
                variant="primary"
                onClick={() => void downloadCsv()}
                data-testid="report-export-csv"
              >
                Export CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.print()}
                data-testid="report-print"
              >
                Print
              </Button>
            </div>
          </div>

          {preview.kpis.length > 0 ? (
            <div
              className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
              data-testid="report-kpis"
            >
              {preview.kpis.map((k) => (
                <article
                  key={k.key}
                  className="ds-kpi-rail"
                >
                  <p className="text-[11px] text-[var(--muted)]">{k.label}</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--sidebar)] tabular-nums">
                    {k.value == null ? "—" : k.value}
                  </p>
                  {k.value == null && k.unavailableReason ? (
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      UNAVAILABLE · {k.unavailableReason}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {preview.limitations.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-[11px] text-[var(--muted)]">
              {preview.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}

          <LiveRegion
            message={
              preview.availability.state === "unavailable"
                ? preview.availability.reason ?? "Report unavailable"
                : preview.availability.state === "empty"
                  ? preview.availability.reason ?? "Report empty"
                  : `Previewing ${preview.rows.length} of ${preview.totalRows} rows${preview.truncated ? " (truncated)" : ""}.`
            }
          />

          {preview.availability.state === "unavailable" ? (
            <Alert tone="warning">
              {preview.availability.reason ?? "Report unavailable for this scope."}
            </Alert>
          ) : preview.availability.state === "empty" ||
            preview.rows.length === 0 ? (
            <EmptyState
              title="No rows"
              description={
                preview.availability.reason ??
                "No authorized rows match the current filters."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-xs" data-testid="report-table">
                <thead className="border-b border-[var(--line)] bg-[var(--bg)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    {preview.columns.map((c) => (
                      <th key={c.key} className="px-3 py-2 font-semibold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[var(--bg)] last:border-0"
                    >
                      {preview.columns.map((c) => {
                        const v = row[c.key];
                        return (
                          <td
                            key={c.key}
                            className="max-w-[16rem] truncate px-3 py-2 text-[var(--ink)]"
                            title={v == null ? "UNAVAILABLE" : String(v)}
                          >
                            {v == null ? (
                              <span className="text-[var(--muted)]">UNAVAILABLE</span>
                            ) : (
                              String(v)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.truncated ? (
                <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] text-[var(--muted)]">
                  Showing first {preview.rows.length} of {preview.totalRows}{" "}
                  rows (export bound).
                </p>
              ) : null}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
