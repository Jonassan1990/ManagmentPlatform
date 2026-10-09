/**
 * M3C-A — Scenario comparison query contract (read-only).
 * Uses dedicated DB: management_platform_m3c_int
 */
import { randomUUID } from "crypto";
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
  process.env.DATABASE_URL_M3C ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_m3c_int?schema=public";
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
  return { id, displayName: "M3C Tester", source: "test" };
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
    name: "M3C Org",
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
const IT2_START = new Date("2026-01-15T00:00:00.000Z");
const IT2_END = new Date("2026-01-28T00:00:00.000Z");

async function createPiReady(actor: Principal, ctx: SeededOrg) {
  let pi = await planning.createProgramIncrement(actor, {
    organizationId: ctx.org.id,
    sectionId: ctx.section.id,
    name: "M3C Compare PI",
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
  const it2 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "IT2",
    sequence: 2,
    startDate: IT2_START,
    endDate: IT2_END,
  });
  pi = await planning.setParticipatingDepartments(actor, {
    piId: pi.id,
    departments: [{ departmentId: ctx.deptA.id }],
  });
  pi = await planning.setParticipatingTeams(actor, {
    piId: pi.id,
    teams: [{ teamId: ctx.teamA.id, departmentId: ctx.deptA.id }],
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

describe("M3C-A compare CURRENT vs Draft / Draft vs Draft / three-way", () => {
  it("compares CURRENT vs draft with hour and project deltas", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems, project } = await seedProjectWithWork(
      ctx.org.id,
      ctx.deptA.id,
      { name: "Proj", workTitles: ["W1", "W2"] },
    );

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "40",
    });
    const current = await planning.pi.requireCurrentRevision(pi.id);
    const draft = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Draft A",
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: draft.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "60",
    });

    const cmp = await planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [current.id, draft.id],
      referenceRevisionId: current.id,
    });

    expect(cmp.revisions).toHaveLength(2);
    expect(cmp.capacityAssumptions.note).toBe("SHARED_PI_CAPACITY_INPUTS");
    const curCol = cmp.totals.find((t) => t.revisionId === current.id)!;
    const draftCol = cmp.totals.find((t) => t.revisionId === draft.id)!;
    expect(curCol.metrics.committedHours).toBe(40);
    expect(draftCol.metrics.committedHours).toBe(60);
    expect(draftCol.deltaFromReference.committedHours).toBe(20);
    expect(curCol.metrics.availableHours).toBe(draftCol.metrics.availableHours);

    const proj = cmp.byProject.find((p) => p.projectId === project.id)!;
    expect(
      proj.columns.find((c) => c.revisionId === draft.id)!.committedHours,
    ).toBe(60);
    expect(
      proj.deltaFromReferenceHours.find((d) => d.revisionId === draft.id)!
        .deltaHours,
    ).toBe(20);

    const hourChange = cmp.workItemDiffs.find(
      (d) => d.workItemId === workItems[0]!.id,
    )!;
    expect(hourChange.change).toBe("hours_changed");
  });

  it("compares draft vs draft and three revisions with add/remove/placement", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1, it2 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Proj2",
      workTitles: ["A", "B", "C"],
    });

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "30",
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[1]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "10",
    });

    const current = await planning.pi.requireCurrentRevision(pi.id);
    const a = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "A",
    });
    const b = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "B",
    });

    // A: change hours on W1, remove W2, add W3
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: a.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "50",
    });
    const aW2 = await db.workAllocation.findFirstOrThrow({
      where: { revisionId: a.id, workItemId: workItems[1]!.id },
    });
    await planning.removeAllocation(actor, {
      allocationId: aW2.id,
      expectedVersion: aW2.version,
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: a.id,
      workItemId: workItems[2]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "5",
    });

    // B: move W1 to IT2
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: b.id,
      workItemId: workItems[0]!.id,
      iterationId: it2.id,
      teamId: ctx.teamA.id,
      plannedHours: "30",
    });

    const draftVsDraft = await planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [a.id, b.id],
      referenceRevisionId: a.id,
    });
    expect(draftVsDraft.revisions.every((r) => r.kind === "SCENARIO")).toBe(
      true,
    );

    const three = await planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [current.id, a.id, b.id],
      referenceRevisionId: current.id,
    });
    expect(three.revisions).toHaveLength(3);
    expect(three.allocationChanges.added.some((d) => d.workItemId === workItems[2]!.id)).toBe(
      true,
    );
    expect(
      three.allocationChanges.removed.some(
        (d) => d.workItemId === workItems[1]!.id,
      ),
    ).toBe(true);
    const placement = three.workItemDiffs.find(
      (d) => d.workItemId === workItems[0]!.id,
    )!;
    expect(
      ["placement_changed", "hours_and_placement_changed", "hours_changed"].includes(
        placement.change,
      ),
    ).toBe(true);
  });
});

describe("M3C-A overload / conflicts / shared capacity / archived", () => {
  it("detects overload differences and shared available capacity", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Overload",
      workTitles: ["Heavy"],
    });

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "40",
    });
    const current = await planning.pi.requireCurrentRevision(pi.id);
    const heavy = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Heavy",
    });
    // IT1 is 14 days inclusive ≈ 2 weeks → 80h available at 40h/wk
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: heavy.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "100",
    });

    const cmp = await planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [current.id, heavy.id],
    });
    expect(cmp.totals[0]!.metrics.availableHours).toBe(
      cmp.totals[1]!.metrics.availableHours,
    );
    expect(cmp.totals[1]!.metrics.overloadedTeamCount).toBeGreaterThan(
      cmp.totals[0]!.metrics.overloadedTeamCount,
    );
    expect(cmp.totals[1]!.metrics.conflictCount).toBeGreaterThanOrEqual(
      cmp.totals[0]!.metrics.conflictCount,
    );
    expect(cmp.byResource.length).toBeGreaterThan(0);
  });

  it("allows archived scenario comparison and treats missing weekly capacity as zero", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Arch",
      workTitles: ["W"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "10",
    });
    const current = await planning.pi.requireCurrentRevision(pi.id);
    const scn = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Soon archived",
    });
    const archived = await planning.archiveScenario(actor, {
      revisionId: scn.id,
      expectedVersion: scn.version,
    });
    expect(archived.status).toBe("ARCHIVED");

    const cmp = await planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [current.id, archived.id],
    });
    expect(cmp.revisions.find((r) => r.id === archived.id)!.status).toBe(
      "ARCHIVED",
    );

    await db.resource.update({
      where: { id: ctx.resourceA.id },
      data: { capacityHoursPerWeek: null },
    });
    const zeroish = await planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [current.id, archived.id],
    });
    expect(zeroish.dataQuality.missingCapacityInputs).toBe(true);
    expect(zeroish.totals[0]!.metrics.availableHours).toBe(0);
  });
});

describe("M3C-A authorization, validation, non-mutation, Portfolio regression", () => {
  it("rejects cross-PI revision, cross-org, and allows viewer", async () => {
    const actor = principal();
    const stranger = principal();
    const viewer = principal();
    const ctx = await seedOrg(actor);
    // Second org created by bootstrap actor (PLATFORM manage persists)
    const orgB = await organization.createOrganization(actor, {
      name: "M3C Org B",
    });
    const sectionB = await organization.createSection(actor, {
      organizationId: orgB.id,
      name: "Section B",
    });
    const deptB = await organization.createDepartment(actor, {
      sectionId: sectionB.id,
      name: "Dept B",
    });
    const teamB = await organization.createTeam(actor, {
      departmentId: deptB.id,
      name: "Team B",
    });
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
    const other = await createPiReady(actor, {
      org: orgB,
      section: sectionB,
      deptA: deptB,
      teamA: teamB,
      resourceA: ctx.resourceA,
    });
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
    const otherCurrent = await planning.pi.requireCurrentRevision(other.pi.id);

    await expect(
      planning.compareScenarios(actor, {
        piId: pi.id,
        revisionIds: [current.id, otherCurrent.id],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      planning.compareScenarios(stranger, {
        piId: pi.id,
        revisionIds: [current.id, draft.id],
      }),
    ).rejects.toBeInstanceOf(AppError);

    const viewerCmp = await planning.compareScenarios(viewer, {
      piId: pi.id,
      revisionIds: [current.id, draft.id],
    });
    expect(viewerCmp.totals).toHaveLength(2);

    const otherDraft = await planning.createScenarioFromCurrent(actor, {
      piId: other.pi.id,
      label: "Other A",
    });
    // Cross-org: stranger with no binding cannot compare other org's PI
    await expect(
      planning.compareScenarios(stranger, {
        piId: other.pi.id,
        revisionIds: [otherCurrent.id, otherDraft.id],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("does not mutate revisions, allocations, or baselines; Portfolio stays CURRENT-only", async () => {
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Immut",
      workTitles: ["W"],
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "40",
    });
    const current = await planning.pi.requireCurrentRevision(pi.id);
    const draft = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Mut",
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: draft.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "55",
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
    const { promoteApproveAndBaseline } = await import(
      "./helpers/m3d-approve-baseline"
    );
    const { baseline } = await promoteApproveAndBaseline(planning, db, actor, {
      piId: pi.id,
      label: "v1",
    });
    const baselinePayloadBefore = baseline.payload;

    const beforeAllocs = await db.workAllocation.findMany({
      orderBy: { id: "asc" },
    });
    const beforeRevisions = await db.planningRevision.findMany({
      orderBy: { id: "asc" },
    });

    await planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [current.id, draft.id],
    });

    const afterAllocs = await db.workAllocation.findMany({
      orderBy: { id: "asc" },
    });
    const afterRevisions = await db.planningRevision.findMany({
      orderBy: { id: "asc" },
    });
    expect(afterAllocs).toEqual(beforeAllocs);
    expect(afterRevisions).toEqual(beforeRevisions);
    const baselineAgain = await db.piBaseline.findUniqueOrThrow({
      where: { id: baseline.id },
    });
    expect(baselineAgain.payload).toEqual(baselinePayloadBefore);

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
