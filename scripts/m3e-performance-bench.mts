/**
 * M3E performance bench — representative (not production-scale) fixture timings.
 * DB: management_platform_m3e_perf (isolated).
 */
import { randomUUID } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import path from "node:path";
import { PrismaClient, ScopeType } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import type { Principal } from "../src/modules/identity-access/domain/types";
import { OrganizationService } from "../src/modules/organization/application/organization-service";
import { PlanningService } from "../src/modules/pi-planning/application/planning-service";
import { PortfolioPiCapacityQueryService } from "../src/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { resetEnvCacheForTests } from "../src/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL_M3E_PERF ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_m3e_perf?schema=public";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.ALLOW_DEV_AUTH = "false";
// Allow ensureBootstrapBinding (same as vitest integration harness).
process.env.NODE_ENV = "test";
resetEnvCacheForTests();

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const organization = new OrganizationService(db, authz, audit);
const planning = new PlanningService(db, authz, audit);
const piCapacity = new PortfolioPiCapacityQueryService(
  db,
  authz,
  audit,
  planning,
);

function principal(id = randomUUID()): Principal {
  return { id, displayName: "M3E Perf", source: "test" };
}

async function timed<T>(label: string, fn: () => Promise<T>) {
  const t0 = Date.now();
  const result = await fn();
  return { label, ms: Date.now() - t0, result };
}

async function reset() {
  await db.auditEvent.deleteMany();
  await db.workAllocation.deleteMany();
  await db.resourceAvailability.deleteMany();
  await db.planningDependency.deleteMany();
  await db.piBaseline.deleteMany();
  await db.piPlanApproval.deleteMany();
  await db.planningRevision.deleteMany();
  await db.piParticipatingTeam.deleteMany();
  await db.piParticipatingDepartment.deleteMany();
  await db.piIteration.deleteMany();
  await db.programIncrement.deleteMany();
  await db.piReferenceCounter.deleteMany();
  await db.projectWorkItem.deleteMany();
  await db.projectMilestone.deleteMany();
  await db.projectParticipatingDepartment.deleteMany();
  await db.projectClosure.deleteMany();
  await db.project.deleteMany();
  await db.projectReferenceCounter.deleteMany();
  await db.initiative.deleteMany();
  await db.initiativeReferenceCounter.deleteMany();
  await db.roleBinding.deleteMany();
  await db.resourceMembership.deleteMany();
  await db.resource.deleteMany();
  await db.team.deleteMany();
  await db.department.deleteMany();
  await db.section.deleteMany();
  await db.organization.deleteMany();
  await db.bootstrapConsumption.deleteMany();
  await db.externalIdentity.deleteMany();
  await db.principal.deleteMany();
  await db.roleDefinition.deleteMany();
}

async function main() {
  await db.$connect();
  await reset();

  const actor = principal();
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await authz.ensureBootstrapBinding(actor.id);

  const timings: { label: string; ms: number }[] = [];
  const fixture = {
    pis: 3,
    scenariosPerPi: 4,
    workItems: 200,
    departments: 3,
    teamsPerDept: 2,
    resources: 12,
    iterations: 4,
    allocationsPerScenario: 80,
  };

  const org = await organization.createOrganization(actor, {
    name: "M3E Perf Org",
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section",
  });

  const depts = [];
  const teams = [];
  for (let d = 0; d < fixture.departments; d++) {
    const dept = await organization.createDepartment(actor, {
      sectionId: section.id,
      name: `Dept ${d + 1}`,
    });
    depts.push(dept);
    for (let t = 0; t < fixture.teamsPerDept; t++) {
      teams.push(
        await organization.createTeam(actor, {
          departmentId: dept.id,
          name: `Team ${d + 1}-${t + 1}`,
        }),
      );
    }
  }

  const resources = [];
  for (let r = 0; r < fixture.resources; r++) {
    const res = await organization.createResource(actor, {
      organizationId: org.id,
      name: `Res ${r + 1}`,
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });
    await organization.assignMembership(actor, {
      resourceId: res.id,
      teamId: teams[r % teams.length]!.id,
      isPrimary: true,
      allocationPercent: 100,
    });
    resources.push(res);
  }

  const initiative = await db.initiative.create({
    data: {
      organizationId: org.id,
      departmentId: depts[0]!.id,
      referenceKey: `INIT-PERF-${randomUUID().slice(0, 6)}`,
      title: "Perf Initiative",
      requesterName: "R",
      businessOwnerName: "O",
      currentStage: "PROJECT",
      status: "ACTIVE",
    },
  });
  const project = await db.project.create({
    data: {
      organizationId: org.id,
      initiativeId: initiative.id,
      departmentId: depts[0]!.id,
      referenceKey: `PRJ-PERF-${randomUUID().slice(0, 6)}`,
      name: "Perf Project",
      status: "ACTIVE",
    },
  });

  const workItems = [];
  for (let i = 0; i < fixture.workItems; i++) {
    workItems.push(
      await db.projectWorkItem.create({
        data: {
          projectId: project.id,
          type: "TASK",
          referenceKey: `WI-${String(i).padStart(4, "0")}`,
          title: `Work ${i}`,
          status: "BACKLOG",
          estimateHours: "8",
        },
      }),
    );
  }

  const start = new Date("2026-01-01T00:00:00.000Z");
  const end = new Date("2026-03-31T00:00:00.000Z");
  const pi = await planning.createProgramIncrement(actor, {
    organizationId: org.id,
    sectionId: section.id,
    name: "M3E Perf PI-1",
    startDate: start,
    endDate: end,
  });

  const iterations = [];
  for (let i = 0; i < fixture.iterations; i++) {
    const s = new Date(start);
    s.setUTCDate(s.getUTCDate() + i * 14);
    const e = new Date(s);
    e.setUTCDate(e.getUTCDate() + 13);
    iterations.push(
      await planning.createIteration(actor, {
        piId: pi.id,
        name: `IT${i + 1}`,
        sequence: i + 1,
        startDate: s,
        endDate: e,
      }),
    );
  }

  await planning.setParticipatingDepartments(actor, {
    piId: pi.id,
    departments: depts.map((d) => ({ departmentId: d.id })),
  });
  await planning.setParticipatingTeams(actor, {
    piId: pi.id,
    teams: teams.map((t, idx) => ({
      teamId: t.id,
      departmentId: depts[Math.floor(idx / fixture.teamsPerDept)]!.id,
    })),
  });

  // Seed CURRENT allocations
  const current = await planning.pi.requireCurrentRevision(pi.id);
  for (let i = 0; i < fixture.allocationsPerScenario; i++) {
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[i]!.id,
      iterationId: iterations[i % iterations.length]!.id,
      teamId: teams[i % teams.length]!.id,
      plannedHours: "8",
    });
  }

  // Create scenarios + clone
  const createTimed = await timed("scenario.createFromCurrent", async () =>
    planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario A",
    }),
  );
  timings.push({ label: createTimed.label, ms: createTimed.ms });
  const scenarioA = createTimed.result;

  const cloneTimed = await timed("scenario.clone", async () =>
    planning.cloneScenario(actor, {
      revisionId: scenarioA.id,
      label: "Scenario B",
      expectedVersion: scenarioA.version,
    }),
  );
  timings.push({ label: cloneTimed.label, ms: cloneTimed.ms });
  let scenarioB = cloneTimed.result;

  // Extra scenarios for volume
  for (let s = 0; s < fixture.scenariosPerPi - 2; s++) {
    const t = await timed(`scenario.clone.extra.${s}`, async () =>
      planning.cloneScenario(actor, {
        revisionId: scenarioA.id,
        label: `Scenario X${s}`,
        expectedVersion: (
          await db.planningRevision.findUniqueOrThrow({
            where: { id: scenarioA.id },
          })
        ).version,
      }),
    );
    timings.push({ label: t.label, ms: t.ms });
  }

  // Edit B — change 20 allocations
  const editTimed = await timed("scenario.edit.20allocs", async () => {
    const rows = await db.workAllocation.findMany({
      where: { revisionId: scenarioB.id },
      take: 20,
      orderBy: { workItemId: "asc" },
    });
    for (const row of rows) {
      await planning.allocateWork(actor, {
        piId: pi.id,
        revisionId: scenarioB.id,
        workItemId: row.workItemId,
        iterationId: row.iterationId,
        teamId: row.teamId,
        plannedHours: "12",
        expectedVersion: row.version,
      });
    }
    scenarioB = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioB.id },
    });
  });
  timings.push({ label: editTimed.label, ms: editTimed.ms });

  const compareTimed = await timed("scenario.compare.3way", async () =>
    planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [current.id, scenarioA.id, scenarioB.id],
      referenceRevisionId: current.id,
    }),
  );
  timings.push({ label: compareTimed.label, ms: compareTimed.ms });

  let piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: pi.id },
  });
  const selectTimed = await timed("scenario.select", async () =>
    planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: scenarioB.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: scenarioB.version,
    }),
  );
  timings.push({ label: selectTimed.label, ms: selectTimed.ms });

  const readinessTimed = await timed("scenario.readiness", async () =>
    planning.evaluateScenarioReadiness(actor, { piId: pi.id }),
  );
  timings.push({ label: readinessTimed.label, ms: readinessTimed.ms });

  piRow = await planning.transitionStatus(actor, {
    piId: pi.id,
    toStatus: "PLANNING",
    expectedVersion: (
      await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } })
    ).version,
  });
  await planning.transitionStatus(actor, {
    piId: pi.id,
    toStatus: "REVIEW",
    expectedVersion: piRow.version,
  });

  piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
  const sel = await db.planningRevision.findUniqueOrThrow({
    where: { id: scenarioB.id },
  });
  const cur = await planning.pi.requireCurrentRevision(pi.id);
  const promoteTimed = await timed("scenario.promote", async () =>
    planning.promoteSelectedScenario(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedSelectedRevisionId: sel.id,
      expectedSelectedRevisionVersion: sel.version,
      expectedCurrentRevisionVersion: cur.version,
      acknowledgeWarnings: true,
    }),
  );
  timings.push({ label: promoteTimed.label, ms: promoteTimed.ms });

  piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
  const cur2 = await planning.pi.requireCurrentRevision(pi.id);
  const approveTimed = await timed("plan.approve", async () =>
    planning.approveCurrentPlan(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: cur2.version,
      acknowledgeWarnings: true,
    }),
  );
  timings.push({ label: approveTimed.label, ms: approveTimed.ms });

  piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
  const cur3 = await planning.pi.requireCurrentRevision(pi.id);
  const baselineTimed = await timed("plan.baseline", async () =>
    planning.createBaseline(actor, {
      piId: pi.id,
      label: "m3e-perf",
      expectedApprovalId: approveTimed.result.approvalId,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: cur3.version,
    }),
  );
  timings.push({ label: baselineTimed.label, ms: baselineTimed.ms });

  const portfolioTimed = await timed("portfolio.piCapacity", async () =>
    piCapacity.getPiCapacityOverview(actor, {
      organizationId: org.id,
      piId: pi.id,
    }),
  );
  timings.push({ label: portfolioTimed.label, ms: portfolioTimed.ms });

  // Extra PIs (lightweight) for multi-PI volume note
  for (let p = 0; p < fixture.pis - 1; p++) {
    await planning.createProgramIncrement(actor, {
      organizationId: org.id,
      sectionId: section.id,
      name: `M3E Perf PI-${p + 2}`,
      startDate: start,
      endDate: end,
    });
  }

  const allocCount = await db.workAllocation.count();
  const revCount = await db.planningRevision.count();
  const out = {
    generatedAt: new Date().toISOString(),
    fixture,
    observed: {
      workAllocations: allocCount,
      planningRevisions: revCount,
      programIncrements: await db.programIncrement.count(),
    },
    timings,
    disclaimer:
      "Representative fixture only — not production-scale or million-row evidence.",
  };

  const outDir = path.join(process.cwd(), "artifacts/m3e-acceptance");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "performance-bench.json"),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
