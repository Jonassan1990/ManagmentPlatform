/**
 * M3C-C — Acceptance isolation evidence (read-only compare must not mutate).
 * Uses dedicated DB management_platform_m3c_int (same as M3C integration tests).
 * Non-destructive relative to production QA DB — wipes only the dedicated int DB.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, ScopeType } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import type { Principal } from "../src/modules/identity-access/domain/types";
import { OrganizationService } from "../src/modules/organization/application/organization-service";
import { PlanningService } from "../src/modules/pi-planning/application/planning-service";
import { PortfolioPiCapacityQueryService } from "../src/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { ROLE_KEYS } from "../src/modules/shared/permissions";
import { resetEnvCacheForTests } from "../src/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL_M3C ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_m3c_int?schema=public";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.ALLOW_DEV_AUTH = "false";
process.env.NODE_ENV = "test";
resetEnvCacheForTests();

const OUT = path.join(process.cwd(), "artifacts/m3cc-acceptance/isolation-evidence.json");

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const organization = new OrganizationService(db, authz, audit);
const planning = new PlanningService(db, authz, audit);
const piCapacity = new PortfolioPiCapacityQueryService(db, authz, audit, planning);

function principal(id = randomUUID()): Principal {
  return { id, displayName: "M3C-C Acceptance", source: "test" };
}

async function fingerprintPlanningState() {
  const [allocations, revisions, baselines] = await Promise.all([
    db.workAllocation.findMany({ orderBy: { id: "asc" } }),
    db.planningRevision.findMany({ orderBy: { id: "asc" } }),
    db.piBaseline.findMany({ orderBy: { id: "asc" } }),
  ]);
  const payload = JSON.stringify({ allocations, revisions, baselines });
  return {
    allocationCount: allocations.length,
    revisionCount: revisions.length,
    baselineCount: baselines.length,
    sha256: createHash("sha256").update(payload).digest("hex"),
    allocationsByRevision: Object.fromEntries(
      [...new Set(allocations.map((a) => a.revisionId))].map((rid) => [
        rid,
        allocations
          .filter((a) => a.revisionId === rid)
          .map((a) => ({
            id: a.id,
            workItemId: a.workItemId,
            plannedHours: String(a.plannedHours),
            iterationId: a.iterationId,
            teamId: a.teamId,
          })),
      ]),
    ),
    baselines: baselines.map((b) => ({
      id: b.id,
      label: b.label,
      payloadHash: createHash("sha256")
        .update(JSON.stringify(b.payload))
        .digest("hex"),
    })),
  };
}

async function resetDb() {
  await db.auditEvent.deleteMany();
  await db.workAllocation.deleteMany();
  await db.resourceAvailability.deleteMany();
  await db.planningDependency.deleteMany();
  await db.piBaseline.deleteMany();
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
  await resetDb();

  const actor = principal();
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await authz.ensureBootstrapBinding(actor.id);

  const org = await organization.createOrganization(actor, { name: "M3C-C Org" });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section",
  });
  const dept = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept",
  });
  const team = await organization.createTeam(actor, {
    departmentId: dept.id,
    name: "Team A",
  });
  const resource = await organization.createResource(actor, {
    organizationId: org.id,
    name: "Dev",
    type: "PERSON",
    capacityHoursPerWeek: 40,
  });
  await organization.assignMembership(actor, {
    resourceId: resource.id,
    teamId: team.id,
    isPrimary: true,
    allocationPercent: 100,
  });

  const PI_START = new Date("2026-04-01T00:00:00.000Z");
  const PI_END = new Date("2026-06-30T00:00:00.000Z");
  let pi = await planning.createProgramIncrement(actor, {
    organizationId: org.id,
    sectionId: section.id,
    name: "M3C-C Isolation PI",
    startDate: PI_START,
    endDate: PI_END,
  });
  const it1 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "It1",
    sequence: 1,
    startDate: PI_START,
    endDate: new Date("2026-04-14T00:00:00.000Z"),
  });
  pi = await planning.setParticipatingDepartments(actor, {
    piId: pi.id,
    departments: [{ departmentId: dept.id }],
  });
  pi = await planning.setParticipatingTeams(actor, {
    piId: pi.id,
    teams: [{ teamId: team.id, departmentId: dept.id }],
  });

  const initiative = await db.initiative.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      referenceKey: `INIT-${randomUUID().slice(0, 8)}`,
      title: "Iso",
      requesterName: "R",
      businessOwnerName: "O",
      currentStage: "PROJECT",
      status: "ACTIVE",
    },
  });
  const project = await db.project.create({
    data: {
      initiativeId: initiative.id,
      organizationId: org.id,
      departmentId: dept.id,
      referenceKey: `PRJ-${randomUUID().slice(0, 8)}`,
      name: "Iso Project",
      status: "ACTIVE",
    },
  });
  const wi1 = await db.projectWorkItem.create({
    data: {
      projectId: project.id,
      type: "TASK",
      referenceKey: "WI-001",
      title: "Alpha",
      status: "BACKLOG",
      estimateHours: "16",
    },
  });
  const wi2 = await db.projectWorkItem.create({
    data: {
      projectId: project.id,
      type: "TASK",
      referenceKey: "WI-002",
      title: "Beta",
      status: "BACKLOG",
      estimateHours: "8",
    },
  });

  await planning.allocateWork(actor, {
    piId: pi.id,
    workItemId: wi1.id,
    iterationId: it1.id,
    teamId: team.id,
    plannedHours: "16",
  });

  const current = await planning.pi.requireCurrentRevision(pi.id);
  const scenarioA = await planning.createScenarioFromCurrent(actor, {
    piId: pi.id,
    label: "Scenario A",
  });
  const scenarioB = await planning.createScenarioFromCurrent(actor, {
    piId: pi.id,
    label: "Scenario B",
  });

  // Differ Scenario B only
  await planning.allocateWork(actor, {
    piId: pi.id,
    revisionId: scenarioB.id,
    workItemId: wi1.id,
    iterationId: it1.id,
    teamId: team.id,
    plannedHours: "24",
  });
  await planning.allocateWork(actor, {
    piId: pi.id,
    revisionId: scenarioB.id,
    workItemId: wi2.id,
    iterationId: it1.id,
    teamId: team.id,
    plannedHours: "8",
  });

  pi = await planning.transitionStatus(actor, {
    piId: pi.id,
    toStatus: "PLANNING",
    expectedVersion: pi.version,
  });
  pi = await planning.transitionStatus(actor, {
    piId: pi.id,
    toStatus: "REVIEW",
    expectedVersion: pi.version,
  });
  const baseline = await planning.createBaseline(actor, {
    piId: pi.id,
    label: "pre-compare",
  });

  const before = await fingerprintPlanningState();

  const cmpCurrentA = await planning.compareScenarios(actor, {
    piId: pi.id,
    revisionIds: [current.id, scenarioA.id],
    referenceRevisionId: current.id,
  });
  const cmpThree = await planning.compareScenarios(actor, {
    piId: pi.id,
    revisionIds: [current.id, scenarioA.id, scenarioB.id],
    referenceRevisionId: current.id,
  });
  const cmpAB = await planning.compareScenarios(actor, {
    piId: pi.id,
    revisionIds: [scenarioA.id, scenarioB.id],
    referenceRevisionId: scenarioA.id,
  });

  const afterCompare = await fingerprintPlanningState();

  // Edit Scenario B again — CURRENT and A must stay fixed
  const beforeEdit = await fingerprintPlanningState();
  await planning.allocateWork(actor, {
    piId: pi.id,
    revisionId: scenarioB.id,
    workItemId: wi1.id,
    iterationId: it1.id,
    teamId: team.id,
    plannedHours: "30",
  });
  const afterEditB = await fingerprintPlanningState();

  const currentAllocsBefore = beforeEdit.allocationsByRevision[current.id];
  const aAllocsBefore = beforeEdit.allocationsByRevision[scenarioA.id];
  const currentAllocsAfter = afterEditB.allocationsByRevision[current.id];
  const aAllocsAfter = afterEditB.allocationsByRevision[scenarioA.id];

  const overview = await piCapacity.getPiCapacityOverview(actor, {
    organizationId: org.id,
    piId: pi.id,
  });

  // Auth checks
  const stranger = principal();
  await db.principal.create({
    data: { id: stranger.id, displayName: "Stranger" },
  });
  let crossOrgDenied = false;
  try {
    await planning.compareScenarios(stranger, {
      piId: pi.id,
      revisionIds: [current.id, scenarioA.id],
    });
  } catch {
    crossOrgDenied = true;
  }

  const viewer = principal();
  await db.principal.create({
    data: { id: viewer.id, displayName: "Viewer" },
  });
  await authz.ensureSystemRoles();
  const role = await db.roleDefinition.findUniqueOrThrow({
    where: { key: ROLE_KEYS.VIEWER },
  });
  await authz.assignRoleBinding(actor, {
    principalId: viewer.id,
    roleDefinitionId: role.id,
    scopeType: ScopeType.ORGANIZATION,
    organizationId: org.id,
  });
  const viewerCmp = await planning.compareScenarios(viewer, {
    piId: pi.id,
    revisionIds: [current.id, scenarioA.id],
  });

  const evidence = {
    generatedAt: new Date().toISOString(),
    databaseUrlHost: new URL(
      process.env.DATABASE_URL!.replace(/^postgresql/, "http"),
    ).host,
    databaseName: "management_platform_m3c_int",
    revisions: {
      currentId: current.id,
      scenarioAId: scenarioA.id,
      scenarioBId: scenarioB.id,
      baselineId: baseline.id,
    },
    isolation: {
      compareDidNotMutate:
        before.sha256 === afterCompare.sha256 &&
        before.allocationCount === afterCompare.allocationCount &&
        before.revisionCount === afterCompare.revisionCount &&
        before.baselineCount === afterCompare.baselineCount,
      beforeSha256: before.sha256,
      afterCompareSha256: afterCompare.sha256,
      baselinePayloadUnchanged:
        before.baselines[0]?.payloadHash === afterCompare.baselines[0]?.payloadHash,
    },
    editScenarioBIsolation: {
      currentUnchanged:
        JSON.stringify(currentAllocsBefore) === JSON.stringify(currentAllocsAfter),
      scenarioAUnchanged:
        JSON.stringify(aAllocsBefore) === JSON.stringify(aAllocsAfter),
      scenarioBHoursAfterEdit: afterEditB.allocationsByRevision[scenarioB.id]?.find(
        (a) => a.workItemId === wi1.id,
      )?.plannedHours,
    },
    comparisonSamples: {
      currentVsA: {
        committed: cmpCurrentA.totals.map((t) => t.metrics.committedHours),
        utilizationPercent: cmpCurrentA.totals.map(
          (t) => t.metrics.utilizationPercent,
        ),
      },
      threeWay: {
        committed: cmpThree.totals.map((t) => t.metrics.committedHours),
        added: cmpThree.allocationChanges.added.length,
        removed: cmpThree.allocationChanges.removed.length,
        changed: cmpThree.allocationChanges.changed.length,
      },
      aVsB: {
        committed: cmpAB.totals.map((t) => t.metrics.committedHours),
        projectDeltas: cmpAB.byProject.map((p) => ({
          project: p.projectName,
          deltas: p.deltaFromReferenceHours,
        })),
      },
    },
    portfolio: {
      state: overview.capacity.state,
      isCurrent:
        overview.capacity.state === "ready"
          ? overview.capacity.meta.revision.isCurrent
          : null,
      committedHours:
        overview.capacity.state === "ready"
          ? overview.capacity.totals.committedHours
          : null,
      note: "Portfolio must remain CURRENT-only (16h from CURRENT, not Scenario B 30/38h)",
    },
    authorization: {
      crossOrgDenied,
      viewerCompareTotals: viewerCmp.totals.length,
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.isolation.compareDidNotMutate) {
    throw new Error("ISOLATION FAIL: compare mutated planning state");
  }
  if (!evidence.editScenarioBIsolation.currentUnchanged) {
    throw new Error("ISOLATION FAIL: editing B mutated CURRENT");
  }
  if (!evidence.editScenarioBIsolation.scenarioAUnchanged) {
    throw new Error("ISOLATION FAIL: editing B mutated Scenario A");
  }
  if (!evidence.authorization.crossOrgDenied) {
    throw new Error("AUTH FAIL: cross-org not denied");
  }
  if (
    evidence.portfolio.isCurrent !== true ||
    evidence.portfolio.committedHours !== 16
  ) {
    throw new Error("PORTFOLIO FAIL: not CURRENT-only / wrong hours");
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
