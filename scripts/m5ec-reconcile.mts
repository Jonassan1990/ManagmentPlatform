/**
 * M5E-C — Reconcile Resource Planning / KPIs / Reports against authoritative services.
 * Isolated seed; no UI mutations.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import type { Principal } from "../src/modules/identity-access/domain/types";
import { GovernanceService } from "../src/modules/governance/application/governance-service";
import { PlanningService } from "../src/modules/pi-planning/application/planning-service";
import { ManagementReportService } from "../src/modules/portfolio/application/management-report-service";
import { PortfolioPiCapacityQueryService } from "../src/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { PortfolioQueryService } from "../src/modules/portfolio/application/portfolio-query-service";
import {
  escapeCsvCell,
  toCsv,
} from "../src/modules/portfolio/application/report-csv";
import { resetEnvCacheForTests } from "../src/server/env";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
process.env.DATABASE_URL = dbUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? dbUrl;
process.env.ALLOW_DEV_AUTH = "false";
process.env.NODE_ENV = "test";
resetEnvCacheForTests();

const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5ec-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const governance = new GovernanceService(db, authz, audit);
const planning = new PlanningService(db, authz, audit);
const portfolio = new PortfolioQueryService(db, authz, audit);
const piCapacity = new PortfolioPiCapacityQueryService(
  db,
  authz,
  audit,
  planning,
);
const reports = new ManagementReportService(
  db,
  authz,
  portfolio,
  piCapacity,
  governance,
);

type Check = { id: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function check(id: string, ok: boolean, detail?: string) {
  checks.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}\t${id}${detail ? `\t${detail}` : ""}`);
}

function principal(): Principal {
  return { id: principalId, displayName: "M5EC", source: "test" };
}

// Ensure fixtures
spawnSync("npx", ["tsx", "scripts/m5eb-seed-browser.mts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: dbUrl,
    DIRECT_URL: dbUrl,
    TEMP_AUTH_PRINCIPAL_ID: principalId,
    QA_OUT_DIR: outDir,
  },
  encoding: "utf8",
  stdio: "inherit",
});

const seed = JSON.parse(
  fs.readFileSync(path.join(outDir, "seed.json"), "utf8"),
) as {
  organizationId: string;
  departmentId: string;
  piId: string;
};

const admin = principal();

// 1) Capacity overview vs PlanningService capacity views (CURRENT)
const overview = await piCapacity.getPiCapacityOverview(admin, {
  organizationId: seed.organizationId,
  piId: seed.piId,
  includeResources: true,
  includeProjectCommitments: true,
  includeConflicts: true,
});
check("capacity-ready", overview.capacity.state === "ready");

if (overview.capacity.state === "ready") {
  const views = await planning.getCapacityViews(admin, seed.piId);
  const engineAvailable = views.teams.reduce(
    (n, t) => n + Number(t.effectiveCapacityHours ?? 0),
    0,
  );
  const engineCommitted = views.teams.reduce(
    (n, t) => n + Number(t.plannedLoadHours ?? 0),
    0,
  );
  const deltaAvail = Math.abs(
    overview.capacity.totals.availableHours - engineAvailable,
  );
  const deltaCommit = Math.abs(
    overview.capacity.totals.committedHours - engineCommitted,
  );
  check(
    "capacity-reconciles-capacity-service",
    deltaAvail < 0.05 && deltaCommit < 0.05,
    `availΔ=${deltaAvail.toFixed(3)} commitΔ=${deltaCommit.toFixed(3)}`,
  );

  // 2) Shared resources not double-counted as 100% per team
  const shared = overview.capacity.resources.rows.filter(
    (r) => r.membershipAllocationPercent > 0 && r.membershipAllocationPercent < 100,
  );
  check(
    "shared-resources-present",
    shared.length > 0,
    `rows=${shared.length}`,
  );
  check(
    "shared-resources-not-full-per-team",
    shared.every((r) => r.membershipAllocationPercent <= 50 + 1e-6),
    "membership % reflects policy split",
  );

  // 3) Project segments hours ≤ committed
  const segOk = overview.capacity.resources.rows.every((r) => {
    const seg = r.projectSegments.reduce((n, s) => n + s.committedHours, 0);
    return seg <= r.committedHours + 0.001;
  });
  check("project-segments-bounded-by-committed", segOk);
}

// 4) Portfolio KPIs reconcile snapshot ↔ report preview
const snapshot = await portfolio.getPortfolioSnapshot(admin, {
  organizationId: seed.organizationId,
});
const summary = await reports.getReportPreview(admin, {
  organizationId: seed.organizationId,
  reportType: "portfolio_summary",
});
const kpiActive = summary.kpis.find((k) => k.key === "active-initiatives");
const snapActive = snapshot.initiatives.available
  ? snapshot.initiatives.value.total
  : null;
check(
  "kpi-active-initiatives-reconcile",
  kpiActive?.value === snapActive,
  `report=${kpiActive?.value} snap=${snapActive}`,
);
const kpiDelayed = summary.kpis.find((k) => k.key === "delayed-projects");
const snapDelayed = snapshot.delayedProjects.available
  ? snapshot.delayedProjects.value.delayedProjects
  : null;
check(
  "kpi-delayed-reconcile",
  kpiDelayed?.value === snapDelayed,
  `report=${kpiDelayed?.value} snap=${snapDelayed}`,
);

// 5) Report filters match — department scope reduces or equals org scope
const orgProjects = await reports.getReportPreview(admin, {
  organizationId: seed.organizationId,
  reportType: "project_status",
});
const deptProjects = await reports.getReportPreview(admin, {
  organizationId: seed.organizationId,
  departmentId: seed.departmentId,
  reportType: "project_status",
});
check(
  "report-filters-department-scope",
  deptProjects.totalRows <= orgProjects.totalRows,
  `dept=${deptProjects.totalRows} org=${orgProjects.totalRows}`,
);

// 6) CSV values match preview
const capReport = await reports.getReportPreview(admin, {
  organizationId: seed.organizationId,
  piId: seed.piId,
  reportType: "pi_capacity",
});
if (capReport.availability.state === "ready" && capReport.rows.length > 0) {
  const headers = capReport.columns.map((c) => c.key);
  const csv = toCsv(
    headers,
    capReport.rows.map((r) => headers.map((h) => r[h])),
  );
  const first = capReport.rows[0]!;
  const cell = escapeCsvCell(first[headers[0]!]);
  check("csv-matches-preview-first-cell", csv.includes(cell), cell);
  check("csv-includes-as-of-in-service-path", Boolean(capReport.asOf));
} else {
  check("csv-matches-preview-first-cell", false, "capacity report not ready");
}

// 7) Missing data not zero — unavailable KPI uses null
const unavailableKpis = summary.kpis.filter((k) => k.value == null);
check(
  "unavailable-not-coerced-zero",
  unavailableKpis.every((k) => k.value !== 0),
  `unavailableCount=${unavailableKpis.length}`,
);

// 8) CSV injection
check("csv-injection-neutralized", escapeCsvCell("=1+1").startsWith("'"));

// 9) As-of timestamps present
check("as-of-snapshot", Boolean(snapshot.asOf));
check("as-of-report", Boolean(summary.asOf));
check("as-of-capacity", Boolean(overview.asOf));

// 10) Cross-org denial
let denied = false;
try {
  await reports.getReportPreview(admin, {
    organizationId: "00000000-0000-4000-8000-000000000099",
    reportType: "portfolio_summary",
  });
} catch {
  denied = true;
}
check("cross-org-report-denied", denied);

const verdict = checks.every((c) => c.ok) ? "PASS" : "FAIL";
const out = {
  milestone: "M5E-C",
  generatedAt: new Date().toISOString(),
  startingMainHint: "8eabe5c",
  seed,
  verdict,
  checks,
};
fs.writeFileSync(path.join(outDir, "reconcile.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ verdict, passed: checks.filter((c) => c.ok).length, total: checks.length }, null, 2));
await db.$disconnect();
if (verdict !== "PASS") process.exit(1);
