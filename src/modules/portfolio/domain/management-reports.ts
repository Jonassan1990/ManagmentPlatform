/**
 * M5E-B — Management report contracts.
 * Composition over existing read models only — no new KPI formulas.
 */

export const MANAGEMENT_REPORT_TYPES = [
  "portfolio_summary",
  "project_status",
  "pi_capacity",
  "resource_allocation",
  "risks_blockers",
  "governance_decisions",
] as const;

export type ManagementReportType = (typeof MANAGEMENT_REPORT_TYPES)[number];

export type ManagementReportFilterInput = {
  organizationId: string;
  departmentId?: string;
  piId?: string;
  reportType: ManagementReportType;
};

export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportPreviewRow = Record<string, string | number | null>;

export type ManagementReportPreview = {
  reportType: ManagementReportType;
  title: string;
  description: string;
  asOf: string;
  scopeLabel: string;
  organizationId: string;
  departmentId?: string;
  piId?: string;
  sourceOfTruth: string;
  columns: ReportColumn[];
  rows: ReportPreviewRow[];
  /** Total rows before CSV_MAX_ROWS truncation. */
  totalRows: number;
  truncated: boolean;
  /** KPI strip for portfolio_summary / capacity — null means unavailable. */
  kpis: Array<{
    key: string;
    label: string;
    value: string | number | null;
    unavailableReason?: string;
  }>;
  limitations: string[];
  /** Empty / unavailable states for the whole report. */
  availability: { state: "ready" | "empty" | "unavailable"; reason?: string };
};
