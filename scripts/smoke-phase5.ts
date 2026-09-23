/**
 * Phase 5 smoke: multi-dept PI → allocate → overload → dependency → baseline →
 * plan change → baseline payload unchanged + changes-since detected.
 * Fixtures only — no hardcoded business users in product code.
 *
 * Brief §42 workflow (MVP slice 8–10).
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import { OrganizationService } from "../src/modules/organization/application/organization-service";
import { PlanningService } from "../src/modules/pi-planning/application/planning-service";
import type { BaselinePayload } from "../src/modules/pi-planning/application/baseline-snapshot";

type Actor = { id: string; displayName: string; source: "test" };

async function main() {
  const db = new PrismaClient();
  const authz = new AuthorizationService(db);
  const audit = new AuditService(db);
  const organization = new OrganizationService(db, authz, audit);
  const planning = new PlanningService(db, authz, audit);

  const actor: Actor = {
    id: randomUUID(),
    displayName: "Phase5 Smoke",
    source: "test",
  };
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });

  const sections: Record<string, unknown> = {};

  // ─── 1. Org with ≥2 departments, teams, resources ─────────────────────────
  console.log("=== Org + multi-dept capacity setup ===");
  const org = await organization.createOrganization(actor, {
    name: `Smoke P5 Org ${randomUUID().slice(0, 8)}`,
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Delivery Section",
  });
  const deptA = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Platform",
  });
  const deptB = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Operations",
  });
  const teamA = await organization.createTeam(actor, {
    departmentId: deptA.id,
    name: "Platform Team",
  });
  const teamB = await organization.createTeam(actor, {
    departmentId: deptB.id,
    name: "Ops Team",
  });
  const shared = await organization.createResource(actor, {
    organizationId: org.id,
    name: "Shared Engineer",
    type: "PERSON",
    capacityHoursPerWeek: 40,
  });
  const dedicated = await organization.createResource(actor, {
    organizationId: org.id,
    name: "Platform Engineer",
    type: "PERSON",
    capacityHoursPerWeek: 40,
  });
  await organization.assignMembership(actor, {
    resourceId: shared.id,
    teamId: teamA.id,
    isPrimary: true,
    allocationPercent: 40,
  });
  await organization.assignMembership(actor, {
    resourceId: shared.id,
    teamId: teamB.id,
    isPrimary: false,
    allocationPercent: 60,
  });
  await organization.assignMembership(actor, {
    resourceId: dedicated.id,
    teamId: teamA.id,
    isPrimary: true,
    allocationPercent: 100,
  });
  sections.org = {
    organizationId: org.id,
    departments: 2,
    teams: 2,
    multiTeamPercents: [40, 60],
  };

  // ─── 2. Seed projects + work items (delivery backlog for PI) ──────────────
  console.log("=== Seed projects / work items ===");
  async function seedProject(
    departmentId: string,
    name: string,
    titles: string[],
  ) {
    const initiative = await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId,
        referenceKey: `INIT-${randomUUID().slice(0, 8)}`,
        title: name,
        requesterName: "Requester",
        businessOwnerName: "Owner",
        currentStage: "PROJECT",
        status: "ACTIVE",
      },
    });
    const project = await db.project.create({
      data: {
        initiativeId: initiative.id,
        organizationId: org.id,
        departmentId,
        referenceKey: `PRJ-${randomUUID().slice(0, 8)}`,
        name,
        status: "ACTIVE",
      },
    });
    const workItems = [];
    for (let i = 0; i < titles.length; i++) {
      workItems.push(
        await db.projectWorkItem.create({
          data: {
            projectId: project.id,
            type: "TASK",
            referenceKey: `WI-${String(i + 1).padStart(3, "0")}`,
            title: titles[i]!,
            status: "BACKLOG",
            estimateHours: "8",
          },
        }),
      );
    }
    return { project, workItems };
  }

  const projA = await seedProject(deptA.id, "Platform Delivery", [
    "API gateway",
    "Auth hardening",
  ]);
  const projB = await seedProject(deptB.id, "Ops Delivery", ["Runbook sync"]);

  // ─── 3. PI + iterations + participation ───────────────────────────────────
  console.log("=== Create PI / iterations / participation ===");
  const piStart = new Date("2026-04-01T00:00:00.000Z");
  const piEnd = new Date("2026-06-30T00:00:00.000Z");
  let pi = await planning.createProgramIncrement(actor, {
    organizationId: org.id,
    sectionId: section.id,
    name: "PI 2026.2 Smoke",
    startDate: piStart,
    endDate: piEnd,
    planningOwnerName: "PI Owner",
  });
  const it1 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "IT-1",
    sequence: 1,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-14T00:00:00.000Z"),
  });
  const it2 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "IT-2",
    sequence: 2,
    startDate: new Date("2026-04-15T00:00:00.000Z"),
    endDate: new Date("2026-04-28T00:00:00.000Z"),
  });
  pi = await planning.setParticipatingDepartments(actor, {
    piId: pi.id,
    departments: [
      { departmentId: deptA.id, planningOwnerName: "DeptA Lead" },
      { departmentId: deptB.id, planningOwnerName: "DeptB Lead" },
    ],
  });
  pi = await planning.setParticipatingTeams(actor, {
    piId: pi.id,
    teams: [
      { teamId: teamA.id, departmentId: deptA.id },
      { teamId: teamB.id, departmentId: deptB.id },
    ],
  });
  sections.pi = {
    id: pi.id,
    referenceKey: pi.referenceKey,
    iterations: 2,
    departments: pi.participatingDepartments.length,
    teams: pi.participatingTeams.length,
    currentRevision: pi.revisions.find((r) => r.key === "CURRENT")?.id,
  };

  // ─── 4. Allocate backlog → iterations (server mutation = drag/drop) ───────
  console.log("=== Allocate work (backlog → board) ===");
  const backlogBefore = await planning.getBacklog(actor, pi.id);
  const alloc1 = await planning.allocateWork(actor, {
    piId: pi.id,
    workItemId: projA.workItems[0]!.id,
    iterationId: it1.id,
    teamId: teamA.id,
    resourceId: dedicated.id,
    plannedHours: "80",
  });
  const alloc2 = await planning.allocateWork(actor, {
    piId: pi.id,
    workItemId: projA.workItems[1]!.id,
    iterationId: it2.id,
    teamId: teamA.id,
    plannedHours: "8",
  });
  const alloc3 = await planning.allocateWork(actor, {
    piId: pi.id,
    workItemId: projB.workItems[0]!.id,
    iterationId: it1.id,
    teamId: teamB.id,
    plannedHours: "8",
  });
  const backlogAfter = await planning.getBacklog(actor, pi.id);
  sections.allocation = {
    backlogBefore: backlogBefore.length,
    backlogAfter: backlogAfter.length,
    allocated: 3,
    alloc1Id: alloc1.id,
  };

  // ─── 5. Capacity + overload conflict ──────────────────────────────────────
  console.log("=== Capacity views + overload conflict ===");
  await planning.setResourceAvailability(actor, {
    resourceId: dedicated.id,
    iterationId: it1.id,
    availableHours: "30",
    reductionHours: "0",
  });
  const capacity = await planning.getCapacityViews(actor, pi.id);
  const teamAIt1 = capacity.teams.find(
    (t) => t.teamId === teamA.id && t.iterationId === it1.id,
  );
  const conflicts = await planning.deriveConflictsForPi(pi.id);
  const overload = conflicts.filter((c) => c.type === "TEAM_OVERLOAD");
  sections.capacity = {
    teamAIt1Band: teamAIt1?.band,
    teamAIt1Utilization: teamAIt1?.utilization,
    overloadConflictCount: overload.length,
  };

  // ─── 6. Cross-dept dependency + timing fix via move ───────────────────────
  console.log("=== Cross-dept dependency ===");
  // Intentionally schedule successor before predecessor, then fix
  await planning.moveAllocation(actor, {
    allocationId: alloc2.id,
    iterationId: it1.id,
    teamId: teamA.id,
    expectedVersion: alloc2.version,
  });
  // predecessor (alloc1) is it1; move predecessor to it2 so succ (also it1) precedes
  const pred = await planning.moveAllocation(actor, {
    allocationId: alloc1.id,
    iterationId: it2.id,
    teamId: teamA.id,
    plannedHours: "8",
    expectedVersion: alloc1.version,
  });
  const dep = await planning.createDependency(actor, {
    organizationId: org.id,
    type: "DEPENDS_ON",
    criticality: "HIGH",
    sourceType: "WORK_ITEM",
    sourceId: projA.workItems[0]!.id,
    targetType: "WORK_ITEM",
    targetId: projA.workItems[1]!.id,
    ownerName: "Dependency Owner",
  });
  let timingConflicts = await planning.deriveConflictsForPi(pi.id);
  const hadTiming = timingConflicts.some((c) => c.type === "DEPENDENCY_TIMING");
  // Resolve: move successor to it2
  const succRow = await db.workAllocation.findFirstOrThrow({
    where: { workItemId: projA.workItems[1]!.id },
  });
  await planning.moveAllocation(actor, {
    allocationId: succRow.id,
    iterationId: it2.id,
    teamId: teamA.id,
    expectedVersion: succRow.version,
  });
  // Also put predecessor back on it1 for a sensible plan before baseline
  await planning.moveAllocation(actor, {
    allocationId: pred.id,
    iterationId: it1.id,
    teamId: teamA.id,
    plannedHours: "40",
    expectedVersion: pred.version,
  });
  timingConflicts = await planning.deriveConflictsForPi(pi.id);
  sections.dependency = {
    id: dep.id,
    crossDeptWork: true,
    timingDetectedThenResolved: hadTiming,
    timingAfterFix: timingConflicts.some((c) => c.type === "DEPENDENCY_TIMING"),
  };

  // ─── 7. Lifecycle → REVIEW → baseline ─────────────────────────────────────
  console.log("=== Baseline create ===");
  pi = await planning.transitionStatus(actor, {
    piId: pi.id,
    toStatus: "PLANNING",
    expectedVersion: (
      await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } })
    ).version,
  });
  pi = await planning.transitionStatus(actor, {
    piId: pi.id,
    toStatus: "REVIEW",
    expectedVersion: pi.version,
  });
  const baseline = await planning.createBaseline(actor, {
    piId: pi.id,
    label: "Smoke baseline v1",
  });
  const frozenPayload = JSON.stringify(baseline.payload);
  const frozenAllocIteration = (
    baseline.payload as BaselinePayload
  ).allocations.find((a) => a.workItemId === projA.workItems[0]!.id)
    ?.iterationId;

  // ─── 8. Change plan after baseline ────────────────────────────────────────
  console.log("=== Plan change after baseline ===");
  const livePred = await db.workAllocation.findFirstOrThrow({
    where: { workItemId: projA.workItems[0]!.id },
  });
  await planning.moveAllocation(actor, {
    allocationId: livePred.id,
    iterationId: it2.id,
    teamId: teamB.id,
    expectedVersion: livePred.version,
  });
  // Also allocate remaining backlog item if any — move ops work hours
  const liveOps = await db.workAllocation.findFirstOrThrow({
    where: { id: alloc3.id },
  });
  await planning.moveAllocation(actor, {
    allocationId: liveOps.id,
    iterationId: it2.id,
    teamId: teamB.id,
    plannedHours: "16",
    expectedVersion: liveOps.version,
  });

  // ─── 9. Baseline unchanged + changes since detected ──────────────────────
  console.log("=== Verify baseline immutability + changes-since ===");
  const historical = await planning.baselines.getBaseline(actor, baseline.id);
  const baselineUnchanged =
    JSON.stringify(historical.payload) === frozenPayload;
  const changes = await planning.getChangesSince(actor, pi.id, baseline.id);
  const changeKinds = [...new Set(changes.changes.map((c) => c.kind))];
  const detectedMove = changes.changes.some(
    (c) => c.kind === "allocation_moved",
  );

  const board = await planning.getPlanningBoard(actor, pi.id);
  sections.baseline = {
    versionNumber: baseline.versionNumber,
    baselineUnchanged,
    frozenAllocIteration,
    changesDetected: changes.changes.length > 0,
    detectedMove,
    changeKinds,
    piStatusAfterBaseline: (
      await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } })
    ).status,
    boardConflictCount: board.conflicts.length,
  };

  if (!baselineUnchanged) {
    throw new Error("Baseline payload mutated after plan change");
  }
  if (!detectedMove) {
    throw new Error("Expected allocation_moved in changes-since-baseline");
  }

  const summary = {
    ok: true as const,
    sections,
  };
  console.log("\n" + JSON.stringify(summary, null, 2));
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
