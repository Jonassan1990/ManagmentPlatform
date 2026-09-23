import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { PlanningService } from "@/modules/pi-planning/application/planning-service";
import { AppError } from "@/modules/shared/errors";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";
process.env.ALLOW_DEV_AUTH = "false";
resetEnvCacheForTests();

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const organization = new OrganizationService(db, authz, audit);
const planning = new PlanningService(db, authz, audit);

function principal(id = randomUUID()): Principal {
  return { id, displayName: "Test", source: "test" };
}

async function resetDb() {
  await db.auditEvent.deleteMany();
  // Phase 5 PI Planning — FK-safe order
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
  // Phase 4 / earlier
  await db.pilotFeedback.deleteMany();
  await db.pilotCriterion.deleteMany();
  await db.pilotExtension.deleteMany();
  await db.pilot.deleteMany();
  await db.projectWorkItem.deleteMany();
  await db.projectMilestone.deleteMany();
  await db.projectParticipatingDepartment.deleteMany();
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
  await db.principal.deleteMany();
  await db.roleDefinition.deleteMany();
}

type SeededOrg = Awaited<ReturnType<typeof seedPlanningOrg>>;

async function seedPlanningOrg(actor: Principal) {
  await db.principal.create({ data: { id: actor.id, displayName: "Actor" } });
  const org = await organization.createOrganization(actor, {
    name: "Org P5",
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section",
  });
  const deptA = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept A",
  });
  const deptB = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept B",
  });
  const teamA = await organization.createTeam(actor, {
    departmentId: deptA.id,
    name: "Team A",
  });
  const teamB = await organization.createTeam(actor, {
    departmentId: deptB.id,
    name: "Team B",
  });
  const teamA2 = await organization.createTeam(actor, {
    departmentId: deptA.id,
    name: "Team A2",
  });
  const resourceShared = await organization.createResource(actor, {
    organizationId: org.id,
    name: "Shared Dev",
    type: "PERSON",
    capacityHoursPerWeek: 40,
  });
  const resourceA = await organization.createResource(actor, {
    organizationId: org.id,
    name: "Dev A",
    type: "PERSON",
    capacityHoursPerWeek: 40,
  });
  await organization.assignMembership(actor, {
    resourceId: resourceShared.id,
    teamId: teamA.id,
    isPrimary: true,
    allocationPercent: 50,
  });
  await organization.assignMembership(actor, {
    resourceId: resourceShared.id,
    teamId: teamB.id,
    isPrimary: false,
    allocationPercent: 50,
  });
  await organization.assignMembership(actor, {
    resourceId: resourceA.id,
    teamId: teamA.id,
    isPrimary: true,
    allocationPercent: 100,
  });

  return {
    org,
    section,
    deptA,
    deptB,
    teamA,
    teamB,
    teamA2,
    resourceShared,
    resourceA,
  };
}

async function seedProjectWithWork(
  orgId: string,
  departmentId: string,
  opts: {
    name: string;
    workTitles: string[];
    estimateHours?: string;
    participatingDepartmentIds?: string[];
    plannedStart?: Date;
    plannedEnd?: Date;
  },
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
      plannedStart: opts.plannedStart ?? null,
      plannedEnd: opts.plannedEnd ?? null,
      participatingDepartments: opts.participatingDepartmentIds?.length
        ? {
            create: opts.participatingDepartmentIds.map((id) => ({
              departmentId: id,
            })),
          }
        : undefined,
    },
  });
  const workItems = [];
  for (let i = 0; i < opts.workTitles.length; i++) {
    const wi = await db.projectWorkItem.create({
      data: {
        projectId: project.id,
        type: "TASK",
        referenceKey: `WI-${String(i + 1).padStart(3, "0")}`,
        title: opts.workTitles[i]!,
        status: "BACKLOG",
        estimateHours: opts.estimateHours ?? "8",
      },
    });
    workItems.push(wi);
  }
  return { initiative, project, workItems };
}

const PI_START = new Date("2026-01-01T00:00:00.000Z");
const PI_END = new Date("2026-03-31T00:00:00.000Z");
const IT1_START = new Date("2026-01-01T00:00:00.000Z");
const IT1_END = new Date("2026-01-14T00:00:00.000Z");
const IT2_START = new Date("2026-01-15T00:00:00.000Z");
const IT2_END = new Date("2026-01-28T00:00:00.000Z");

async function createPiWithTwoIters(actor: Principal, ctx: SeededOrg) {
  let pi = await planning.createProgramIncrement(actor, {
    organizationId: ctx.org.id,
    sectionId: ctx.section.id,
    name: "PI Q1",
    startDate: PI_START,
    endDate: PI_END,
    planningOwnerName: "Planner",
  });
  const it1 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "Iteration 1",
    sequence: 1,
    startDate: IT1_START,
    endDate: IT1_END,
  });
  const it2 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "Iteration 2",
    sequence: 2,
    startDate: IT2_START,
    endDate: IT2_END,
  });
  pi = await planning.setParticipatingDepartments(actor, {
    piId: pi.id,
    departments: [
      { departmentId: ctx.deptA.id },
      { departmentId: ctx.deptB.id },
    ],
  });
  pi = await planning.setParticipatingTeams(actor, {
    piId: pi.id,
    teams: [
      { teamId: ctx.teamA.id, departmentId: ctx.deptA.id },
      { teamId: ctx.teamB.id, departmentId: ctx.deptB.id },
    ],
  });
  return { pi, it1, it2 };
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

describe("PI create / lifecycle / auth", () => {
  it("creates PI with CURRENT revision and reference key", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const pi = await planning.createProgramIncrement(actor, {
      organizationId: ctx.org.id,
      sectionId: ctx.section.id,
      name: "PI Alpha",
      startDate: PI_START,
      endDate: PI_END,
    });
    expect(pi.referenceKey).toMatch(/^PI-\d{4}$/);
    expect(pi.status).toBe("DRAFT");
    expect(pi.revisions.some((r) => r.key === "CURRENT" && r.isCurrent)).toBe(
      true,
    );

    const listed = await planning.listProgramIncrements(actor, ctx.org.id);
    expect(listed).toHaveLength(1);
  });

  it("transitions DRAFT→PLANNING→REVIEW and rejects invalid jump", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    let pi = await planning.createProgramIncrement(actor, {
      organizationId: ctx.org.id,
      name: "Lifecycle",
      startDate: PI_START,
      endDate: PI_END,
    });
    pi = await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "PLANNING",
      expectedVersion: pi.version,
    });
    expect(pi.status).toBe("PLANNING");
    pi = await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "REVIEW",
      expectedVersion: pi.version,
    });
    expect(pi.status).toBe("REVIEW");

    await expect(
      planning.transitionStatus(actor, {
        piId: pi.id,
        toStatus: "CLOSED",
        expectedVersion: pi.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await expect(
      planning.transitionStatus(actor, {
        piId: pi.id,
        toStatus: "BASELINED",
        expectedVersion: pi.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects unauthorized PI create", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: "Stranger" },
    });
    await expect(
      planning.createProgramIncrement(stranger, {
        organizationId: ctx.org.id,
        name: "Nope",
        startDate: PI_START,
        endDate: PI_END,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Iterations", () => {
  it("accepts ordered iterations and rejects outside PI / overlap", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const pi = await planning.createProgramIncrement(actor, {
      organizationId: ctx.org.id,
      name: "Iters",
      startDate: PI_START,
      endDate: PI_END,
    });
    const it1 = await planning.createIteration(actor, {
      piId: pi.id,
      name: "I1",
      sequence: 1,
      startDate: IT1_START,
      endDate: IT1_END,
    });
    expect(it1.sequence).toBe(1);

    await expect(
      planning.createIteration(actor, {
        piId: pi.id,
        name: "Outside",
        sequence: 2,
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-14"),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await expect(
      planning.createIteration(actor, {
        piId: pi.id,
        name: "Overlap",
        sequence: 2,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-20"),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const it2 = await planning.createIteration(actor, {
      piId: pi.id,
      name: "I2",
      sequence: 2,
      startDate: IT2_START,
      endDate: IT2_END,
    });
    expect(it2.sequence).toBe(2);
  });
});

describe("Participation", () => {
  it("sets departments and teams; rejects invalid team scope", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    let pi = await planning.createProgramIncrement(actor, {
      organizationId: ctx.org.id,
      name: "Part",
      startDate: PI_START,
      endDate: PI_END,
    });

    pi = await planning.setParticipatingDepartments(actor, {
      piId: pi.id,
      departments: [{ departmentId: ctx.deptA.id }],
    });
    expect(pi.participatingDepartments).toHaveLength(1);

    await expect(
      planning.setParticipatingTeams(actor, {
        piId: pi.id,
        teams: [{ teamId: ctx.teamB.id, departmentId: ctx.deptB.id }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    pi = await planning.setParticipatingTeams(actor, {
      piId: pi.id,
      teams: [{ teamId: ctx.teamA.id, departmentId: ctx.deptA.id }],
    });
    expect(pi.participatingTeams).toHaveLength(1);

    // Wrong team/department pairing
    await expect(
      planning.setParticipatingTeams(actor, {
        piId: pi.id,
        teams: [{ teamId: ctx.teamA.id, departmentId: ctx.deptB.id }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("Allocation", () => {
  it("allocates backlog→iter, moves iter→iter and team, rejects stale and duplicate", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi, it1, it2 } = await createPiWithTwoIters(actor, ctx);
    const { workItems } = await seedProjectWithWork(
      ctx.org.id,
      ctx.deptA.id,
      { name: "Delivery", workTitles: ["Task 1", "Task 2"] },
    );

    const backlog = await planning.getBacklog(actor, pi.id);
    expect(backlog.map((w) => w.id).sort()).toEqual(
      workItems.map((w) => w.id).sort(),
    );

    const alloc = await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "16",
    });
    expect(alloc.iterationId).toBe(it1.id);

    const after = await planning.getBacklog(actor, pi.id);
    expect(after.some((w) => w.id === workItems[0]!.id)).toBe(false);

    // Duplicate create path updates existing when no expectedVersion
    const upserted = await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "20",
      expectedVersion: alloc.version,
    });
    expect(upserted.id).toBe(alloc.id);
    expect(upserted.plannedHours.toString()).toBe("20");

    const moved = await planning.moveAllocation(actor, {
      allocationId: upserted.id,
      iterationId: it2.id,
      teamId: ctx.teamB.id,
      expectedVersion: upserted.version,
    });
    expect(moved.iterationId).toBe(it2.id);
    expect(moved.teamId).toBe(ctx.teamB.id);

    await expect(
      planning.moveAllocation(actor, {
        allocationId: moved.id,
        iterationId: it1.id,
        teamId: ctx.teamA.id,
        expectedVersion: upserted.version,
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });

    // Unique constraint: cannot allocate same work item twice as new row
    const count = await db.workAllocation.count({
      where: { workItemId: workItems[0]!.id },
    });
    expect(count).toBe(1);
  });
});

describe("Capacity", () => {
  it("availability, team capacity, multi-team, utilization, overload", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi, it1 } = await createPiWithTwoIters(actor, ctx);
    const { workItems } = await seedProjectWithWork(
      ctx.org.id,
      ctx.deptA.id,
      {
        name: "Heavy",
        workTitles: ["Big"],
        estimateHours: "100",
      },
    );

    await planning.setResourceAvailability(actor, {
      resourceId: ctx.resourceA.id,
      iterationId: it1.id,
      availableHours: "20",
      reductionHours: "0",
    });

    let views = await planning.getCapacityViews(actor, pi.id);
    const teamAIt1 = views.teams.find(
      (t) => t.teamId === ctx.teamA.id && t.iterationId === it1.id,
    );
    // Shared 50% of 40 * ~2 weeks + resourceA override 20
    // weeksBetween(Jan1, Jan14) ≈ 2 → shared on teamA: 40*0.5*2 = 40; resourceA override 20
    expect(teamAIt1!.effectiveCapacityHours).toBeCloseTo(60, 0);

    const teamBIt1 = views.teams.find(
      (t) => t.teamId === ctx.teamB.id && t.iterationId === it1.id,
    );
    // Shared only: 40*0.5*2 = 40
    expect(teamBIt1!.effectiveCapacityHours).toBeCloseTo(40, 0);

    // Multi-team: shared resource capacity is split, not double-counted org-wide
    const sharedOnA = views.resources.find(
      (r) =>
        r.resourceId === ctx.resourceShared.id &&
        r.teamId === ctx.teamA.id &&
        r.iterationId === it1.id,
    );
    const sharedOnB = views.resources.find(
      (r) =>
        r.resourceId === ctx.resourceShared.id &&
        r.teamId === ctx.teamB.id &&
        r.iterationId === it1.id,
    );
    expect(sharedOnA!.allocationPercent).toBe(50);
    expect(sharedOnB!.allocationPercent).toBe(50);
    expect(
      sharedOnA!.effectiveCapacityHours + sharedOnB!.effectiveCapacityHours,
    ).toBeCloseTo(80, 0); // 40 hrs/week * 2 weeks

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "100",
    });

    views = await planning.getCapacityViews(actor, pi.id);
    const overloaded = views.teams.find(
      (t) => t.teamId === ctx.teamA.id && t.iterationId === it1.id,
    );
    expect(overloaded!.band).toBe("overload");
    expect(overloaded!.utilization!).toBeGreaterThan(1);
  });
});

describe("Conflicts", () => {
  it("detects overload and dependency timing; resolve after move", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi, it1, it2 } = await createPiWithTwoIters(actor, ctx);
    const { workItems } = await seedProjectWithWork(
      ctx.org.id,
      ctx.deptA.id,
      {
        name: "Conflict proj",
        workTitles: ["Pred", "Succ"],
        estimateHours: "8",
      },
    );

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "200",
    });
    let conflicts = await planning.deriveConflictsForPi(pi.id);
    expect(conflicts.some((c) => c.type === "TEAM_OVERLOAD")).toBe(true);

    // Successor in earlier iteration than predecessor
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[1]!.id,
      iterationId: it1.id,
      teamId: ctx.teamB.id,
      plannedHours: "8",
    });
    // Move predecessor to it2 so successor (it1) precedes
    const predAlloc = await db.workAllocation.findFirstOrThrow({
      where: { workItemId: workItems[0]!.id },
    });
    await planning.moveAllocation(actor, {
      allocationId: predAlloc.id,
      iterationId: it2.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
      expectedVersion: predAlloc.version,
    });

    await planning.createDependency(actor, {
      organizationId: ctx.org.id,
      type: "DEPENDS_ON",
      criticality: "HIGH",
      sourceType: "WORK_ITEM",
      sourceId: workItems[0]!.id,
      targetType: "WORK_ITEM",
      targetId: workItems[1]!.id,
    });

    conflicts = await planning.deriveConflictsForPi(pi.id);
    expect(conflicts.some((c) => c.type === "DEPENDENCY_TIMING")).toBe(true);

    // Fix: move successor to it2 (same or after predecessor)
    const succAlloc = await db.workAllocation.findFirstOrThrow({
      where: { workItemId: workItems[1]!.id },
    });
    await planning.moveAllocation(actor, {
      allocationId: succAlloc.id,
      iterationId: it2.id,
      teamId: ctx.teamB.id,
      expectedVersion: succAlloc.version,
    });

    conflicts = await planning.deriveConflictsForPi(pi.id);
    expect(conflicts.some((c) => c.type === "DEPENDENCY_TIMING")).toBe(false);
  });
});

describe("Dependencies", () => {
  it("creates, rejects self and duplicate, allows cross-dept", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const projA = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "A",
      workTitles: ["A1"],
    });
    const projB = await seedProjectWithWork(ctx.org.id, ctx.deptB.id, {
      name: "B",
      workTitles: ["B1"],
    });

    const dep = await planning.createDependency(actor, {
      organizationId: ctx.org.id,
      type: "BLOCKS",
      criticality: "MEDIUM",
      sourceType: "WORK_ITEM",
      sourceId: projA.workItems[0]!.id,
      targetType: "WORK_ITEM",
      targetId: projB.workItems[0]!.id,
      ownerName: "Owner",
    });
    expect(dep.id).toBeTruthy();

    await expect(
      planning.createDependency(actor, {
        organizationId: ctx.org.id,
        type: "BLOCKS",
        sourceType: "WORK_ITEM",
        sourceId: projA.workItems[0]!.id,
        targetType: "WORK_ITEM",
        targetId: projA.workItems[0]!.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await expect(
      planning.createDependency(actor, {
        organizationId: ctx.org.id,
        type: "BLOCKS",
        sourceType: "WORK_ITEM",
        sourceId: projA.workItems[0]!.id,
        targetType: "WORK_ITEM",
        targetId: projB.workItems[0]!.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const listed = await planning.listDependencies(actor, ctx.org.id);
    expect(listed).toHaveLength(1);
  });
});

describe("Baseline", () => {
  it("create, unauthorized, immutable, second version, changes since, historical payload", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi, it1, it2 } = await createPiWithTwoIters(actor, ctx);
    const { workItems } = await seedProjectWithWork(
      ctx.org.id,
      ctx.deptA.id,
      { name: "Base proj", workTitles: ["W1"] },
    );

    const alloc = await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "10",
    });

    let current = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    current = await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "PLANNING",
      expectedVersion: current.version,
    });
    await planning.transitionStatus(actor, {
      piId: pi.id,
      toStatus: "REVIEW",
      expectedVersion: current.version,
    });

    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: "Stranger" },
    });
    await expect(
      planning.createBaseline(stranger, { piId: pi.id, label: "Nope" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const baseline = await planning.createBaseline(actor, {
      piId: pi.id,
      label: "v1",
    });
    expect(baseline.versionNumber).toBe(1);
    const payload = baseline.payload as {
      allocations: { workItemId: string; iterationId: string }[];
    };
    expect(payload.allocations[0]?.iterationId).toBe(it1.id);

    const frozenPayload = JSON.stringify(baseline.payload);

    // Mutate live plan
    await planning.moveAllocation(actor, {
      allocationId: alloc.id,
      iterationId: it2.id,
      teamId: ctx.teamA.id,
      expectedVersion: alloc.version,
    });

    const reloaded = await planning.baselines.getBaseline(actor, baseline.id);
    expect(JSON.stringify(reloaded.payload)).toBe(frozenPayload);

    const changes = await planning.getChangesSince(actor, pi.id, baseline.id);
    expect(changes.changes.some((c) => c.kind === "allocation_moved")).toBe(
      true,
    );

    // Rebaseline → version 2; historical v1 unchanged
    const v2 = await planning.createBaseline(actor, {
      piId: pi.id,
      label: "v2",
    });
    expect(v2.versionNumber).toBe(2);
    const stillV1 = await planning.baselines.getBaseline(actor, baseline.id);
    expect(JSON.stringify(stillV1.payload)).toBe(frozenPayload);
    expect(
      (v2.payload as { allocations: { iterationId: string }[] }).allocations[0]
        ?.iterationId,
    ).toBe(it2.id);
  });
});

describe("Security cross-scope", () => {
  it("rejects cross-org PI and allocation access", async () => {
    const actorA = principal();
    const ctxA = await seedPlanningOrg(actorA);
    const { pi } = await createPiWithTwoIters(actorA, ctxA);

    const actorB = principal();
    await db.principal.create({
      data: { id: actorB.id, displayName: "Actor B" },
    });
    // actorA retains platform bootstrap and can create a second org; grant B admin there only
    const orgB = await organization.createOrganization(actorA, {
      name: "Org B",
    });
    await authz.grantOrganizationAdmin(actorB.id, orgB.id);

    await expect(
      planning.getProgramIncrement(actorB, pi.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      planning.setParticipatingDepartments(actorB, {
        piId: pi.id,
        departments: [{ departmentId: ctxA.deptA.id }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      planning.allocateWork(actorB, {
        piId: pi.id,
        workItemId: randomUUID(),
        iterationId: randomUUID(),
        teamId: ctxA.teamA.id,
        plannedHours: "8",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Concurrency", () => {
  it("simultaneous moves on same work item — one wins, one stale", async () => {
    const actor = principal();
    const ctx = await seedPlanningOrg(actor);
    const { pi, it1, it2 } = await createPiWithTwoIters(actor, ctx);
    const { workItems } = await seedProjectWithWork(
      ctx.org.id,
      ctx.deptA.id,
      { name: "Race", workTitles: ["R1"] },
    );
    const alloc = await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });

    const results = await Promise.allSettled([
      planning.moveAllocation(actor, {
        allocationId: alloc.id,
        iterationId: it2.id,
        teamId: ctx.teamA.id,
        expectedVersion: alloc.version,
      }),
      planning.moveAllocation(actor, {
        allocationId: alloc.id,
        iterationId: it2.id,
        teamId: ctx.teamB.id,
        expectedVersion: alloc.version,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason as AppError;
    expect(err.code).toBe("STALE_VERSION");

    const final = await db.workAllocation.findUniqueOrThrow({
      where: { id: alloc.id },
    });
    expect(final.version).toBe(alloc.version + 1);
  });
});
