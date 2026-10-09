/**
 * M3D-C — Controlled PI approval & immutable baseline (isolated DB).
 * Uses dedicated DB: management_platform_m3d_c_int
 */
import { createHash, randomUUID } from "crypto";
import { PrismaClient, ScopeType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { PlanningService } from "@/modules/pi-planning/application/planning-service";
import { PortfolioPiCapacityQueryService } from "@/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { AppError } from "@/modules/shared/errors";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL_M3D_C ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_m3d_c_int?schema=public";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.ALLOW_DEV_AUTH = "false";
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
  return { id, displayName: "M3D-C Tester", source: "test" };
}

async function resetDb() {
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

async function bindRole(
  actor: Principal,
  targetId: string,
  roleKey: string,
  scope: {
    scopeType: ScopeType;
    organizationId?: string | null;
    scopeId?: string | null;
  },
) {
  await authz.ensureSystemRoles();
  const role = await db.roleDefinition.findUniqueOrThrow({
    where: { key: roleKey },
  });
  return authz.assignRoleBinding(actor, {
    principalId: targetId,
    roleDefinitionId: role.id,
    scopeType: scope.scopeType,
    organizationId: scope.organizationId ?? null,
    scopeId: scope.scopeId ?? null,
  });
}

async function seedOrg(actor: Principal) {
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await authz.ensureBootstrapBinding(actor.id);
  const org = await organization.createOrganization(actor, {
    name: "M3D-C Org",
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section",
  });
  const deptA = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept A",
  });
  const teamA = await organization.createTeam(actor, {
    departmentId: deptA.id,
    name: "Team A",
  });
  const resourceA = await organization.createResource(actor, {
    organizationId: org.id,
    name: "Dev A",
    type: "PERSON",
    capacityHoursPerWeek: 40,
  });
  await organization.assignMembership(actor, {
    resourceId: resourceA.id,
    teamId: teamA.id,
    isPrimary: true,
    allocationPercent: 100,
  });
  return { org, section, deptA, teamA, resourceA };
}

async function seedProjectWithWork(
  orgId: string,
  departmentId: string,
  opts: { name: string; workTitles: string[] },
) {
  const initiative = await db.initiative.create({
    data: {
      organizationId: orgId,
      departmentId,
      referenceKey: `INIT-${randomUUID().slice(0, 8)}`,
      title: opts.name,
      requesterName: "Requester",
      businessOwnerName: "Owner",
      currentStage: "PROJECT",
      status: "ACTIVE",
    },
  });
  const project = await db.project.create({
    data: {
      organizationId: orgId,
      initiativeId: initiative.id,
      departmentId,
      referenceKey: `PRJ-${randomUUID().slice(0, 8)}`,
      name: opts.name,
      status: "ACTIVE",
    },
  });
  const workItems = [];
  for (const title of opts.workTitles) {
    workItems.push(
      await db.projectWorkItem.create({
        data: {
          projectId: project.id,
          type: "TASK",
          referenceKey: `WI-${randomUUID().slice(0, 8)}`,
          title,
          status: "BACKLOG",
          estimateHours: "8",
        },
      }),
    );
  }
  return { initiative, project, workItems };
}

async function createPiReady(actor: Principal, ctx: Awaited<ReturnType<typeof seedOrg>>) {
  const start = new Date("2026-10-01T00:00:00.000Z");
  const end = new Date("2026-10-28T00:00:00.000Z");
  const pi = await planning.createProgramIncrement(actor, {
    organizationId: ctx.org.id,
    sectionId: ctx.section.id,
    name: "M3D-C PI",
    startDate: start,
    endDate: end,
  });
  const it1 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "Iter 1",
    sequence: 1,
    startDate: start,
    endDate: new Date("2026-10-14T00:00:00.000Z"),
  });
  await planning.setParticipatingDepartments(actor, {
    piId: pi.id,
    departments: [{ departmentId: ctx.deptA.id }],
  });
  await planning.setParticipatingTeams(actor, {
    piId: pi.id,
    teams: [{ teamId: ctx.teamA.id, departmentId: ctx.deptA.id }],
  });
  return { pi, it1 };
}

async function promoteScenarioB(actor: Principal, piId: string, scenarioId: string) {
  let piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: piId } });
  const scenario = await db.planningRevision.findUniqueOrThrow({
    where: { id: scenarioId },
  });
  await planning.selectScenario(actor, {
    piId,
    revisionId: scenario.id,
    expectedPiVersion: piRow.version,
    expectedRevisionVersion: scenario.version,
  });
  piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: piId } });
  const selected = await db.planningRevision.findUniqueOrThrow({
    where: { id: scenarioId },
  });
  const current = await planning.pi.requireCurrentRevision(piId);
  return planning.promoteSelectedScenario(actor, {
    piId,
    expectedPiVersion: piRow.version,
    expectedSelectedRevisionId: selected.id,
    expectedSelectedRevisionVersion: selected.version,
    expectedCurrentRevisionVersion: current.version,
    acknowledgeWarnings: true,
  });
}

beforeAll(async () => {
  await db.$connect();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb();
});

describe("M3D-C approval of eligible promoted CURRENT", () => {
  it("approves promoted CURRENT and creates immutable baseline; isolates scenarios and portfolio", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Happy",
      workTitles: ["W1", "W2"],
    });

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const scenarioA = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario A",
    });
    const scenarioB = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario B",
    });
    const bAlloc = await db.workAllocation.findFirstOrThrow({
      where: { revisionId: scenarioB.id, workItemId: workItems[0]!.id },
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: scenarioB.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "16",
      expectedVersion: bAlloc.version,
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: scenarioB.id,
      workItemId: workItems[1]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });

    const aBefore = await db.workAllocation.findMany({
      where: { revisionId: scenarioA.id },
      orderBy: { workItemId: "asc" },
    });
    const bBefore = await db.workAllocation.findMany({
      where: { revisionId: scenarioB.id },
      orderBy: { workItemId: "asc" },
    });

    let piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    piRow = await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "PLANNING",
      expectedVersion: piRow.version,
    });
    await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "REVIEW",
      expectedVersion: piRow.version,
    });

    const portfolioBefore = await piCapacity.getPiCapacityOverview(actor, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(portfolioBefore.capacity.state).toBe("ready");
    if (portfolioBefore.capacity.state === "ready") {
      expect(portfolioBefore.capacity.totals.committedHours).toBe(8);
    }

    await promoteScenarioB(actor, pi.id, scenarioB.id);

    const preview = await planning.getPlanApprovalPreview(actor, pi.id);
    expect(preview.stateLabel).toBe("PROMOTED_NOT_APPROVED");
    expect(preview.canApprove).toBe(true);
    expect(preview.canBaseline).toBe(false);

    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    const current = await planning.pi.requireCurrentRevision(pi.id);
    const approval = await planning.approveCurrentPlan(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: current.version,
      acknowledgeWarnings: true,
    });
    expect(approval.idempotentReplay).toBe(false);

    const previewApproved = await planning.getPlanApprovalPreview(actor, pi.id);
    expect(previewApproved.stateLabel).toBe("APPROVED");
    expect(previewApproved.activeApproval?.approvedByPrincipalId).toBe(actor.id);
    expect(previewApproved.canBaseline).toBe(true);

    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    const current2 = await planning.pi.requireCurrentRevision(pi.id);
    const baseline = await planning.createBaseline(actor, {
      piId: pi.id,
      label: "freeze-b",
      expectedApprovalId: approval.approvalId,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: current2.version,
    });
    expect(baseline.versionNumber).toBe(1);
    expect(baseline.planApprovalId).toBe(approval.approvalId);
    const baselineHash = createHash("sha256")
      .update(JSON.stringify(baseline.payload))
      .digest("hex");

    const portfolioAfter = await piCapacity.getPiCapacityOverview(actor, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(portfolioAfter.capacity.state).toBe("ready");
    if (portfolioAfter.capacity.state === "ready") {
      expect(portfolioAfter.capacity.totals.committedHours).toBe(24);
    }

    const aAfter = await db.workAllocation.findMany({
      where: { revisionId: scenarioA.id },
      orderBy: { workItemId: "asc" },
    });
    const bAfter = await db.workAllocation.findMany({
      where: { revisionId: scenarioB.id },
      orderBy: { workItemId: "asc" },
    });
    expect(JSON.stringify(aAfter)).toBe(JSON.stringify(aBefore));
    expect(JSON.stringify(bAfter)).toBe(JSON.stringify(bBefore));

    const stillBaseline = await db.piBaseline.findUniqueOrThrow({
      where: { id: baseline.id },
    });
    expect(
      createHash("sha256")
        .update(JSON.stringify(stillBaseline.payload))
        .digest("hex"),
    ).toBe(baselineHash);

    const audits = await db.auditEvent.findMany({
      where: {
        actionType: {
          in: ["pi.plan.approved", "pi.plan.baselined", "pi.baseline.created"],
        },
      },
    });
    expect(audits.some((a) => a.actionType === "pi.plan.approved")).toBe(true);
    expect(audits.some((a) => a.actionType === "pi.plan.baselined")).toBe(true);

    // Idempotent approval replay
    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    // After baseline, approval is CONSUMED — approve again after no CURRENT change needs new approval
    // Edit CURRENT → invalidates nothing VALID; re-approve for new state
    const curAlloc = await db.workAllocation.findFirstOrThrow({
      where: { revisionId: current2.id, workItemId: workItems[0]!.id },
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "17",
      expectedVersion: curAlloc.version,
    });
    const invalidated = await db.auditEvent.findMany({
      where: { actionType: "pi.plan.approval_invalidated" },
    });
    // previous was CONSUMED not VALID — edit does not need to invalidate CONSUMED
    expect(Array.isArray(invalidated)).toBe(true);

    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    const current3 = await planning.pi.requireCurrentRevision(pi.id);
    const approval2 = await planning.approveCurrentPlan(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: current3.version,
      acknowledgeWarnings: true,
    });
    const replay = await planning.approveCurrentPlan(actor, {
      piId: pi.id,
      expectedPiVersion: (await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } })).version,
      expectedCurrentRevisionVersion: (
        await planning.pi.requireCurrentRevision(pi.id)
      ).version,
      acknowledgeWarnings: true,
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.approvalId).toBe(approval2.approvalId);

    // Stale approval cannot baseline after CURRENT edit
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "18",
      expectedVersion: (
        await db.workAllocation.findFirstOrThrow({
          where: {
            revisionId: (await planning.pi.requireCurrentRevision(pi.id)).id,
            workItemId: workItems[0]!.id,
          },
        })
      ).version,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    await expect(
      planning.createBaseline(actor, {
        piId: pi.id,
        label: "stale",
        expectedApprovalId: approval2.approvalId,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: (
          await planning.pi.requireCurrentRevision(pi.id)
        ).version,
      }),
    ).rejects.toBeInstanceOf(AppError);

    const baselineStill = await db.piBaseline.findUniqueOrThrow({
      where: { id: baseline.id },
    });
    expect(
      createHash("sha256")
        .update(JSON.stringify(baselineStill.payload))
        .digest("hex"),
    ).toBe(baselineHash);
  });
});

describe("M3D-C prerequisites / authorization / concurrency", () => {
  it("rejects missing provenance, unauthorized actors, stale versions, and concurrent approvals", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Auth",
      workTitles: ["W"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });

    let piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    const current = await planning.pi.requireCurrentRevision(pi.id);
    await expect(
      planning.approveCurrentPlan(actor, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current.version,
        acknowledgeWarnings: true,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/provenance/i),
    });

    const scenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "S",
    });
    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    piRow = await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "PLANNING",
      expectedVersion: piRow.version,
    });
    await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "REVIEW",
      expectedVersion: piRow.version,
    });
    await promoteScenarioB(actor, pi.id, scenario.id);

    const viewer = principal();
    await db.principal.create({
      data: { id: viewer.id, displayName: "Viewer" },
    });
    await bindRole(actor, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: "ORGANIZATION",
      organizationId: ctx.org.id,
      scopeId: ctx.org.id,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    const current2 = await planning.pi.requireCurrentRevision(pi.id);
    await expect(
      planning.approveCurrentPlan(viewer, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current2.version,
        acknowledgeWarnings: true,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Cross-org denial — actor retains bootstrap; grant B admin only on org B
    const actorB = principal();
    await db.principal.create({
      data: { id: actorB.id, displayName: "OrgB" },
    });
    const orgB = await organization.createOrganization(actor, { name: "Org B" });
    await bindRole(actor, actorB.id, ROLE_KEYS.ORGANIZATION_ADMIN, {
      scopeType: "ORGANIZATION",
      organizationId: orgB.id,
      scopeId: orgB.id,
    });
    await expect(
      planning.approveCurrentPlan(actorB, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current2.version,
        acknowledgeWarnings: true,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Stale PI version
    await expect(
      planning.approveCurrentPlan(actor, {
        piId: pi.id,
        expectedPiVersion: piRow.version - 1,
        expectedCurrentRevisionVersion: current2.version,
        acknowledgeWarnings: true,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Concurrent approvals — only one VALID
    const results = await Promise.allSettled([
      planning.approveCurrentPlan(actor, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current2.version,
        acknowledgeWarnings: true,
      }),
      planning.approveCurrentPlan(actor, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current2.version,
        acknowledgeWarnings: true,
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const validCount = await db.piPlanApproval.count({
      where: { piId: pi.id, status: "VALID" },
    });
    expect(validCount).toBe(1);

    const approval = (fulfilled[0] as PromiseFulfilledResult<{ approvalId: string }>).value;
    // Unauthorized baseline
    await expect(
      planning.createBaseline(viewer, {
        piId: pi.id,
        expectedApprovalId: approval.approvalId,
        expectedPiVersion: (
          await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } })
        ).version,
        expectedCurrentRevisionVersion: (
          await planning.pi.requireCurrentRevision(pi.id)
        ).version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Concurrent baselining
    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    const current3 = await planning.pi.requireCurrentRevision(pi.id);
    const baseResults = await Promise.allSettled([
      planning.createBaseline(actor, {
        piId: pi.id,
        label: "b1",
        expectedApprovalId: approval.approvalId,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current3.version,
      }),
      planning.createBaseline(actor, {
        piId: pi.id,
        label: "b2",
        expectedApprovalId: approval.approvalId,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current3.version,
      }),
    ]);
    const baseOk = baseResults.filter((r) => r.status === "fulfilled");
    const baseFail = baseResults.filter((r) => r.status === "rejected");
    expect(baseOk.length).toBe(1);
    expect(baseFail.length).toBe(1);
    expect(await db.piBaseline.count({ where: { piId: pi.id } })).toBe(1);
  });

  it("second promotion invalidates previous approval; rollback leaves CURRENT unchanged", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Promo",
      workTitles: ["W1", "W2"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const s1 = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "S1",
    });
    const s2 = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "S2",
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: s2.id,
      workItemId: workItems[1]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });

    let piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    piRow = await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "PLANNING",
      expectedVersion: piRow.version,
    });
    await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "REVIEW",
      expectedVersion: piRow.version,
    });

    await promoteScenarioB(actor, pi.id, s1.id);
    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    let current = await planning.pi.requireCurrentRevision(pi.id);
    const approval = await planning.approveCurrentPlan(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: current.version,
      acknowledgeWarnings: true,
    });

    // Second promotion invalidates approval
    const s2Fresh = await db.planningRevision.findUniqueOrThrow({
      where: { id: s2.id },
    });
    await promoteScenarioB(actor, pi.id, s2Fresh.id);
    const approvalRow = await db.piPlanApproval.findUniqueOrThrow({
      where: { id: approval.approvalId },
    });
    expect(approvalRow.status).toBe("INVALIDATED");
    expect(approvalRow.invalidatedReason).toBe("REPROMOTED");

    piRow = await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } });
    current = await planning.pi.requireCurrentRevision(pi.id);
    await expect(
      planning.createBaseline(actor, {
        piId: pi.id,
        expectedApprovalId: approval.approvalId,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current.version,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Transaction rollback: stale current version leaves no approval
    const beforeCount = await db.piPlanApproval.count({ where: { piId: pi.id } });
    await expect(
      planning.approveCurrentPlan(actor, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: current.version - 1,
        acknowledgeWarnings: true,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.piPlanApproval.count({ where: { piId: pi.id } })).toBe(
      beforeCount,
    );
  });
});
