/**
 * Non-destructive M2E-C scenario matrix against seeded browser-QA fixtures.
 * Does not truncate or mutate capacity fixtures (read-only queries only).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/m2e-qa-matrix.mjs
 *   DATABASE_URL=... DIRECT_URL=... node scripts/m2e-qa-matrix.mjs
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "crypto";

const db = new PrismaClient();

function principal(id, displayName) {
  return { id, displayName, email: null };
}

async function loadServices() {
  // Dynamic import after DATABASE_URL is set so Prisma singleton sees it.
  const { AuthorizationService } = await import(
    "../src/modules/identity-access/application/authorization-service.ts"
  );
  const { AuditService } = await import(
    "../src/modules/audit/application/audit-service.ts"
  );
  const { PlanningService } = await import(
    "../src/modules/pi-planning/application/planning-service.ts"
  );
  const { PortfolioPiCapacityQueryService } = await import(
    "../src/modules/portfolio/application/portfolio-pi-capacity-query-service.ts"
  );
  const authz = new AuthorizationService(db);
  const audit = new AuditService(db);
  const planning = new PlanningService(db, authz, audit);
  const piCapacity = new PortfolioPiCapacityQueryService(
    db,
    authz,
    audit,
    planning,
  );
  return { piCapacity, planning };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const org = await db.organization.findFirst({
    where: { name: "M2E Capacity Org" },
  });
  assert(org, "M2E Capacity Org missing — run seed-m2e-capacity-ui.mjs first");

  const pi = await db.programIncrement.findFirst({
    where: { organizationId: org.id, referenceKey: "PI-M2E-CAP" },
  });
  const emptyPi = await db.programIncrement.findFirst({
    where: { organizationId: org.id, referenceKey: "PI-M2E-EMPTY" },
  });
  assert(pi && emptyPi, "Expected PI-M2E-CAP and PI-M2E-EMPTY fixtures");

  const deptA = await db.department.findFirst({
    where: { name: "Asset Management", section: { organizationId: org.id } },
  });
  const deptB = await db.department.findFirst({
    where: { name: "Reliability", section: { organizationId: org.id } },
  });

  const adminId =
    process.env.TEMP_AUTH_PRINCIPAL_ID ||
    process.env.DEV_AUTH_PRINCIPAL_ID ||
    "f796fe09-b948-4eb6-9fcd-0770990ab453";
  const viewerId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001";
  const deptMgrId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002";
  const unauthorizedId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0003";

  const { piCapacity } = await loadServices();
  const results = [];

  async function caseRow(name, fn) {
    try {
      await fn();
      results.push({ scenario: name, result: "PASS" });
      console.log(`PASS  ${name}`);
    } catch (e) {
      results.push({ scenario: name, result: "FAIL", error: String(e.message || e) });
      console.error(`FAIL  ${name}:`, e.message || e);
    }
  }

  await caseRow("No PI → no_pi_selected", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
    });
    assert(r.capacity.state === "no_pi_selected", `got ${r.capacity.state}`);
  });

  await caseRow("No participating teams → unavailable", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
      piId: emptyPi.id,
    });
    assert(r.capacity.state === "unavailable", `got ${r.capacity.state}`);
    assert(
      /participating teams/i.test(r.capacity.reason),
      r.capacity.reason,
    );
  });

  await caseRow("Valid ready capacity + multi-project commitments", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
      piId: pi.id,
      resourcePageSize: 100,
    });
    assert(r.capacity.state === "ready", `got ${r.capacity.state}`);
    const c = r.capacity;
    assert(c.totals.availableHours > 0, "available must be > 0");
    assert(c.totals.committedHours === 210, `committed ${c.totals.committedHours}`);
    assert(
      Math.abs(
        c.totals.remainingHours -
          (c.totals.availableHours - c.totals.committedHours),
      ) < 1e-9,
      "remaining != available-committed",
    );
    if (c.totals.utilization != null) {
      assert(
        Math.abs(
          c.totals.utilization -
            c.totals.committedHours / c.totals.availableHours,
        ) < 1e-9,
        "utilization inconsistent",
      );
    }
    const projSum = c.projectCommitments.reduce(
      (s, p) => s + p.committedHours,
      0,
    );
    assert(projSum === c.totals.committedHours, `projects ${projSum} != totals`);
    assert(c.projectCommitments.length >= 2, "need ≥2 projects");
    assert(c.meta.revision.isCurrent === true, "must be CURRENT");
    assert(c.meta.source === "live_capacity_policy", "source");
  });

  await caseRow("Shared resource membership not double-counted in totals", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
      piId: pi.id,
      resourcePageSize: 100,
    });
    assert(r.capacity.state === "ready");
    const shared = r.capacity.resources.rows.filter((x) =>
      /Shared Specialist/i.test(x.resourceName),
    );
    assert(shared.length >= 1, "shared resource rows missing");
    // Membership % is 50 on each team — not project commitment.
    for (const row of shared) {
      assert(row.membershipAllocationPercent === 50, String(row.membershipAllocationPercent));
    }
    // Totals come from team-iteration capacity views, not sum(resource rows).
    const teamAvail = r.capacity.teams.reduce((s, t) => s + t.availableHours, 0);
    assert(teamAvail === r.capacity.totals.availableHours, "totals must equal team sum");
  });

  await caseRow("Overloaded + underutilized teams + conflicts", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
      piId: pi.id,
    });
    assert(r.capacity.state === "ready");
    assert(r.capacity.overloadedTeams.length >= 1, "expected overload");
    assert(r.capacity.underutilizedTeams.length >= 1, "expected under");
    assert(r.capacity.conflicts.length >= 1, "expected conflicts");
    assert(
      r.capacity.conflicts.some((c) => /OVERLOAD/i.test(c.type)),
      "conflict engine overload missing",
    );
  });

  await caseRow("Baseline unavailable (no approved baseline) is explicit", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
      piId: pi.id,
    });
    assert(r.capacity.state === "ready");
    assert(r.capacity.baselineComparison.available === false);
    assert(/baseline/i.test(r.capacity.baselineComparison.reason));
  });

  await caseRow("Department filter isolates sibling departments", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
      piId: pi.id,
      departmentId: deptA.id,
      resourcePageSize: 100,
    });
    assert(r.capacity.state === "ready", `got ${r.capacity.state}`);
    assert(
      r.capacity.departments.every((d) => d.departmentId === deptA.id),
      "sibling department leaked via filter",
    );
    assert(
      r.capacity.teams.every((t) => t.departmentId === deptA.id),
      "sibling team leaked",
    );
  });

  await caseRow(
    "Department manager without SECTION PI_VIEW denied on section-scoped PI",
    async () => {
      let denied = false;
      try {
        await piCapacity.getPiCapacityOverview(principal(deptMgrId), {
          organizationId: org.id,
          piId: pi.id,
        });
      } catch (e) {
        denied =
          e?.code === "FORBIDDEN" ||
          /Missing PI view permission/i.test(String(e.message));
      }
      assert(denied, "dept manager must not view section-scoped PI without SECTION PI_VIEW");
    },
  );

  await caseRow("Viewer can read capacity (read-only path)", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(viewerId), {
      organizationId: org.id,
      piId: pi.id,
    });
    assert(r.capacity.state === "ready", `got ${r.capacity.state}`);
    assert(r.capacity.totals.committedHours === 210);
  });

  await caseRow("Unauthorized principal denied", async () => {
    let denied = false;
    try {
      await piCapacity.getPiCapacityOverview(principal(unauthorizedId), {
        organizationId: org.id,
        piId: pi.id,
      });
    } catch (e) {
      denied =
        e?.code === "FORBIDDEN" ||
        /forbidden|Missing|not authorized|visibility/i.test(String(e.message));
    }
    assert(denied, "unauthorized should be denied");
  });

  await caseRow("Resource pagination bounds + stable ordering", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
      piId: pi.id,
      resourcePage: 1,
      resourcePageSize: 2,
    });
    assert(r.capacity.state === "ready");
    assert(r.capacity.resources.pageSize === 2);
    assert(r.capacity.resources.rows.length <= 2);
    assert(r.capacity.resources.total >= r.capacity.resources.rows.length);
    const names = r.capacity.resources.rows.map((x) => x.resourceName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert(JSON.stringify(names) === JSON.stringify(sorted), "unstable resource order");
  });

  await caseRow("Department hours reconcile with team roll-up", async () => {
    const r = await piCapacity.getPiCapacityOverview(principal(adminId), {
      organizationId: org.id,
      piId: pi.id,
    });
    assert(r.capacity.state === "ready");
    for (const d of r.capacity.departments) {
      const teams = r.capacity.teams.filter((t) => t.departmentId === d.departmentId);
      const avail = teams.reduce((s, t) => s + t.availableHours, 0);
      const committed = teams.reduce((s, t) => s + t.committedHours, 0);
      assert(avail === d.availableHours, `${d.departmentName} avail mismatch`);
      assert(committed === d.committedHours, `${d.departmentName} committed mismatch`);
    }
  });

  const failed = results.filter((r) => r.result === "FAIL");
  console.log(
    JSON.stringify(
      {
        organizationId: org.id,
        piId: pi.id,
        unavailablePiId: emptyPi.id,
        departmentAId: deptA?.id,
        departmentBId: deptB?.id,
        passed: results.filter((r) => r.result === "PASS").length,
        failed: failed.length,
        results,
        fingerprint: createHash("sha256")
          .update(JSON.stringify(results))
          .digest("hex")
          .slice(0, 12),
        runId: randomUUID(),
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
