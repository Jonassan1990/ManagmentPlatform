/**
 * M2E-A Portfolio PI & Capacity Query — dedicated integration suite.
 *
 * Uses the integration Vitest harness (vitest.integration.config.ts) with a
 * full wipe per test. Separate from browser QA seed scripts
 * (scripts/seed-portfolio-ui.mjs / seed-m2d-health-ui.mjs).
 */
import { randomUUID } from "crypto";
import { PrismaClient, ScopeType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { PlanningService } from "@/modules/pi-planning/application/planning-service";
import {
  weeksBetween,
  effectiveResourceCapacity,
} from "@/modules/pi-planning/application/capacity-policy";
import { PortfolioPiCapacityQueryService } from "@/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import { AppError } from "@/modules/shared/errors";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";
process.env.DIRECT_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
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
  return { id, displayName: "M2E-A Tester", source: "test" };
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
  await db.projectIssue.deleteMany();
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
  await db.resourceMembership.deleteMany();
  await db.resource.deleteMany();
  await db.team.deleteMany();
  await db.department.deleteMany();
  await db.section.deleteMany();
  await db.roleBinding.deleteMany();
  await db.bootstrapConsumption.deleteMany();
  await db.externalIdentity.deleteMany();
  await db.organization.deleteMany();
  await db.principal.deleteMany();
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
    name: "M2E-A Org",
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section A",
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
    resourceShared,
    resourceA,
  };
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
    const wi = await db.projectWorkItem.create({
      data: {
        projectId: project.id,
        type: "TASK",
        referenceKey: `WI-${String(i + 1).padStart(3, "0")}`,
        title: opts.workTitles[i]!,
        status: "BACKLOG",
        estimateHours: "8",
      },
    });
    workItems.push(wi);
  }
  return { initiative, project, workItems };
}

beforeAll(async () => {
  await db.$connect();
});

beforeEach(async () => {
  await resetDb();
  await authz.ensureSystemRoles();
});

afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("M2E-A empty / no PI", () => {
  it("empty organization lists zero PIs", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);
    const asOf = new Date("2026-02-01T00:00:00.000Z");
    const list = await piCapacity.listProgramIncrements(admin, {
      organizationId: org.id,
      asOf,
    });
    expect(list.total).toBe(0);
    expect(list.rows).toEqual([]);
    expect(list.asOf).toBe(asOf.toISOString());
  });

  it("capacity without piId returns no_pi_selected", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);
    const result = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: org.id,
    });
    expect(result.capacity.state).toBe("no_pi_selected");
  });
});

describe("M2E-A lifecycle listing", () => {
  it("classifies active / upcoming / completed with deterministic asOf", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const asOf = new Date("2026-06-15T00:00:00.000Z");

    const active = await planning.createProgramIncrement(admin, {
      organizationId: ctx.org.id,
      sectionId: ctx.section.id,
      name: "Active PI",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T00:00:00.000Z"),
      planningOwnerName: "P",
    });
    await db.programIncrement.update({
      where: { id: active.id },
      data: { status: "ACTIVE" },
    });

    const upcoming = await planning.createProgramIncrement(admin, {
      organizationId: ctx.org.id,
      sectionId: ctx.section.id,
      name: "Upcoming PI",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-09-30T00:00:00.000Z"),
      planningOwnerName: "P",
    });

    const completed = await planning.createProgramIncrement(admin, {
      organizationId: ctx.org.id,
      sectionId: ctx.section.id,
      name: "Completed PI",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-03-31T00:00:00.000Z"),
      planningOwnerName: "P",
    });
    await db.programIncrement.update({
      where: { id: completed.id },
      data: { status: "CLOSED" },
    });

    const all = await piCapacity.listProgramIncrements(admin, {
      organizationId: ctx.org.id,
      asOf,
    });
    expect(all.total).toBe(3);
    const byId = new Map(all.rows.map((r) => [r.piId, r]));
    expect(byId.get(active.id)?.lifecycle).toBe("ACTIVE");
    expect(byId.get(upcoming.id)?.lifecycle).toBe("UPCOMING");
    expect(byId.get(completed.id)?.lifecycle).toBe("COMPLETED");

    const onlyUpcoming = await piCapacity.listProgramIncrements(admin, {
      organizationId: ctx.org.id,
      asOf,
      lifecycle: ["UPCOMING"],
    });
    expect(onlyUpcoming.total).toBe(1);
    expect(onlyUpcoming.rows[0]?.piId).toBe(upcoming.id);
  });
});

describe("M2E-A capacity hours", () => {
  it("computes available/committed/remaining with shared membership + overload/under", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi, it1 } = await createPiWithTwoIters(admin, ctx);

    const weeks = weeksBetween(IT1_START, IT1_END);
    expect(weeks).toBeCloseTo(2, 5);

    const teamAAvailIt1 =
      effectiveResourceCapacity({
        capacityHoursPerWeek: 40,
        allocationPercent: 100,
        startDate: IT1_START,
        endDate: IT1_END,
      }) +
      effectiveResourceCapacity({
        capacityHoursPerWeek: 40,
        allocationPercent: 50,
        startDate: IT1_START,
        endDate: IT1_END,
      });
    // 80 + 40 = 120
    expect(teamAAvailIt1).toBe(120);

    const projA = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Project Alpha",
      workTitles: ["A1", "A2"],
    });
    const projB = await seedProjectWithWork(ctx.org.id, ctx.deptB.id, {
      name: "Project Beta",
      workTitles: ["B1"],
    });

    // Overload Team A it1: commit 200 > 120
    await planning.allocateWork(admin, {
      piId: pi.id,
      workItemId: projA.workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      resourceId: ctx.resourceA.id,
      plannedHours: "200",
    });
    // Underutilize Team B it1: commit 10 of ~40
    await planning.allocateWork(admin, {
      piId: pi.id,
      workItemId: projB.workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamB.id,
      resourceId: ctx.resourceShared.id,
      plannedHours: "10",
    });
    // Second project on Team A it2 for multi-project commitments
    await planning.allocateWork(admin, {
      piId: pi.id,
      workItemId: projA.workItems[1]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "5",
    });

    const overview = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
      asOf: new Date("2026-01-10T00:00:00.000Z"),
    });
    expect(overview.capacity.state).toBe("ready");
    if (overview.capacity.state !== "ready") return;

    expect(overview.capacity.meta.revision.isCurrent).toBe(true);
    expect(overview.capacity.meta.source).toBe("live_capacity_policy");

    const teamAIt1 = overview.capacity.teams.find(
      (t) => t.teamId === ctx.teamA.id && t.iterationId === it1.id,
    );
    expect(teamAIt1).toBeDefined();
    expect(teamAIt1!.availableHours).toBe(120);
    expect(teamAIt1!.committedHours).toBe(205);
    expect(teamAIt1!.remainingHours).toBe(120 - 205);
    expect(teamAIt1!.band).toBe("overload");

    const teamBIt1 = overview.capacity.teams.find(
      (t) => t.teamId === ctx.teamB.id && t.iterationId === it1.id,
    );
    expect(teamBIt1!.availableHours).toBe(40);
    expect(teamBIt1!.committedHours).toBe(10);
    expect(teamBIt1!.band).toBe("under");

    expect(
      overview.capacity.overloadedTeams.some((t) => t.teamId === ctx.teamA.id),
    ).toBe(true);
    expect(
      overview.capacity.underutilizedTeams.some(
        (t) => t.teamId === ctx.teamB.id,
      ),
    ).toBe(true);

    expect(overview.capacity.departments.length).toBe(2);
    const deptA = overview.capacity.departments.find(
      (d) => d.departmentId === ctx.deptA.id,
    );
    expect(deptA).toBeDefined();
    expect(deptA!.committedHours).toBeGreaterThan(0);

    expect(overview.capacity.projectCommitments.length).toBe(2);
    const alpha = overview.capacity.projectCommitments.find(
      (p) => p.projectId === projA.project.id,
    );
    expect(alpha!.committedHours).toBe(205);
    expect(alpha!.workItemCount).toBe(2);

    expect(overview.capacity.resources.total).toBeGreaterThan(0);
    const sharedRows = overview.capacity.resources.rows.filter(
      (r) => r.resourceId === ctx.resourceShared.id,
    );
    expect(sharedRows.length).toBeGreaterThan(0);
    expect(sharedRows[0]!.membershipAllocationPercent).toBe(50);

    // M5E-A: per-resource project segments from CURRENT WorkAllocation hours.
    const withSegments = overview.capacity.resources.rows.filter(
      (r) => r.projectSegments.length > 0,
    );
    expect(withSegments.length).toBeGreaterThan(0);
    const segHours = withSegments[0]!.projectSegments.reduce(
      (n, s) => n + s.committedHours,
      0,
    );
    expect(segHours).toBeGreaterThan(0);
    expect(segHours).toBeLessThanOrEqual(
      withSegments[0]!.committedHours + 0.001,
    );

    expect(overview.capacity.conflicts.length).toBeGreaterThan(0);
    expect(
      overview.capacity.conflicts.some((c) => c.type.includes("OVERLOAD")),
    ).toBe(true);

    expect(overview.capacity.baselineComparison.available).toBe(false);
    expect(overview.capacity.dataQuality.missingCapacityInputs).toBe(false);
  });

  it("applies ResourceAvailability override", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi, it1 } = await createPiWithTwoIters(admin, ctx);

    await planning.setResourceAvailability(admin, {
      resourceId: ctx.resourceA.id,
      iterationId: it1.id,
      availableHours: "20",
    });

    const overview = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(overview.capacity.state).toBe("ready");
    if (overview.capacity.state !== "ready") return;

    const res = overview.capacity.resources.rows.find(
      (r) =>
        r.resourceId === ctx.resourceA.id && r.iterationId === it1.id,
    );
    expect(res!.availableHours).toBe(20);
    expect(res!.committedHours).toBe(0);
    expect(res!.remainingHours).toBe(20);
  });

  it("distinguishes valid zero from unavailable and missing inputs", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi } = await createPiWithTwoIters(admin, ctx);

    // Zero load → ready with 0 committed (not unavailable)
    const zeroLoad = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(zeroLoad.capacity.state).toBe("ready");
    if (zeroLoad.capacity.state === "ready") {
      expect(zeroLoad.capacity.totals.committedHours).toBe(0);
      expect(zeroLoad.capacity.totals.availableHours).toBeGreaterThan(0);
    }

    // No participating teams → unavailable
    await planning.setParticipatingTeams(admin, {
      piId: pi.id,
      teams: [],
    });
    const noTeams = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(noTeams.capacity.state).toBe("unavailable");
    if (noTeams.capacity.state === "unavailable") {
      expect(noTeams.capacity.reason.toLowerCase()).toMatch(/participating/);
    }

    // Restore teams; wipe revision → unavailable
    await planning.setParticipatingTeams(admin, {
      piId: pi.id,
      teams: [
        { teamId: ctx.teamA.id, departmentId: ctx.deptA.id },
        { teamId: ctx.teamB.id, departmentId: ctx.deptB.id },
      ],
    });
    await db.workAllocation.deleteMany();
    await db.planningRevision.deleteMany({ where: { piId: pi.id } });
    const noRev = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(noRev.capacity.state).toBe("unavailable");

  });

  it("flags missing capacityHoursPerWeek in dataQuality while keeping zero hours", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi, it1 } = await createPiWithTwoIters(admin, ctx);
    await db.resource.update({
      where: { id: ctx.resourceA.id },
      data: { capacityHoursPerWeek: null },
    });
    const missing = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(missing.capacity.state).toBe("ready");
    if (missing.capacity.state === "ready") {
      expect(missing.capacity.dataQuality.missingCapacityInputs).toBe(true);
      const row = missing.capacity.resources.rows.find(
        (r) =>
          r.resourceId === ctx.resourceA.id && r.iterationId === it1.id,
      );
      expect(row!.availableHours).toBe(0);
    }
  });
});

describe("M2E-A revision vs baseline", () => {
  it("compares live CURRENT revision to approved baseline without mixing", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi, it1 } = await createPiWithTwoIters(admin, ctx);
    const proj = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "Baseline Proj",
      workTitles: ["W1"],
    });

    await planning.allocateWork(admin, {
      piId: pi.id,
      workItemId: proj.workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "40",
    });

    // Move DRAFT → PLANNING → REVIEW for first baseline
    let current = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    current = await planning.transitionStatus(admin, {
      piId: pi.id,
      toStatus: "PLANNING",
      expectedVersion: current.version,
    });
    await planning.transitionStatus(admin, {
      piId: pi.id,
      toStatus: "REVIEW",
      expectedVersion: current.version,
    });

    const { promoteApproveAndBaseline } = await import(
      "./helpers/m3d-approve-baseline"
    );
    const { baseline } = await promoteApproveAndBaseline(planning, db, admin, {
      piId: pi.id,
      label: "v1",
    });
    expect(baseline.versionNumber).toBe(1);

    // Change live allocation after baseline
    const alloc = await db.workAllocation.findFirstOrThrow({
      where: { workItemId: proj.workItems[0]!.id },
    });
    await planning.allocateWork(admin, {
      piId: pi.id,
      workItemId: proj.workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "70",
      expectedVersion: alloc.version,
    });

    const overview = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(overview.capacity.state).toBe("ready");
    if (overview.capacity.state !== "ready") return;

    expect(overview.capacity.meta.revision.isCurrent).toBe(true);
    expect(overview.capacity.totals.committedHours).toBe(70);
    expect(overview.capacity.baselineComparison.available).toBe(true);
    if (overview.capacity.baselineComparison.available) {
      expect(overview.capacity.baselineComparison.baselineCommittedHours).toBe(
        40,
      );
      expect(overview.capacity.baselineComparison.liveCommittedHours).toBe(70);
      expect(overview.capacity.baselineComparison.deltaHours).toBe(30);
      expect(overview.capacity.baselineComparison.versionNumber).toBe(1);
    }

    // Unrecognized schema → unavailable comparison (not invented)
    await db.piBaseline.update({
      where: { id: baseline.id },
      data: { payload: { schemaVersion: 99 } },
    });
    const bad = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(bad.capacity.state).toBe("ready");
    if (bad.capacity.state === "ready") {
      expect(bad.capacity.baselineComparison.available).toBe(false);
      expect(bad.capacity.totals.committedHours).toBe(70);
    }
  });
});

describe("M2E-A authorization isolation", () => {
  it("denies cross-organization access", async () => {
    const admin = principal();
    const { org: orgA } = await seedOrg(admin);
    const outsider = principal();
    await db.principal.create({
      data: { id: outsider.id, displayName: "Outsider" },
    });
    const orgB = await organization.createOrganization(admin, {
      name: "Other Org",
    });
    await bindRole(admin, outsider.id, ROLE_KEYS.VIEWER, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: orgB.id,
      scopeId: orgB.id,
    });

    await expect(
      piCapacity.listProgramIncrements(outsider, {
        organizationId: orgA.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("department filter isolates sibling departments", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi } = await createPiWithTwoIters(admin, ctx);

    const deptOnly = await piCapacity.getPiCapacityOverview(admin, {
      organizationId: ctx.org.id,
      piId: pi.id,
      departmentId: ctx.deptA.id,
    });
    expect(deptOnly.capacity.state).toBe("ready");
    if (deptOnly.capacity.state !== "ready") return;
    expect(
      deptOnly.capacity.teams.every((t) => t.departmentId === ctx.deptA.id),
    ).toBe(true);
    expect(
      deptOnly.capacity.departments.every(
        (d) => d.departmentId === ctx.deptA.id,
      ),
    ).toBe(true);

    const mgr = principal();
    await db.principal.create({
      data: { id: mgr.id, displayName: "DeptMgr" },
    });
    await bindRole(admin, mgr.id, ROLE_KEYS.DEPARTMENT_MANAGER, {
      scopeType: ScopeType.DEPARTMENT,
      organizationId: ctx.org.id,
      scopeId: ctx.deptA.id,
    });

    // Department manager lacks SECTION PI_VIEW → cannot view section-scoped PI
    await expect(
      piCapacity.getPiCapacityOverview(mgr, {
        organizationId: ctx.org.id,
        piId: pi.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("viewer with org scope can read capacity", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi } = await createPiWithTwoIters(admin, ctx);

    const viewer = principal();
    await db.principal.create({
      data: { id: viewer.id, displayName: "Viewer" },
    });
    await bindRole(admin, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: ctx.org.id,
      scopeId: ctx.org.id,
    });

    const list = await piCapacity.listProgramIncrements(viewer, {
      organizationId: ctx.org.id,
    });
    expect(list.total).toBe(1);

    const overview = await piCapacity.getPiCapacityOverview(viewer, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(overview.capacity.state).toBe("ready");
  });

  it("section manager cannot expand into sibling org via sectionId", async () => {
    const admin = principal();
    const ctxA = await seedOrg(admin);
    const { pi } = await createPiWithTwoIters(admin, ctxA);

    const adminB = principal();
    await db.principal.create({
      data: { id: adminB.id, displayName: "AdminB" },
    });
    await authz.ensureBootstrapBinding(adminB.id);
    // Already have orgs — bootstrap won't grant. Give org admin on new org via admin.
    const orgB = await organization.createOrganization(admin, {
      name: "Org B",
    });
    await bindRole(admin, adminB.id, ROLE_KEYS.ORGANIZATION_ADMIN, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: orgB.id,
      scopeId: orgB.id,
    });

    await expect(
      piCapacity.getPiCapacityOverview(adminB, {
        organizationId: ctxA.org.id,
        piId: pi.id,
        sectionId: ctxA.section.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("team manager without section/org PI_VIEW cannot read section-scoped PI", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi } = await createPiWithTwoIters(admin, ctx);

    const tm = principal();
    await db.principal.create({
      data: { id: tm.id, displayName: "TeamMgr" },
    });
    await bindRole(admin, tm.id, ROLE_KEYS.TEAM_MANAGER, {
      scopeType: ScopeType.TEAM,
      organizationId: ctx.org.id,
      scopeId: ctx.teamA.id,
    });

    // Portfolio visibility exists (team→department), but PI_VIEW on SECTION fails.
    await expect(
      piCapacity.getPiCapacityOverview(tm, {
        organizationId: ctx.org.id,
        piId: pi.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("section manager reads PI capacity within section", async () => {
    const admin = principal();
    const ctx = await seedOrg(admin);
    const { pi } = await createPiWithTwoIters(admin, ctx);

    const sm = principal();
    await db.principal.create({
      data: { id: sm.id, displayName: "SectionMgr" },
    });
    await bindRole(admin, sm.id, ROLE_KEYS.SECTION_MANAGER, {
      scopeType: ScopeType.SECTION,
      organizationId: ctx.org.id,
      scopeId: ctx.section.id,
    });

    const overview = await piCapacity.getPiCapacityOverview(sm, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    expect(overview.capacity.state).toBe("ready");
  });
});
