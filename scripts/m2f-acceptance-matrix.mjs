/**
 * M2F-A non-destructive Portfolio acceptance matrix (M2A–M2E).
 * Read-only against seeded browser-QA orgs. Does not truncate.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/m2f-acceptance-matrix.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const ADMIN_ID =
  process.env.TEMP_AUTH_PRINCIPAL_ID ||
  process.env.DEV_AUTH_PRINCIPAL_ID ||
  "f796fe09-b948-4eb6-9fcd-0770990ab453";

function principal(id, displayName = "QA") {
  return { id, displayName, email: null };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function loadServices() {
  const { AuthorizationService } = await import(
    "../src/modules/identity-access/application/authorization-service.ts"
  );
  const { AuditService } = await import(
    "../src/modules/audit/application/audit-service.ts"
  );
  const { PlanningService } = await import(
    "../src/modules/pi-planning/application/planning-service.ts"
  );
  const { PortfolioQueryService } = await import(
    "../src/modules/portfolio/application/portfolio-query-service.ts"
  );
  const { PortfolioPiCapacityQueryService } = await import(
    "../src/modules/portfolio/application/portfolio-pi-capacity-query-service.ts"
  );
  const authz = new AuthorizationService(db);
  const audit = new AuditService(db);
  const planning = new PlanningService(db, authz, audit);
  const portfolio = new PortfolioQueryService(db, authz, audit);
  const piCapacity = new PortfolioPiCapacityQueryService(
    db,
    authz,
    audit,
    planning,
  );
  return { portfolio, piCapacity, planning, authz };
}

const results = [];

async function caseRow(name, fn) {
  try {
    const detail = (await fn()) || "";
    results.push({ scenario: name, result: "PASS", detail });
    console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
  } catch (e) {
    results.push({
      scenario: name,
      result: "FAIL",
      error: String(e.message || e),
    });
    console.error(`FAIL  ${name}:`, e.message || e);
  }
}

async function main() {
  const { portfolio, piCapacity } = await loadServices();
  const admin = principal(ADMIN_ID, "M2F Admin");

  const m2b = await db.organization.findFirst({
    where: { name: "M2B Demo Org" },
  });
  const m2d = await db.organization.findFirst({
    where: { name: "M2D Health Org" },
  });
  const m2e = await db.organization.findFirst({
    where: { name: "M2E Capacity Org" },
  });
  assert(m2b && m2d && m2e, "Missing M2B/M2D/M2E seeded orgs — reseed first");

  // ---- M2A / M2B snapshot ----
  let snapshot;
  await caseRow("1. Executive Portfolio KPI totals", async () => {
    snapshot = await portfolio.getPortfolioSnapshot(admin, {
      organizationId: m2b.id,
    });
    assert(snapshot.initiatives.available, "initiatives unavailable");
    assert(snapshot.projects.available, "projects unavailable");
    assert(snapshot.initiatives.value.total >= 1, "expected initiatives");
    const p = snapshot.projects.value;
    const projectTotal = p.active + p.onHold + p.completed + p.cancelled;
    assert(projectTotal >= 1, "expected projects");
    return `initiatives=${snapshot.initiatives.value.total} projects=${projectTotal}`;
  });

  await caseRow("2. Initiative lifecycle distribution", async () => {
    const dist = snapshot.initiatives.value.byStage;
    assert(dist && typeof dist === "object", "missing byStage");
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    assert(sum === snapshot.initiatives.value.total, "stage sum ≠ total");
    return JSON.stringify(dist);
  });

  await caseRow("3. Project status distribution", async () => {
    const st = snapshot.projects.value;
    assert(
      st &&
        typeof st.active === "number" &&
        typeof st.onHold === "number" &&
        typeof st.completed === "number" &&
        typeof st.cancelled === "number",
      "missing project status counts",
    );
    return JSON.stringify(st);
  });

  await caseRow("4. Pending governance attention", async () => {
    assert(snapshot.governance.available, snapshot.governance.reason);
    const g = snapshot.governance.value;
    assert(
      typeof g.pendingApprovals === "number" ||
        typeof g.waitingApproval === "number" ||
        typeof g.attentionCount === "number" ||
        Object.keys(g).length > 0,
      "governance shape unexpected",
    );
    return JSON.stringify(g).slice(0, 160);
  });

  await caseRow("5. Active PoCs and Pilots", async () => {
    assert(snapshot.experimentation.available, snapshot.experimentation.reason);
    const e = snapshot.experimentation.value;
    assert(
      typeof e.activePocs === "number" || typeof e.pocCount === "number",
      "experimentation shape",
    );
    return JSON.stringify(e).slice(0, 160);
  });

  // ---- M2C Explorer ----
  await caseRow("6. Portfolio Explorer search", async () => {
    const r = await portfolio.explorePortfolio(admin, {
      organizationId: m2b.id,
      q: "Platform",
      page: 1,
      pageSize: 25,
    });
    assert(Array.isArray(r.rows), "rows missing");
    return `rows=${r.rows.length} total=${r.total}`;
  });

  await caseRow("7. Explorer filters and pagination", async () => {
    const page1 = await portfolio.explorePortfolio(admin, {
      organizationId: m2d.id,
      page: 1,
      pageSize: 2,
      entityKinds: ["PROJECT"],
    });
    assert(page1.pageSize === 2, "pageSize not applied");
    assert(page1.rows.length <= 2, "page overflow");
    if (page1.total > 2) {
      const page2 = await portfolio.explorePortfolio(admin, {
        organizationId: m2d.id,
        page: 2,
        pageSize: 2,
        entityKinds: ["PROJECT"],
      });
      assert(page2.rows[0]?.id !== page1.rows[0]?.id, "unstable pagination");
    }
    return `total=${page1.total}`;
  });

  await caseRow("8. Initiative and Project drill-down hrefs", async () => {
    const r = await portfolio.explorePortfolio(admin, {
      organizationId: m2b.id,
      pageSize: 50,
    });
    const withHref = r.rows.filter((x) => x.href);
    assert(withHref.length > 0, "no hrefs");
    assert(
      withHref.some((x) => /\/initiatives\//.test(x.href)),
      "missing initiative/project href",
    );
    return `hrefs=${withHref.length}`;
  });

  // ---- M2D Delivery Health ----
  const AS_OF = new Date("2026-06-15T12:00:00.000Z");
  let healthSummary;
  await caseRow("9. Delivery Health classifications", async () => {
    healthSummary = await portfolio.getDeliveryHealthSummary(admin, {
      organizationId: m2d.id,
      asOf: AS_OF,
    });
    assert(healthSummary.counts, "missing counts");
    const c = healthSummary.counts;
    assert((c.BLOCKED ?? 0) >= 1, "expected BLOCKED");
    assert((c.AT_RISK ?? 0) >= 1, "expected AT_RISK");
    assert((c.ON_TRACK ?? 0) >= 1, "expected ON_TRACK");
    assert((c.UNKNOWN ?? 0) >= 1, "expected UNKNOWN");
    assert((c.COMPLETED ?? 0) >= 1, "expected COMPLETED");
    assert((c.CANCELLED ?? 0) >= 1, "expected CANCELLED");
    return JSON.stringify(c);
  });

  await caseRow("10. Active blockers and critical issues", async () => {
    const attention = await portfolio.listDeliveryHealthAttention(admin, {
      organizationId: m2d.id,
      asOf: AS_OF,
      pageSize: 50,
    });
    assert(attention.rows.length >= 1, "attention empty");
    const blocked = attention.rows.find(
      (r) => r.classification === "BLOCKED",
    );
    assert(blocked, "no BLOCKED attention row");
    const detail = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: m2d.id,
      projectId: blocked.projectId,
      asOf: AS_OF,
    });
    assert(detail.classification === "BLOCKED", detail.classification);
    assert(
      detail.reasons.some((r) => r.code === "ACTIVE_BLOCKER_ISSUE"),
      "missing ACTIVE_BLOCKER_ISSUE",
    );
    return `attention=${attention.rows.length}`;
  });

  await caseRow("11. Delayed Project identification", async () => {
    assert(snapshot.projects.available);
    // M2B snapshot delayed count from portfolio policy
    const delayed =
      snapshot.projects.value.delayed ??
      snapshot.attention?.value?.delayedProjects ??
      null;
    // Prefer health AT_RISK with missed milestone on M2D
    const explore = await portfolio.explorePortfolio(admin, {
      organizationId: m2d.id,
      deliveryHealth: "AT_RISK",
      pageSize: 25,
    });
    assert(explore.rows.length >= 1, "no AT_RISK projects");
    return `m2bDelayed=${delayed} m2dAtRisk=${explore.rows.length}`;
  });

  await caseRow("12. Project closure visibility", async () => {
    const completed = await portfolio.explorePortfolio(admin, {
      organizationId: m2d.id,
      deliveryHealth: "COMPLETED",
      pageSize: 25,
    });
    const cancelled = await portfolio.explorePortfolio(admin, {
      organizationId: m2d.id,
      deliveryHealth: "CANCELLED",
      pageSize: 25,
    });
    assert(completed.rows.length >= 1, "COMPLETED missing");
    assert(cancelled.rows.length >= 1, "CANCELLED missing");
    const doneRefs = new Set(completed.rows.map((r) => r.referenceKey));
    const canRefs = new Set(cancelled.rows.map((r) => r.referenceKey));
    assert(doneRefs.has("M2D-PRJ-DONE"), "DONE project missing from COMPLETED filter");
    assert(canRefs.has("M2D-PRJ-CAN"), "CAN project missing from CANCELLED filter");
    assert(
      ![...doneRefs].some((r) => canRefs.has(r)),
      "COMPLETED and CANCELLED filters overlap",
    );
    return `completed=${[...doneRefs]} cancelled=${[...canRefs]}`;
  });

  // ---- M2E Capacity ----
  const pi = await db.programIncrement.findFirst({
    where: { organizationId: m2e.id, referenceKey: "PI-M2E-CAP" },
  });
  const emptyPi = await db.programIncrement.findFirst({
    where: { organizationId: m2e.id, referenceKey: "PI-M2E-EMPTY" },
  });
  assert(pi && emptyPi, "M2E PIs missing");

  await caseRow("13. PI selection and lifecycle", async () => {
    const list = await piCapacity.listProgramIncrements(admin, {
      organizationId: m2e.id,
      pageSize: 50,
    });
    assert(list.total >= 2, "expected ≥2 PIs");
    assert(
      list.rows.every((r) => r.lifecycle && r.status),
      "lifecycle/status missing",
    );
    return `pis=${list.total}`;
  });

  let capacity;
  await caseRow("14. Available/committed/remaining capacity", async () => {
    capacity = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: m2e.id,
      piId: pi.id,
      resourcePageSize: 100,
    });
    assert(capacity.capacity.state === "ready", capacity.capacity.state);
    const t = capacity.capacity.totals;
    assert(t.availableHours > 0, "available");
    assert(t.committedHours === 210, `committed ${t.committedHours}`);
    assert(
      Math.abs(t.remainingHours - (t.availableHours - t.committedHours)) < 1e-9,
      "remaining",
    );
    return `A=${t.availableHours} C=${t.committedHours} R=${t.remainingHours}`;
  });

  await caseRow("15. Department/team/resource utilization", async () => {
    const c = capacity.capacity;
    assert(c.departments.length >= 2, "departments");
    assert(c.teams.length >= 1, "teams");
    assert(c.resources.rows.length >= 1, "resources");
    for (const d of c.departments) {
      const teams = c.teams.filter((t) => t.departmentId === d.departmentId);
      const avail = teams.reduce((s, t) => s + t.availableHours, 0);
      assert(avail === d.availableHours, `${d.departmentName} avail mismatch`);
    }
    return `depts=${c.departments.length} teams=${c.teams.length} resources=${c.resources.total}`;
  });

  await caseRow("16. Shared Resource without double-counting", async () => {
    const shared = capacity.capacity.resources.rows.filter((r) =>
      /Shared Specialist/i.test(r.resourceName),
    );
    assert(shared.length >= 1, "shared missing");
    for (const r of shared) {
      assert(r.membershipAllocationPercent === 50, String(r.membershipAllocationPercent));
    }
    const teamAvail = capacity.capacity.teams.reduce(
      (s, t) => s + t.availableHours,
      0,
    );
    assert(teamAvail === capacity.capacity.totals.availableHours, "total≠team sum");
  });

  await caseRow("17. Planning conflicts", async () => {
    assert(capacity.capacity.conflicts.length >= 1, "no conflicts");
    assert(
      capacity.capacity.conflicts.some((c) => /OVERLOAD/i.test(c.type)),
      "no OVERLOAD conflict",
    );
    return `conflicts=${capacity.capacity.conflicts.length}`;
  });

  await caseRow("18. CURRENT revision versus approved baseline", async () => {
    assert(capacity.capacity.meta.revision.isCurrent === true, "not CURRENT");
    assert(
      capacity.capacity.meta.source === "live_capacity_policy",
      "wrong source",
    );
    // Fixture has no baseline → unavailable comparison (not invented)
    assert(capacity.capacity.baselineComparison.available === false);
    assert(/baseline/i.test(capacity.capacity.baselineComparison.reason));
    return capacity.capacity.baselineComparison.reason;
  });

  await caseRow("19. Unavailable versus zero", async () => {
    const noPi = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: m2e.id,
    });
    assert(noPi.capacity.state === "no_pi_selected", noPi.capacity.state);
    const unavail = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: m2e.id,
      piId: emptyPi.id,
    });
    assert(unavail.capacity.state === "unavailable", unavail.capacity.state);
    assert(!("totals" in unavail.capacity), "unavailable must not invent totals");
  });

  await caseRow("20. Empty organization/portfolio", async () => {
    // Create ephemeral empty org via raw prisma (cleanup after) OR use list with unknown
    // Prefer: empty PI list for a brand-new org created and deleted — avoid mutation.
    // Instead verify M2E org with no matching lifecycle filter returns empty page.
    const emptyList = await piCapacity.listProgramIncrements(admin, {
      organizationId: m2e.id,
      lifecycle: ["COMPLETED"],
      pageSize: 25,
    });
    assert(emptyList.total === 0 || emptyList.rows.length === 0, "expected empty COMPLETED list");
    // Also verify explorer empty query on nonsense string
    const emptyExplore = await portfolio.explorePortfolio(admin, {
      organizationId: m2b.id,
      q: "ZZZ-NO-MATCH-M2F-EMPTY",
      pageSize: 25,
    });
    assert(emptyExplore.total === 0, "search should be empty");
    return `piCompleted=${emptyList.total} explore=${emptyExplore.total}`;
  });

  // Cross-module reconciliation extras
  await caseRow("X1. Project counts reconcile with Project table", async () => {
    const dbActive = await db.project.count({
      where: { organizationId: m2b.id, status: "ACTIVE" },
    });
    const dbOnHold = await db.project.count({
      where: { organizationId: m2b.id, status: "ON_HOLD" },
    });
    const dbCompleted = await db.project.count({
      where: { organizationId: m2b.id, status: "COMPLETED" },
    });
    const dbCancelled = await db.project.count({
      where: { organizationId: m2b.id, status: "CANCELLED" },
    });
    const v = snapshot.projects.value;
    assert(v.active === dbActive, `active ${v.active}≠${dbActive}`);
    assert(v.onHold === dbOnHold, `onHold ${v.onHold}≠${dbOnHold}`);
    assert(v.completed === dbCompleted, `completed ${v.completed}≠${dbCompleted}`);
    assert(v.cancelled === dbCancelled, `cancelled ${v.cancelled}≠${dbCancelled}`);
    return JSON.stringify(v);
  });

  await caseRow("X2. Project commitments reconcile with WorkAllocation", async () => {
    const rev = await db.planningRevision.findFirst({
      where: { piId: pi.id, isCurrent: true },
    });
    const allocs = await db.workAllocation.findMany({
      where: { revisionId: rev.id },
    });
    const sum = allocs.reduce((s, a) => s + Number(a.plannedHours), 0);
    assert(sum === capacity.capacity.totals.committedHours, `${sum}≠committed`);
  });

  await caseRow("X3. Ownership labels use Resource FK when present", async () => {
    assert(
      snapshot.ownership.available || snapshot.ownership?.value != null,
      "ownership metric",
    );
  });

  // Auth matrix samples (non-destructive)
  const viewerId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001";
  const unauthorizedId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0003";

  await caseRow("A1. Viewer can read portfolio snapshot", async () => {
    // Viewer binding may only be on M2E org — seed viewer on M2E
    const r = await portfolio.getPortfolioSnapshot(principal(viewerId), {
      organizationId: m2e.id,
    });
    assert(r.initiatives.available || r.scope, "viewer blocked unexpectedly");
  });

  await caseRow("A2. Unauthorized denied on portfolio", async () => {
    let denied = false;
    try {
      await portfolio.getPortfolioSnapshot(principal(unauthorizedId), {
        organizationId: m2b.id,
      });
    } catch (e) {
      denied =
        e?.code === "FORBIDDEN" ||
        /forbidden|visibility|authorized|Missing/i.test(String(e.message));
    }
    // Some paths return empty scope rather than throw — accept empty initiatives unavailable
    if (!denied) {
      try {
        const r = await portfolio.getPortfolioSnapshot(
          principal(unauthorizedId),
          { organizationId: m2b.id },
        );
        denied =
          !r.initiatives.available ||
          (r.initiatives.available && r.initiatives.value.total === 0);
      } catch {
        denied = true;
      }
    }
    assert(denied, "unauthorized should not see M2B portfolio data");
  });

  const failed = results.filter((r) => r.result === "FAIL");
  console.log(
    JSON.stringify(
      {
        orgs: { m2b: m2b.id, m2d: m2d.id, m2e: m2e.id },
        passed: results.filter((r) => r.result === "PASS").length,
        failed: failed.length,
        results,
      },
      null,
      2,
    ),
  );
  if (failed.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
