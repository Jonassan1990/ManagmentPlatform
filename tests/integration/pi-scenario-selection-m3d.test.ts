/**
 * M3D-A — Scenario selection & readiness (isolated DB).
 * Uses dedicated DB: management_platform_m3d_int
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
  process.env.DATABASE_URL_M3D ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_m3d_int?schema=public";
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
  return { id, displayName: "M3D Tester", source: "test" };
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
    name: "M3D Org",
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
    name: "M3D Selection PI",
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

async function fingerprintPlanning() {
  const [allocations, revisions, baselines, pis] = await Promise.all([
    db.workAllocation.findMany({ orderBy: { id: "asc" } }),
    db.planningRevision.findMany({ orderBy: { id: "asc" } }),
    db.piBaseline.findMany({ orderBy: { id: "asc" } }),
    db.programIncrement.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        selectedRevisionId: true,
        version: true,
        status: true,
      },
    }),
  ]);
  // Isolation: allocations + baseline payloads must not change; selection fields may.
  const immutable = JSON.stringify({
    allocations,
    baselinePayloads: baselines.map((b) => b.payload),
    revisionAllocKeys: revisions.map((r) => ({
      id: r.id,
      // exclude selection markers from immutable fingerprint of allocations
    })),
    allocationHours: allocations.map((a) => ({
      id: a.id,
      revisionId: a.revisionId,
      plannedHours: String(a.plannedHours),
      workItemId: a.workItemId,
      iterationId: a.iterationId,
      teamId: a.teamId,
    })),
  });
  return {
    sha256: createHash("sha256").update(immutable).digest("hex"),
    allocationCount: allocations.length,
    baselineCount: baselines.length,
    pis,
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

describe("M3D-A select / replace / clear / single selection", () => {
  it("selects DRAFT, replaces selection, clears, enforces single SELECTED", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Sel",
      workTitles: ["W1"],
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

    let piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const selected = await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: scenarioA.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: scenarioA.version,
    });
    expect(selected.selectedRevision?.id).toBe(scenarioA.id);
    expect(selected.selectionDisclaimer).toBe(
      "Selected for review — not approved",
    );

    const aAfter = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioA.id },
    });
    expect(aAfter.status).toBe("SELECTED");
    expect(aAfter.selectedAt).toBeTruthy();

    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const changed = await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: scenarioB.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: scenarioB.version,
    });
    expect(changed.selectedRevision?.id).toBe(scenarioB.id);

    const selectedCount = await db.planningRevision.count({
      where: { piId: pi.id, status: "SELECTED" },
    });
    expect(selectedCount).toBe(1);

    const aRestored = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioA.id },
    });
    expect(aRestored.status).toBe("DRAFT");
    expect(aRestored.selectedAt).toBeNull();

    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const cleared = await planning.clearScenarioSelection(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
    });
    expect(cleared.selectedRevision).toBeNull();
    expect(
      (
        await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } })
      ).selectedRevisionId,
    ).toBeNull();

    // CURRENT unchanged identity
    const currentAgain = await planning.pi.requireCurrentRevision(pi.id);
    expect(currentAgain.id).toBe(current.id);
    expect(currentAgain.isCurrent).toBe(true);
  });
});

describe("M3D-A rejection / concurrency / authorization", () => {
  it("rejects CURRENT, archived, cross-PI, stale versions, and unauthorized", async () => {
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
    const other = await createPiReady(actor, ctx);
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
    const current = await planning.pi.requireCurrentRevision(pi.id);
    const draft = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "A",
    });
    const archivedCreated = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Arch",
    });
    const archived = await planning.archiveScenario(actor, {
      revisionId: archivedCreated.id,
      expectedVersion: archivedCreated.version,
    });

    let piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });

    await expect(
      planning.selectScenario(actor, {
        piId: pi.id,
        revisionId: current.id,
        expectedPiVersion: piRow.version,
        expectedRevisionVersion: current.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await expect(
      planning.selectScenario(actor, {
        piId: pi.id,
        revisionId: archived.id,
        expectedPiVersion: piRow.version,
        expectedRevisionVersion: archived.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const otherCurrent = await planning.pi.requireCurrentRevision(other.pi.id);
    const otherDraft = await planning.createScenarioFromCurrent(actor, {
      piId: other.pi.id,
      label: "Other",
    });
    await expect(
      planning.selectScenario(actor, {
        piId: pi.id,
        revisionId: otherDraft.id,
        expectedPiVersion: piRow.version,
        expectedRevisionVersion: otherDraft.version,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Bump PI version so a stale expectedPiVersion is still a positive int.
    await db.programIncrement.update({
      where: { id: pi.id },
      data: { version: { increment: 1 } },
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    await expect(
      planning.selectScenario(actor, {
        piId: pi.id,
        revisionId: draft.id,
        expectedPiVersion: piRow.version - 1,
        expectedRevisionVersion: draft.version,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      planning.selectScenario(stranger, {
        piId: pi.id,
        revisionId: draft.id,
        expectedPiVersion: piRow.version,
        expectedRevisionVersion: draft.version,
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      planning.selectScenario(viewer, {
        piId: pi.id,
        revisionId: draft.id,
        expectedPiVersion: piRow.version,
        expectedRevisionVersion: draft.version,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Viewer can read readiness
    const readiness = await planning.evaluateScenarioReadiness(viewer, {
      piId: pi.id,
      revisionId: draft.id,
    });
    expect(readiness.classification).not.toBe("UNAVAILABLE");
    void otherCurrent;
  });

  it("rejects concurrent selection races with optimistic PI version", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi } = await createPiReady(actor, ctx);
    const a = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "A",
    });
    const b = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "B",
    });
    const piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });

    const first = planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: a.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: a.version,
    });
    const second = planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: b.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: b.version,
    });

    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const selectedCount = await db.planningRevision.count({
      where: { piId: pi.id, status: "SELECTED" },
    });
    expect(selectedCount).toBe(1);
  });
});

describe("M3D-A readiness / audit / isolation / Portfolio", () => {
  it("classifies readiness, records audit, and does not mutate allocations/baselines", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Ready",
      workTitles: ["Light", "Heavy"],
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
    // Overload scenario B
    const scenarioB = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario B",
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: scenarioB.id,
      workItemId: workItems[1]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "200",
    });

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
      label: "pre-select",
    });
    const baselineHash = createHash("sha256")
      .update(JSON.stringify(baseline.payload))
      .digest("hex");

    const before = await fingerprintPlanning();

    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: scenarioA.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: scenarioA.version,
    });

    const readyA = await planning.evaluateScenarioReadiness(actor, {
      piId: pi.id,
    });
    expect(readyA.revision?.id).toBe(scenarioA.id);
    expect(["READY", "READY_WITH_WARNINGS"]).toContain(readyA.classification);
    expect(readyA.metrics?.availableHours).toBeGreaterThan(0);
    expect(readyA.metrics?.committedHours).toBe(8);

    const readyB = await planning.evaluateScenarioReadiness(actor, {
      piId: pi.id,
      revisionId: scenarioB.id,
    });
    expect(readyB.classification).toBe("NOT_READY");
    expect(readyB.blockers.length).toBeGreaterThan(0);
    expect(readyB.metrics?.overloadedTeamCount).toBeGreaterThan(0);

    const after = await fingerprintPlanning();
    expect(after.sha256).toBe(before.sha256);
    expect(after.allocationCount).toBe(before.allocationCount);

    const baselineAgain = await db.piBaseline.findUniqueOrThrow({
      where: { id: baseline.id },
    });
    expect(
      createHash("sha256")
        .update(JSON.stringify(baselineAgain.payload))
        .digest("hex"),
    ).toBe(baselineHash);

    const audits = await planning.listScenarioSelectionHistory(actor, pi.id);
    expect(
      audits.some((a) => a.actionType === "pi.scenario.selected"),
    ).toBe(true);

    const overview = await piCapacity.getPiCapacityOverview(actor, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(overview.capacity.state).toBe("ready");
    if (overview.capacity.state === "ready") {
      expect(overview.capacity.meta.revision.isCurrent).toBe(true);
      expect(overview.capacity.totals.committedHours).toBe(8);
    }

    // Unavailable when nothing selected and no revisionId
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    await planning.clearScenarioSelection(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
    });
    const unavailable = await planning.evaluateScenarioReadiness(actor, {
      piId: pi.id,
    });
    expect(unavailable.classification).toBe("UNAVAILABLE");
  });
});
