/**
 * M3D-B — Controlled scenario promotion into CURRENT (isolated DB).
 * Uses dedicated DB: management_platform_m3d_b_int
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
  process.env.DATABASE_URL_M3D_B ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_m3d_b_int?schema=public";
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
  return { id, displayName: "M3D-B Tester", source: "test" };
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

type SeededOrg = Awaited<ReturnType<typeof seedOrg>>;

async function seedOrg(actor: Principal) {
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await authz.ensureBootstrapBinding(actor.id);
  const org = await organization.createOrganization(actor, {
    name: "M3D-B Org",
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
  opts: { name: string; workTitles: string[]; estimateHours?: string },
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
      initiativeId: initiative.id,
      organizationId: orgId,
      departmentId,
      referenceKey: `PRJ-${randomUUID().slice(0, 8)}`,
      name: opts.name,
      status: "ACTIVE",
    },
  });
  const workItems = [];
  for (let i = 0; i < opts.workTitles.length; i++) {
    workItems.push(
      await db.projectWorkItem.create({
        data: {
          projectId: project.id,
          type: "TASK",
          referenceKey: `WI-${String(i + 1).padStart(3, "0")}`,
          title: opts.workTitles[i]!,
          status: "BACKLOG",
          estimateHours: opts.estimateHours ?? "8",
        },
      }),
    );
  }
  return { initiative, project, workItems };
}

const PI_START = new Date("2026-04-01T00:00:00.000Z");
const PI_END = new Date("2026-06-30T00:00:00.000Z");
const IT1_START = new Date("2026-04-01T00:00:00.000Z");
const IT1_END = new Date("2026-04-14T00:00:00.000Z");

async function createPiReady(actor: Principal, ctx: SeededOrg) {
  let pi = await planning.createProgramIncrement(actor, {
    organizationId: ctx.org.id,
    sectionId: ctx.section.id,
    name: "M3D-B Promotion PI",
    startDate: PI_START,
    endDate: PI_END,
  });
  const it1 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "IT1",
    sequence: 1,
    startDate: IT1_START,
    endDate: IT1_END,
  });
  pi = await planning.setParticipatingDepartments(actor, {
    piId: pi.id,
    departments: [{ departmentId: ctx.deptA.id }],
  });
  pi = await planning.setParticipatingTeams(actor, {
    piId: pi.id,
    teams: [{ teamId: ctx.teamA.id, departmentId: ctx.deptA.id }],
  });
  return { pi, it1 };
}

function fingerprintAllocations(
  rows: Array<{
    id: string;
    revisionId: string;
    workItemId: string;
    iterationId: string;
    teamId: string;
    plannedHours: unknown;
    notes: string | null;
  }>,
) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [...rows]
          .map((a) => ({
            revisionId: a.revisionId,
            workItemId: a.workItemId,
            iterationId: a.iterationId,
            teamId: a.teamId,
            plannedHours: String(a.plannedHours),
            notes: a.notes,
          }))
          .sort((a, b) =>
            `${a.revisionId}:${a.workItemId}`.localeCompare(
              `${b.revisionId}:${b.workItemId}`,
            ),
          ),
      ),
    )
    .digest("hex");
}

async function selectForPromote(
  actor: Principal,
  piId: string,
  revision: { id: string; version: number },
) {
  const piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: piId },
  });
  return planning.selectScenario(actor, {
    piId,
    revisionId: revision.id,
    expectedPiVersion: piRow.version,
    expectedRevisionVersion: revision.version,
  });
}

async function promoteArgs(actor: Principal, piId: string, acknowledgeWarnings = false) {
  const pi = await db.programIncrement.findUniqueOrThrow({ where: { id: piId } });
  const current = await planning.pi.requireCurrentRevision(piId);
  if (!pi.selectedRevisionId) {
    throw new Error("expected selection");
  }
  const selected = await db.planningRevision.findUniqueOrThrow({
    where: { id: pi.selectedRevisionId },
  });
  return {
    piId,
    expectedPiVersion: pi.version,
    expectedSelectedRevisionId: selected.id,
    expectedSelectedRevisionVersion: selected.version,
    expectedCurrentRevisionVersion: current.version,
    acknowledgeWarnings,
  };
}

beforeAll(async () => {
  await db.$connect();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("M3D-B successful promotion + isolation", () => {
  it("promotes selected scenario into CURRENT without mutating source/other/baseline", async () => {
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

    const current = await planning.pi.requireCurrentRevision(pi.id);
    const scenarioA = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario A",
    });
    const scenarioB = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario B",
    });

    // Edit B: replace hours / add second allocation (while still DRAFT)
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
    const aFp = fingerprintAllocations(aBefore);
    const bFp = fingerprintAllocations(bBefore);

    let piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
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
    const baseline = await planning.createBaseline(actor, {
      piId: pi.id,
      label: "pre-promote",
    });
    const baselineHash = createHash("sha256")
      .update(JSON.stringify(baseline.payload))
      .digest("hex");

    const portfolioBefore = await piCapacity.getPiCapacityOverview(actor, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(portfolioBefore.capacity.state).toBe("ready");
    if (portfolioBefore.capacity.state === "ready") {
      expect(portfolioBefore.capacity.totals.committedHours).toBe(8);
    }

    const refreshedB = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioB.id },
    });
    await selectForPromote(actor, pi.id, refreshedB);

    const preview = await planning.getScenarioPromotionPreview(actor, pi.id);
    expect(preview.canPromote).toBe(true);
    expect(preview.selectedRevision?.id).toBe(scenarioB.id);
    expect(preview.selectedAllocations.allocationCount).toBe(2);

    const result = await planning.promoteSelectedScenario(
      actor,
      await promoteArgs(actor, pi.id),
    );
    expect(result.idempotentReplay).toBe(false);
    expect(result.currentRevisionId).toBe(current.id);
    expect(result.allocationCount).toBe(2);
    expect(result.totalCommittedHours).toBe(24);

    const currentAfter = await planning.pi.requireCurrentRevision(pi.id);
    expect(currentAfter.id).toBe(current.id);
    expect(currentAfter.isCurrent).toBe(true);
    expect(currentAfter.version).toBe(result.currentRevisionVersion);

    const currentAllocs = await db.workAllocation.findMany({
      where: { revisionId: current.id },
      orderBy: { workItemId: "asc" },
    });
    expect(currentAllocs).toHaveLength(2);
    expect(
      currentAllocs.map((a) => String(a.plannedHours)).sort(),
    ).toEqual(["16", "8"]);

    const aAfter = await db.workAllocation.findMany({
      where: { revisionId: scenarioA.id },
      orderBy: { workItemId: "asc" },
    });
    const bAfter = await db.workAllocation.findMany({
      where: { revisionId: scenarioB.id },
      orderBy: { workItemId: "asc" },
    });
    expect(fingerprintAllocations(aAfter)).toBe(aFp);
    expect(fingerprintAllocations(bAfter)).toBe(bFp);

    const bRow = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioB.id },
    });
    expect(bRow.status).toBe("PROMOTED");
    expect(bRow.selectedAt).toBeNull();

    const piAfter = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    expect(piAfter.selectedRevisionId).toBeNull();
    expect(piAfter.lastPromotedFromRevisionId).toBe(scenarioB.id);
    expect(piAfter.lastPromotedByPrincipalId).toBe(actor.id);

    const baselineAgain = await db.piBaseline.findUniqueOrThrow({
      where: { id: baseline.id },
    });
    expect(
      createHash("sha256")
        .update(JSON.stringify(baselineAgain.payload))
        .digest("hex"),
    ).toBe(baselineHash);

    const portfolioAfter = await piCapacity.getPiCapacityOverview(actor, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(portfolioAfter.capacity.state).toBe("ready");
    if (portfolioAfter.capacity.state === "ready") {
      expect(portfolioAfter.capacity.totals.committedHours).toBe(24);
      expect(portfolioAfter.capacity.meta.revision.isCurrent).toBe(true);
    }

    const audits = await db.auditEvent.findMany({
      where: { actionType: "pi.scenario.promoted", subjectId: pi.id },
    });
    expect(audits).toHaveLength(1);
    const payload = audits[0]!.payload as Record<string, unknown>;
    expect(payload.sourceRevisionId).toBe(scenarioB.id);
    expect(payload.allocationCount).toBe(2);
    expect(payload.previousCurrentVersion).toBe(current.version);
    expect(payload.newCurrentVersion).toBe(result.currentRevisionVersion);
  });

  it("promotes an empty selected scenario (clears CURRENT allocations)", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Empty",
      workTitles: ["W1"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const empty = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Empty B",
    });
    await db.workAllocation.deleteMany({ where: { revisionId: empty.id } });
    const emptyRow = await db.planningRevision.findUniqueOrThrow({
      where: { id: empty.id },
    });
    await selectForPromote(actor, pi.id, emptyRow);
    const result = await planning.promoteSelectedScenario(
      actor,
      await promoteArgs(actor, pi.id),
    );
    expect(result.allocationCount).toBe(0);
    const current = await planning.pi.requireCurrentRevision(pi.id);
    expect(
      await db.workAllocation.count({ where: { revisionId: current.id } }),
    ).toBe(0);
  });
});

describe("M3D-B prerequisites / auth / readiness", () => {
  it("rejects no selection, not-ready, missing warning ack, unauthorized, cross-org", async () => {
    const actor = principal();
    const stranger = principal();
    const viewer = principal();
    const ctx = await seedOrg(actor);
    await db.principal.create({
      data: { id: stranger.id, displayName: "Stranger" },
    });
    await db.principal.create({
      data: { id: viewer.id, displayName: "Viewer" },
    });
    await bindRole(actor, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: "ORGANIZATION",
      organizationId: ctx.org.id,
    });

    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Gate",
      workTitles: ["Light", "Heavy"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });

    const current = await planning.pi.requireCurrentRevision(pi.id);
    await expect(
      planning.promoteSelectedScenario(actor, {
        piId: pi.id,
        expectedPiVersion: pi.version,
        expectedSelectedRevisionId: randomUUID(),
        expectedSelectedRevisionVersion: 1,
        expectedCurrentRevisionVersion: current.version,
        acknowledgeWarnings: false,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const overloaded = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Overloaded",
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: overloaded.id,
      workItemId: workItems[1]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "200",
    });
    const overloadedRow = await db.planningRevision.findUniqueOrThrow({
      where: { id: overloaded.id },
    });
    await selectForPromote(actor, pi.id, overloadedRow);

    const readiness = await planning.evaluateScenarioReadiness(actor, {
      piId: pi.id,
    });
    expect(readiness.classification).toBe("NOT_READY");

    await expect(
      planning.promoteSelectedScenario(actor, await promoteArgs(actor, pi.id)),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    // READY_WITH_WARNINGS: empty scenario + zero capacity → missing-input warning, no overload
    const piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    await planning.clearScenarioSelection(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
    });
    const warnScenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Warn",
    });
    await db.workAllocation.deleteMany({ where: { revisionId: warnScenario.id } });
    await db.resource.update({
      where: { id: ctx.resourceA.id },
      data: { capacityHoursPerWeek: 0 },
    });
    const warnRow = await db.planningRevision.findUniqueOrThrow({
      where: { id: warnScenario.id },
    });
    await selectForPromote(actor, pi.id, warnRow);
    const warnReady = await planning.evaluateScenarioReadiness(actor, {
      piId: pi.id,
    });
    expect(warnReady.classification).toBe("READY_WITH_WARNINGS");

    await expect(
      planning.promoteSelectedScenario(
        actor,
        await promoteArgs(actor, pi.id, false),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const promoted = await planning.promoteSelectedScenario(
      actor,
      await promoteArgs(actor, pi.id, true),
    );
    expect(promoted.allocationCount).toBe(0);

    // Unauthorized / cross-org: fresh PI with selection
    await db.resource.update({
      where: { id: ctx.resourceA.id },
      data: { capacityHoursPerWeek: 40 },
    });
    const { pi: pi2, it1: it2 } = await createPiReady(actor, ctx);
    const { workItems: wi2 } = await seedProjectWithWork(
      ctx.org.id,
      ctx.deptA.id,
      { name: "Auth2", workTitles: ["X"] },
    );
    await planning.allocateWork(actor, {
      piId: pi2.id,
      workItemId: wi2[0]!.id,
      iterationId: it2.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const draft = await planning.createScenarioFromCurrent(actor, {
      piId: pi2.id,
      label: "Draft",
    });
    await selectForPromote(actor, pi2.id, draft);

    await expect(
      planning.promoteSelectedScenario(
        stranger,
        await promoteArgs(actor, pi2.id),
      ),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      planning.promoteSelectedScenario(
        viewer,
        await promoteArgs(actor, pi2.id),
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("M3D-B concurrency / versions / rollback / idempotency", () => {
  it("rejects stale PI/revision versions and selection changes", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Stale",
      workTitles: ["W"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const scenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "S",
    });
    await selectForPromote(actor, pi.id, scenario);
    const args = await promoteArgs(actor, pi.id);

    await expect(
      planning.promoteSelectedScenario(actor, {
        ...args,
        expectedPiVersion: args.expectedPiVersion - 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      planning.promoteSelectedScenario(actor, {
        ...args,
        expectedSelectedRevisionVersion:
          args.expectedSelectedRevisionVersion + 5,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      planning.promoteSelectedScenario(actor, {
        ...args,
        expectedCurrentRevisionVersion: args.expectedCurrentRevisionVersion + 3,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Selection changed
    const other = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Other",
    });
    const piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: other.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: other.version,
    });
    await expect(
      planning.promoteSelectedScenario(actor, args),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows only one concurrent promotion to win", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Race",
      workTitles: ["W"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const scenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Race S",
    });
    await selectForPromote(actor, pi.id, scenario);
    const args = await promoteArgs(actor, pi.id);

    const results = await Promise.allSettled([
      planning.promoteSelectedScenario(actor, args),
      planning.promoteSelectedScenario(actor, args),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const current = await planning.pi.requireCurrentRevision(pi.id);
    expect(
      await db.workAllocation.count({ where: { revisionId: current.id } }),
    ).toBe(1);
  });

  it("rolls back CURRENT when promotion fails mid-flight (stale CURRENT version)", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Rollback",
      workTitles: ["W"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const current = await planning.pi.requireCurrentRevision(pi.id);
    const before = await db.workAllocation.findMany({
      where: { revisionId: current.id },
    });
    const beforeFp = fingerprintAllocations(before);

    const scenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Rollback S",
    });
    // Mutate scenario so it differs from CURRENT
    const sAlloc = await db.workAllocation.findFirstOrThrow({
      where: { revisionId: scenario.id },
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: scenario.id,
      workItemId: sAlloc.workItemId,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "12",
      expectedVersion: sAlloc.version,
    });
    const scenarioRow = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenario.id },
    });
    await selectForPromote(actor, pi.id, scenarioRow);

    // Concurrent CURRENT edit bumps version after we capture promote args
    const args = await promoteArgs(actor, pi.id);
    await db.planningRevision.update({
      where: { id: current.id },
      data: { version: { increment: 1 } },
    });

    await expect(
      planning.promoteSelectedScenario(actor, args),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const after = await db.workAllocation.findMany({
      where: { revisionId: current.id },
    });
    expect(fingerprintAllocations(after)).toBe(beforeFp);
    expect(String(after[0]!.plannedHours)).toBe("8");

    const scenarioStill = await db.workAllocation.findMany({
      where: { revisionId: scenario.id },
    });
    expect(String(scenarioStill[0]!.plannedHours)).toBe("12");
    expect(
      (await db.planningRevision.findUniqueOrThrow({ where: { id: scenario.id } }))
        .status,
    ).not.toBe("PROMOTED");
  });

  it("repeated promote with refreshed matching versions is idempotent", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Idem",
      workTitles: ["W"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const scenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Idem S",
    });
    await selectForPromote(actor, pi.id, scenario);
    const first = await planning.promoteSelectedScenario(
      actor,
      await promoteArgs(actor, pi.id),
    );
    expect(first.idempotentReplay).toBe(false);

    const current = await planning.pi.requireCurrentRevision(pi.id);
    const countAfterFirst = await db.workAllocation.count({
      where: { revisionId: current.id },
    });

    const piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const source = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenario.id },
    });
    const replay = await planning.promoteSelectedScenario(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedSelectedRevisionId: source.id,
      expectedSelectedRevisionVersion: source.version,
      expectedCurrentRevisionVersion: current.version,
      acknowledgeWarnings: false,
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(
      await db.workAllocation.count({ where: { revisionId: current.id } }),
    ).toBe(countAfterFirst);
  });

  it("rejects concurrent scenario allocation edit via stale selected revision version", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "EditRace",
      workTitles: ["W"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const scenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "EditRace S",
    });
    await selectForPromote(actor, pi.id, scenario);
    const args = await promoteArgs(actor, pi.id);

    // Concurrent edit bumps scenario revision version
    await db.planningRevision.update({
      where: { id: scenario.id },
      data: { version: { increment: 1 } },
    });

    await expect(
      planning.promoteSelectedScenario(actor, args),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
