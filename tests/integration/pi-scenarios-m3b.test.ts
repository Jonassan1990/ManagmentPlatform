/**
 * M3B — Scenario create/clone/edit isolation + auth + concurrency.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { PlanningService } from "@/modules/pi-planning/application/planning-service";
import { PortfolioPiCapacityQueryService } from "@/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { AppError } from "@/modules/shared/errors";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";
process.env.DIRECT_URL =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;
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
  return { id, displayName: "Test", source: "test" };
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
  await db.pilotFeedback.deleteMany();
  await db.pilotCriterion.deleteMany();
  await db.pilotExtension.deleteMany();
  await db.pilot.deleteMany();
  await db.projectWorkItem.deleteMany();
  await db.projectMilestone.deleteMany();
  await db.projectParticipatingDepartment.deleteMany();
  await db.projectClosure.deleteMany();
  await db.project.deleteMany();
  await db.projectReferenceCounter.deleteMany();
  await db.approvalRecord.deleteMany();
  await db.approvalRequest.deleteMany();
  await db.evidenceEntry.deleteMany();
  await db.decisionCondition.deleteMany();
  await db.decisionRecord.deleteMany();
  await db.evidencePackage.deleteMany();
  await db.decisionPackage.deleteMany();
  await db.governanceSubmission.deleteMany();
  await db.reviewSnapshot.deleteMany();
  await db.governanceGate.deleteMany();
  await db.approvalRequirementTemplate.deleteMany();
  await db.poCSuccessCriterion.deleteMany();
  await db.poC.deleteMany();
  await db.requirementReferenceCounter.deleteMany();
  await db.riskReferenceCounter.deleteMany();
  await db.documentVersion.deleteMany();
  await db.managedDocument.deleteMany();
  await db.requirementRelation.deleteMany();
  await db.acceptanceCriterion.deleteMany();
  await db.requirement.deleteMany();
  await db.solutionAlternative.deleteMany();
  await db.preStudyAssessment.deleteMany();
  await db.preStudy.deleteMany();
  await db.risk.deleteMany();
  await db.lifecycleTransition.deleteMany();
  await db.demand.deleteMany();
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

type SeededOrg = Awaited<ReturnType<typeof seedPlanningOrg>>;

async function seedPlanningOrg(actor: Principal) {
  await db.principal.create({ data: { id: actor.id, displayName: "Actor" } });
  const org = await organization.createOrganization(actor, {
    name: "Org M3B",
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

const PI_START = new Date("2026-01-01T00:00:00.000Z");
const PI_END = new Date("2026-03-31T00:00:00.000Z");
const IT1_START = new Date("2026-01-01T00:00:00.000Z");
const IT1_END = new Date("2026-01-14T00:00:00.000Z");

async function createPiReady(actor: Principal, ctx: SeededOrg) {
  let pi = await planning.createProgramIncrement(actor, {
    organizationId: ctx.org.id,
    sectionId: ctx.section.id,
    name: "PI Scenarios",
    startDate: PI_START,
    endDate: PI_END,
  });
  const it1 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "Iteration 1",
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

describe("M3B scenario create / clone / rename / archive", () => {
  it("creates scenario from CURRENT with cloned allocations and ACTIVE_PLAN CURRENT", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Proj",
      workTitles: ["Alpha", "Beta"],
    });

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "40",
    });

    const current = await planning.pi.requireCurrentRevision(pi.id);
    expect(current.status).toBe("ACTIVE_PLAN");
    expect(current.isCurrent).toBe(true);

    const scenarioA = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario A",
    });
    expect(scenarioA.isCurrent).toBe(false);
    expect(scenarioA.status).toBe("DRAFT");
    expect(scenarioA.key.startsWith("SCN-")).toBe(true);
    expect(scenarioA.clonedFromRevisionId).toBe(current.id);

    const aAllocs = await db.workAllocation.findMany({
      where: { revisionId: scenarioA.id },
    });
    const currentAllocs = await db.workAllocation.findMany({
      where: { revisionId: current.id },
    });
    expect(aAllocs).toHaveLength(1);
    expect(currentAllocs).toHaveLength(1);
    expect(aAllocs[0]!.id).not.toBe(currentAllocs[0]!.id);
    expect(aAllocs[0]!.plannedHours.toString()).toBe("40");

    const audits = await db.auditEvent.findMany({
      where: { actionType: "pi.scenario.created", subjectId: scenarioA.id },
    });
    expect(audits).toHaveLength(1);
  });

  it("clones DRAFT scenario, renames, archives; rejects CURRENT archive", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi } = await createPiReady(actor, ctx);

    const scenarioA = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "A",
    });
    const scenarioB = await planning.cloneScenario(actor, {
      revisionId: scenarioA.id,
      label: "B",
      expectedVersion: scenarioA.version,
    });
    expect(scenarioB.clonedFromRevisionId).toBe(scenarioA.id);
    expect(scenarioB.status).toBe("DRAFT");

    const renamed = await planning.renameScenario(actor, {
      revisionId: scenarioB.id,
      label: "Scenario B renamed",
      expectedVersion: scenarioB.version,
    });
    expect(renamed.label).toBe("Scenario B renamed");
    expect(renamed.version).toBe(scenarioB.version + 1);

    const archived = await planning.archiveScenario(actor, {
      revisionId: renamed.id,
      expectedVersion: renamed.version,
    });
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).toBeTruthy();

    const listed = await planning.listScenarios(actor, pi.id);
    expect(listed.some((s) => s.id === archived.id)).toBe(false);
    const withArchived = await planning.listScenarios(actor, pi.id, {
      includeArchived: true,
    });
    expect(withArchived.some((s) => s.id === archived.id)).toBe(true);

    const current = await planning.pi.requireCurrentRevision(pi.id);
    await expect(
      planning.archiveScenario(actor, {
        revisionId: current.id,
        expectedVersion: current.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("M3B isolation CURRENT / Scenario A / Scenario B / Baseline", () => {
  it("keeps allocation edits independent and Portfolio CURRENT-only", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Isolation Proj",
      workTitles: ["W1", "W2"],
    });

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "40",
    });

    const scenarioA = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario A",
    });
    const scenarioB = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario B",
    });

    // Edit A → 60h
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: scenarioA.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "60",
    });

    // Edit B → 20h + allocate W2
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: scenarioB.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "20",
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: scenarioB.id,
      workItemId: workItems[1]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "10",
    });

    // CURRENT stays 40 and only W1
    const current = await planning.pi.requireCurrentRevision(pi.id);
    const currentAllocs = await db.workAllocation.findMany({
      where: { revisionId: current.id },
    });
    expect(currentAllocs).toHaveLength(1);
    expect(currentAllocs[0]!.plannedHours.toString()).toBe("40");

    const aAllocs = await db.workAllocation.findMany({
      where: { revisionId: scenarioA.id },
    });
    expect(aAllocs).toHaveLength(1);
    expect(aAllocs[0]!.plannedHours.toString()).toBe("60");

    const bAllocs = await db.workAllocation.findMany({
      where: { revisionId: scenarioB.id },
    });
    expect(bAllocs).toHaveLength(2);
    const bHours = bAllocs.reduce(
      (s, a) => s + Number(a.plannedHours.toString()),
      0,
    );
    expect(bHours).toBe(30);

    // Capacity views differ by revision
    const capCurrent = await planning.capacity.computeCapacityViews(pi.id);
    const capA = await planning.capacity.computeCapacityViews(
      pi.id,
      scenarioA.id,
    );
    const capB = await planning.capacity.computeCapacityViews(
      pi.id,
      scenarioB.id,
    );
    const load = (views: typeof capCurrent) =>
      views.teams.find((t) => t.iterationId === it1.id)?.plannedLoadHours;
    expect(load(capCurrent)).toBe(40);
    expect(load(capA)).toBe(60);
    expect(load(capB)).toBe(30);

    // Baseline from CURRENT — immutable and independent of scenario edits
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
      label: "pre-scenario",
    });
    const payload = baseline.payload as {
      allocations: { plannedHours: string | number }[];
    };
    const baselineHours = payload.allocations.reduce(
      (s, a) => s + Number(a.plannedHours),
      0,
    );
    expect(baselineHours).toBe(40);

    // Further scenario edit must not change baseline payload
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: scenarioA.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "99",
    });
    const baselineAgain = await db.piBaseline.findUniqueOrThrow({
      where: { id: baseline.id },
    });
    expect(baselineAgain.payload).toEqual(baseline.payload);

    // Portfolio M2E remains CURRENT-only (40), not scenario 99/30
    const overview = await piCapacity.getPiCapacityOverview(actor, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(overview.capacity.state).toBe("ready");
    if (overview.capacity.state === "ready") {
      expect(overview.capacity.meta.revision.isCurrent).toBe(true);
      expect(overview.capacity.totals.committedHours).toBe(40);
    }
  });
});

describe("M3B authorization and concurrency", () => {
  it("denies scenario create without PI_ALLOCATE and enforces stale version", async () => {
    const actor = principal();
    const stranger = principal();
    const ctx = await seedPlanningOrg(actor);
    await db.principal.create({
      data: { id: stranger.id, displayName: "Stranger" },
    });
    const { pi } = await createPiReady(actor, ctx);

    await expect(
      planning.createScenarioFromCurrent(stranger, {
        piId: pi.id,
        label: "Nope",
      }),
    ).rejects.toBeInstanceOf(AppError);

    const scenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "A",
    });
    await planning.renameScenario(actor, {
      revisionId: scenario.id,
      label: "A2",
      expectedVersion: scenario.version,
    });
    await expect(
      planning.renameScenario(actor, {
        revisionId: scenario.id,
        label: "A3",
        expectedVersion: scenario.version,
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
  });

  it("rejects allocation edits on READY_FOR_REVIEW and ARCHIVED scenarios", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Lock Proj",
      workTitles: ["W1"],
    });

    const scenario = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Locked",
    });
    const ready = await planning.markScenarioReady(actor, {
      revisionId: scenario.id,
      expectedVersion: scenario.version,
    });
    await expect(
      planning.allocateWork(actor, {
        piId: pi.id,
        revisionId: ready.id,
        workItemId: workItems[0]!.id,
        iterationId: it1.id,
        teamId: ctx.teamA.id,
        plannedHours: "5",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const reopened = await planning.reopenScenario(actor, {
      revisionId: ready.id,
      expectedVersion: ready.version,
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: reopened.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "5",
    });

    const archived = await planning.archiveScenario(actor, {
      revisionId: reopened.id,
      expectedVersion: reopened.version,
    });
    await expect(
      planning.allocateWork(actor, {
        piId: pi.id,
        revisionId: archived.id,
        workItemId: workItems[0]!.id,
        iterationId: it1.id,
        teamId: ctx.teamA.id,
        plannedHours: "7",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("enforces at most one CURRENT revision per PI", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi } = await createPiReady(actor, ctx);
    await expect(
      db.planningRevision.create({
        data: {
          piId: pi.id,
          key: "FAKE-CURRENT",
          label: "Bogus",
          isCurrent: true,
          status: "ACTIVE_PLAN",
        },
      }),
    ).rejects.toBeTruthy();
  });
});
