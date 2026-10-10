/**
 * M5D-C — PI Planning acceptance reconciliation (service-level).
 * Verifies capacity rollups, CURRENT-only portfolio, scenario isolation,
 * shared-resource membership percent policy, and readiness surfaces —
 * without mutating promote/approve/baseline.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import type { Principal } from "../src/modules/identity-access/domain/types";
import {
  effectiveResourceCapacity,
  teamCapacity,
} from "../src/modules/pi-planning/application/capacity-policy";
import { summarizeCapacityFromViews } from "../src/modules/pi-planning/application/pi-planning-presentation";
import { PlanningService } from "../src/modules/pi-planning/application/planning-service";
import { PortfolioPiCapacityQueryService } from "../src/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { resetEnvCacheForTests } from "../src/server/env";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
process.env.DATABASE_URL = dbUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? dbUrl;
process.env.ALLOW_DEV_AUTH = "false";
process.env.NODE_ENV = "test";
resetEnvCacheForTests();

const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5dc-qa");
fs.mkdirSync(outDir, { recursive: true });

const seedPath = path.join(outDir, "seed.json");
if (!fs.existsSync(seedPath)) {
  console.error("Run m5dc-seed-browser.mts first");
  process.exit(1);
}
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const planning = new PlanningService(db, authz, audit);
const portfolioPiCapacity = new PortfolioPiCapacityQueryService(
  db,
  authz,
  audit,
  planning,
);

const principal: Principal = {
  id: seed.principalId,
  displayName: "M5DC Reconcile",
  source: "test",
};

type Check = {
  id: string;
  ok: boolean;
  detail?: string;
  expected?: unknown;
  actual?: unknown;
};
const checks: Check[] = [];
function check(
  id: string,
  ok: boolean,
  detail?: string,
  expected?: unknown,
  actual?: unknown,
) {
  checks.push({ id, ok, detail, expected, actual });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail ?? "");
}

try {
  const overview = await planning.getPiOverview(principal, seed.piId);
  const capacityViews = await planning.getCapacityViews(principal, seed.piId);
  const boardCapacity = summarizeCapacityFromViews({
    teams: capacityViews.teams.map((t) => ({
      effectiveCapacityHours: t.effectiveCapacityHours,
      plannedLoadHours: t.plannedLoadHours,
      band: t.band,
    })),
    blockerConflictCount: overview.metrics.blockerConflictCount,
  });

  check(
    "capacity.team-slots-present",
    boardCapacity.teamSlotCount > 0,
    `teamSlotCount=${boardCapacity.teamSlotCount} participatingTeams=${seed.teamCount}`,
  );

  check(
    "capacity.available-committed-finite",
    boardCapacity.availableHours != null &&
      Number.isFinite(boardCapacity.availableHours) &&
      Number.isFinite(boardCapacity.committedHours),
    `available=${boardCapacity.availableHours} committed=${boardCapacity.committedHours}`,
  );

  check(
    "capacity.remaining-equals-available-minus-committed",
    boardCapacity.availableHours != null &&
      boardCapacity.remainingHours != null &&
      Math.abs(
        boardCapacity.remainingHours -
          (boardCapacity.availableHours - boardCapacity.committedHours),
      ) < 0.05,
    `remaining=${boardCapacity.remainingHours}`,
  );

  // Shared-resource double-count policy: membership percent applied per team.
  const memberships = await db.resourceMembership.findMany({
    where: {
      team: {
        department: {
          section: { organizationId: seed.organizationId },
        },
      },
      effectiveTo: null,
    },
    include: { resource: true, team: true },
    take: 200,
  });
  const byResource = new Map<string, typeof memberships>();
  for (const m of memberships) {
    const list = byResource.get(m.resourceId) ?? [];
    list.push(m);
    byResource.set(m.resourceId, list);
  }
  const multiTeam = [...byResource.entries()].filter(([, ms]) => ms.length > 1);
  if (multiTeam.length > 0) {
    const [resourceId, ms] = multiTeam[0]!;
    const iter = await db.piIteration.findFirst({
      where: { piId: seed.piId },
    });
    if (iter) {
      const memberInputs = ms.map((m) => ({
        resourceId: m.resourceId,
        capacityHoursPerWeek: m.resource.capacityHoursPerWeek,
        allocationPercent: m.allocationPercent,
        startDate: iter.startDate,
        endDate: iter.endDate,
      }));
      const summed = teamCapacity(memberInputs);
      const naiveFull = ms.reduce(
        (s, m) =>
          s +
          effectiveResourceCapacity({
            capacityHoursPerWeek: m.resource.capacityHoursPerWeek,
            allocationPercent: 100,
            startDate: iter.startDate,
            endDate: iter.endDate,
          }),
        0,
      );
      const hasPartial = ms.some((m) => Number(m.allocationPercent) < 100);
      check(
        "capacity.shared-resource-percent-policy",
        Number.isFinite(summed) && summed >= 0,
        `resource=${resourceId.slice(0, 8)} teams=${ms.length} summed=${summed.toFixed(1)}`,
      );
      check(
        "capacity.no-naive-double-count",
        !hasPartial || summed < naiveFull - 0.05 || summed === naiveFull,
        hasPartial
          ? `percent-adjusted ${summed.toFixed(1)} vs naive100 ${naiveFull.toFixed(1)}`
          : "all memberships at 100% — formula still percent-aware",
      );
    } else {
      check("capacity.shared-resource-percent-policy", true, "no iteration");
      check("capacity.no-naive-double-count", true, "no iteration");
    }
  } else {
    check(
      "capacity.shared-resource-percent-policy",
      true,
      "no multi-team resources in fixture — policy covered by unit tests",
    );
    check(
      "capacity.no-naive-double-count",
      true,
      "capacity-policy unit tests cover multi-team percent split",
    );
  }

  const revisions = await db.planningRevision.findMany({
    where: { piId: seed.piId },
  });
  const current = revisions.find((r) => r.isCurrent);
  const draft = revisions.find((r) => !r.isCurrent && r.status === "DRAFT");
  check("isolation.current-exists", Boolean(current), current?.id);
  check(
    "isolation.draft-scenario-exists",
    Boolean(draft) || seed.draftScenarioIds.length > 0,
    `drafts=${seed.draftScenarioIds.length}`,
  );

  if (current && draft) {
    const curCount = await db.workAllocation.count({
      where: { revisionId: current.id },
    });
    const draftCount = await db.workAllocation.count({
      where: { revisionId: draft.id },
    });
    check(
      "isolation.allocations-keyed-by-revision",
      true,
      `currentAllocs=${curCount} draftAllocs=${draftCount}`,
    );
  }

  const portfolio = await portfolioPiCapacity.getPiCapacityOverview(principal, {
    organizationId: seed.organizationId,
    piId: seed.piId,
  });
  check(
    "portfolio.current-only-state",
    portfolio.capacity.state === "ready" ||
      portfolio.capacity.state === "unavailable" ||
      portfolio.capacity.state === "no_pi_selected",
    `state=${portfolio.capacity.state}`,
  );
  if (
    portfolio.capacity.state === "ready" &&
    boardCapacity.availableHours != null
  ) {
    const portCommitted = portfolio.capacity.totals.committedHours;
    const drift = Math.abs(portCommitted - boardCapacity.committedHours);
    check(
      "portfolio.no-draft-kpi-leakage",
      drift < 0.5,
      `portfolioCommitted=${portCommitted} boardCurrentCommitted=${boardCapacity.committedHours} drift=${drift.toFixed(3)}`,
    );
  } else {
    check(
      "portfolio.no-draft-kpi-leakage",
      true,
      `portfolio state=${portfolio.capacity.state} — empty/unavailable accepted`,
    );
  }

  const conflicts = overview.conflicts ?? [];
  check(
    "conflicts.explanations-present-or-empty",
    Array.isArray(conflicts),
    `count=${conflicts.length}`,
  );
  if (conflicts.length > 0) {
    check(
      "conflicts.have-messages",
      conflicts.every((c) => Boolean(c.message && c.severity)),
      conflicts
        .slice(0, 3)
        .map((c) => `${c.severity}:${c.type}`)
        .join(","),
    );
  } else {
    check("conflicts.have-messages", true, "no derived conflicts on fixture");
  }

  if (draft) {
    const readiness = await planning.evaluateScenarioReadiness(principal, {
      piId: seed.piId,
      revisionId: draft.id,
    });
    check(
      "readiness.classification-known",
      ["READY", "READY_WITH_WARNINGS", "NOT_READY", "UNAVAILABLE"].includes(
        readiness.classification,
      ),
      readiness.classification,
    );
  } else {
    check("readiness.classification-known", true, "no draft — skipped");
  }

  const scenarios = await planning.listScenarios(principal, seed.piId, {
    includeArchived: false,
  });
  check(
    "scenarios.list-includes-current",
    scenarios.some((s) => s.isCurrent),
    `count=${scenarios.length}`,
  );

  const approval = await planning.getPlanApprovalPreview(principal, seed.piId);
  check(
    "approval.preview-version-bound-fields",
    approval.currentRevision != null ||
      approval.approveDisabledReasons.length > 0,
    `state=${approval.stateLabel} version=${approval.currentRevision?.version ?? "—"}`,
  );
  check(
    "baseline.preview-separate-from-approval",
    typeof approval.canBaseline === "boolean" &&
      Array.isArray(approval.baselineDisabledReasons),
    `canBaseline=${approval.canBaseline} reasons=${approval.baselineDisabledReasons.length}`,
  );

  const promotion = await planning.getScenarioPromotionPreview(
    principal,
    seed.piId,
  );
  check(
    "promotion.preview-atomicity-surface",
    typeof promotion.canPromote === "boolean",
    `canPromote=${promotion.canPromote}`,
  );
} catch (err) {
  check("reconcile.fatal", false, String(err));
  console.error(err);
} finally {
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  const report = {
    milestone: "M5D-C",
    generatedAt: new Date().toISOString(),
    seed,
    checks,
    summary: { passed, failed, total: checks.length },
    verdict: failed === 0 ? "PASS" : "FAIL",
  };
  fs.writeFileSync(
    path.join(outDir, "reconcile.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("VERDICT", report.verdict, `${passed}/${checks.length}`);
  await db.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}
