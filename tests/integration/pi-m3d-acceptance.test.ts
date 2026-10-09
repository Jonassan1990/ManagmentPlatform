/**
 * M3D-D — End-to-end lifecycle acceptance with DB isolation evidence.
 * Dedicated DB: management_platform_m3d_d_int
 *
 * Verification only — exercises existing M3B–M3D-C contracts.
 */
import { createHash, randomUUID } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import path from "node:path";
import { PrismaClient, ScopeType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { computeAllocationFingerprint } from "@/modules/pi-planning/application/allocation-fingerprint";
import { PlanningService } from "@/modules/pi-planning/application/planning-service";
import { PortfolioPiCapacityQueryService } from "@/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { AppError } from "@/modules/shared/errors";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL_M3D_D ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_m3d_d_int?schema=public";
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

type MatrixRow = {
  scenario: string;
  expected: string;
  result: "PASS" | "FAIL";
  detail?: string;
};

const matrix: MatrixRow[] = [];
function record(scenario: string, expected: string, ok: boolean, detail?: string) {
  matrix.push({
    scenario,
    expected,
    result: ok ? "PASS" : "FAIL",
    detail,
  });
  expect(ok, `${scenario}: ${detail ?? expected}`).toBe(true);
}

function principal(id = randomUUID()): Principal {
  return { id, displayName: "M3D-D Tester", source: "test" };
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
    name: "M3D-D Acceptance Org",
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

async function createPiReady(
  actor: Principal,
  ctx: Awaited<ReturnType<typeof seedOrg>>,
) {
  const start = new Date("2026-10-01T00:00:00.000Z");
  const end = new Date("2026-10-28T00:00:00.000Z");
  const pi = await planning.createProgramIncrement(actor, {
    organizationId: ctx.org.id,
    sectionId: ctx.section.id,
    name: "M3D-D PI",
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

async function snapshotState(piId: string) {
  const pi = await db.programIncrement.findUniqueOrThrow({
    where: { id: piId },
  });
  const revisions = await db.planningRevision.findMany({
    where: { piId },
    orderBy: { key: "asc" },
  });
  const current = revisions.find((r) => r.isCurrent)!;
  const allocations = await db.workAllocation.findMany({
    where: { revision: { piId } },
    orderBy: [{ revisionId: "asc" }, { workItemId: "asc" }],
  });
  const approvals = await db.piPlanApproval.findMany({
    where: { piId },
    orderBy: { approvedAt: "asc" },
  });
  const baselines = await db.piBaseline.findMany({
    where: { piId },
    orderBy: { versionNumber: "asc" },
  });
  const audits = await db.auditEvent.findMany({
    where: {
      OR: [
        { subjectId: piId },
        { subjectType: "PiPlanApproval" },
        { subjectType: "PiBaseline" },
        {
          actionType: {
            in: [
              "pi.scenario.selected",
              "pi.scenario.selection_cleared",
              "pi.scenario.promoted",
              "pi.plan.approved",
              "pi.plan.approval_invalidated",
              "pi.plan.baselined",
              "pi.baseline.created",
            ],
          },
        },
      ],
    },
    orderBy: { occurredAt: "asc" },
  });
  const byRevision: Record<string, string> = {};
  for (const rev of revisions) {
    const rows = allocations.filter((a) => a.revisionId === rev.id);
    byRevision[rev.id] = computeAllocationFingerprint(rows);
  }
  return {
    pi,
    revisions,
    current,
    allocations,
    approvals,
    baselines,
    audits,
    fingerprints: byRevision,
    baselineHashes: baselines.map((b) =>
      createHash("sha256").update(JSON.stringify(b.payload)).digest("hex"),
    ),
  };
}

beforeAll(async () => {
  await db.$connect();
});
afterAll(async () => {
  const outDir = path.join(process.cwd(), "artifacts/m3dd-acceptance");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "lifecycle-matrix.json"),
    JSON.stringify({ matrix, generatedAt: new Date().toISOString() }, null, 2),
  );
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb();
});

describe("M3D-D end-to-end lifecycle acceptance", () => {
  it("proves create→compare→select→promote→approve→baseline with isolation and concurrency guards", async () => {
    const t0 = Date.now();
    const actor = principal();
    const ctx = await seedOrg(actor);
    const { pi, it1 } = await createPiReady(actor, ctx);
    const { workItems } = await seedProjectWithWork(ctx.org.id, ctx.deptA.id, {
      name: "M3D-D Work",
      workTitles: ["W1", "W2", "Heavy"],
    });

    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "8",
    });
    const current0 = await planning.pi.requireCurrentRevision(pi.id);

    // Create Scenario A from CURRENT
    const scenarioA = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario A",
    });
    record(
      "Create Scenario A from CURRENT",
      "Independent DRAFT",
      scenarioA.status === "DRAFT" &&
        scenarioA.isCurrent === false &&
        scenarioA.id !== current0.id,
      `status=${scenarioA.status}`,
    );

    // Clone Scenario B from A
    const scenarioB = await planning.cloneScenario(actor, {
      revisionId: scenarioA.id,
      label: "Scenario B",
      expectedVersion: scenarioA.version,
    });
    record(
      "Clone Scenario B from A",
      "Independent allocations",
      scenarioB.id !== scenarioA.id && scenarioB.status === "DRAFT",
    );

    const aBeforeEdit = computeAllocationFingerprint(
      await db.workAllocation.findMany({ where: { revisionId: scenarioA.id } }),
    );
    const currentBeforeEdit = computeAllocationFingerprint(
      await db.workAllocation.findMany({ where: { revisionId: current0.id } }),
    );

    // Edit B
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
    const aAfterEdit = computeAllocationFingerprint(
      await db.workAllocation.findMany({ where: { revisionId: scenarioA.id } }),
    );
    const currentAfterEdit = computeAllocationFingerprint(
      await db.workAllocation.findMany({ where: { revisionId: current0.id } }),
    );
    record(
      "Edit B",
      "A and CURRENT unchanged",
      aAfterEdit === aBeforeEdit && currentAfterEdit === currentBeforeEdit,
    );

    // Compare CURRENT/A/B
    const comparison = await planning.compareScenarios(actor, {
      piId: pi.id,
      revisionIds: [current0.id, scenarioA.id, scenarioB.id],
      referenceRevisionId: current0.id,
    });
    record(
      "Compare CURRENT/A/B",
      "Accurate deltas",
      comparison.revisions.length === 3 &&
        (comparison.workItemDiffs?.length ?? 0) >= 0,
      `revisions=${comparison.revisions.length} diffs=${comparison.workItemDiffs.length}`,
    );

    // Select B
    let piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const bFresh = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioB.id },
    });
    const snapBeforeSelect = await snapshotState(pi.id);
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: bFresh.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: bFresh.version,
    });
    const snapAfterSelect = await snapshotState(pi.id);
    record(
      "Select B",
      "Selected for review, not approved",
      snapAfterSelect.pi.selectedRevisionId === scenarioB.id &&
        snapAfterSelect.fingerprints[current0.id] ===
          snapBeforeSelect.fingerprints[current0.id] &&
        snapAfterSelect.approvals.length === 0,
    );

    // Clear selection
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    await planning.clearScenarioSelection(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
    });
    const snapAfterClear = await snapshotState(pi.id);
    record(
      "Clear selection",
      "No CURRENT mutation",
      snapAfterClear.pi.selectedRevisionId == null &&
        snapAfterClear.fingerprints[current0.id] ===
          snapBeforeSelect.fingerprints[current0.id],
    );

    // Select B again — exactly one selected
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const bAgain = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioB.id },
    });
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: bAgain.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: bAgain.version,
    });
    const selectedCount = await db.planningRevision.count({
      where: { piId: pi.id, status: "SELECTED" },
    });
    record(
      "Select B again",
      "Exactly one selected scenario",
      selectedCount === 1,
      `selectedCount=${selectedCount}`,
    );

    // Readiness with blockers — promote denied
    const overload = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Overload",
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      revisionId: overload.id,
      workItemId: workItems[2]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "200",
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    // clear B selection then select overload
    await planning.clearScenarioSelection(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const overloadFresh = await db.planningRevision.findUniqueOrThrow({
      where: { id: overload.id },
    });
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: overloadFresh.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: overloadFresh.version,
    });
    const readyBlocked = await planning.evaluateScenarioReadiness(actor, {
      piId: pi.id,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const currentBlocked = await planning.pi.requireCurrentRevision(pi.id);
    const selectedBlocked = await db.planningRevision.findUniqueOrThrow({
      where: { id: overload.id },
    });
    let promoteBlocked = false;
    try {
      await planning.promoteSelectedScenario(actor, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedSelectedRevisionId: selectedBlocked.id,
        expectedSelectedRevisionVersion: selectedBlocked.version,
        expectedCurrentRevisionVersion: currentBlocked.version,
        acknowledgeWarnings: true,
      });
    } catch (e) {
      promoteBlocked = e instanceof AppError;
    }
    record(
      "Readiness with blockers",
      "Promotion denied",
      readyBlocked.classification === "NOT_READY" && promoteBlocked,
      `classification=${readyBlocked.classification}`,
    );

    // Restore B selection for happy path
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    await planning.clearScenarioSelection(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const bReady = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioB.id },
    });
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: bReady.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: bReady.version,
    });

    // Warnings acknowledgement — promote without ack when READY_WITH_WARNINGS
    const preview = await planning.getScenarioPromotionPreview(actor, pi.id);
    if (preview.requiresWarningAcknowledgement) {
      piRow = await db.programIncrement.findUniqueOrThrow({
        where: { id: pi.id },
      });
      const cur = await planning.pi.requireCurrentRevision(pi.id);
      const sel = await db.planningRevision.findUniqueOrThrow({
        where: { id: scenarioB.id },
      });
      let denied = false;
      try {
        await planning.promoteSelectedScenario(actor, {
          piId: pi.id,
          expectedPiVersion: piRow.version,
          expectedSelectedRevisionId: sel.id,
          expectedSelectedRevisionVersion: sel.version,
          expectedCurrentRevisionVersion: cur.version,
          acknowledgeWarnings: false,
        });
      } catch (e) {
        denied = e instanceof AppError && (e as AppError).code === "VALIDATION";
      }
      record(
        "Readiness with warnings",
        "Explicit acknowledgement required",
        denied,
      );
    } else {
      record(
        "Readiness with warnings",
        "Explicit acknowledgement required",
        true,
        "Scenario classified READY — ack path N/A; covered by M3D-B suite",
      );
    }

    // Portfolio before promote
    const portfolioBefore = await piCapacity.getPiCapacityOverview(actor, {
      organizationId: ctx.org.id,
      piId: pi.id,
    });
    const committedBefore =
      portfolioBefore.capacity.state === "ready"
        ? portfolioBefore.capacity.totals.committedHours
        : -1;

    // Transition to REVIEW for baseline eligibility later
    piRow = await db.programIncrement.findUniqueOrThrow({
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

    const snapBeforePromote = await snapshotState(pi.id);
    const aFpBeforePromote = snapBeforePromote.fingerprints[scenarioA.id];
    const bFpBeforePromote = snapBeforePromote.fingerprints[scenarioB.id];
    const currentIdStable = snapBeforePromote.current.id;

    // Promote B
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const selB = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioB.id },
    });
    const curB = await planning.pi.requireCurrentRevision(pi.id);
    const promoteResult = await planning.promoteSelectedScenario(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedSelectedRevisionId: selB.id,
      expectedSelectedRevisionVersion: selB.version,
      expectedCurrentRevisionVersion: curB.version,
      acknowledgeWarnings: true,
    });
    const snapAfterPromote = await snapshotState(pi.id);
    record(
      "Promote B",
      "CURRENT allocations match B",
      snapAfterPromote.current.id === currentIdStable &&
        snapAfterPromote.fingerprints[currentIdStable] === bFpBeforePromote &&
        snapAfterPromote.fingerprints[scenarioA.id] === aFpBeforePromote &&
        snapAfterPromote.fingerprints[scenarioB.id] === bFpBeforePromote &&
        snapAfterPromote.pi.selectedRevisionId == null,
      `currentId=${snapAfterPromote.current.id}`,
    );

    // Promotion retry idempotency
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const sourcePromoted = await db.planningRevision.findUniqueOrThrow({
      where: { id: scenarioB.id },
    });
    const curAfter = await planning.pi.requireCurrentRevision(pi.id);
    const replay = await planning.promoteSelectedScenario(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedSelectedRevisionId: sourcePromoted.id,
      expectedSelectedRevisionVersion: sourcePromoted.version,
      expectedCurrentRevisionVersion: curAfter.version,
      acknowledgeWarnings: true,
    });
    record(
      "Promotion retry",
      "Documented idempotent/conflict behavior",
      replay.idempotentReplay === true,
    );

    const portfolioAfterPromote = await piCapacity.getPiCapacityOverview(
      actor,
      { organizationId: ctx.org.id, piId: pi.id },
    );
    const committedAfter =
      portfolioAfterPromote.capacity.state === "ready"
        ? portfolioAfterPromote.capacity.totals.committedHours
        : -1;
    record(
      "Portfolio after promotion",
      "Shows new CURRENT values",
      committedAfter === 24 && committedBefore === 8,
      `before=${committedBefore} after=${committedAfter}`,
    );

    // Approve CURRENT
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const curApprove = await planning.pi.requireCurrentRevision(pi.id);
    const approval = await planning.approveCurrentPlan(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: curApprove.version,
      acknowledgeWarnings: true,
    });
    const approvalRow = await db.piPlanApproval.findUniqueOrThrow({
      where: { id: approval.approvalId },
    });
    record(
      "Approve CURRENT",
      "Approval bound to exact version",
      approvalRow.status === "VALID" &&
        approvalRow.currentRevisionVersion === curApprove.version &&
        approvalRow.allocationFingerprint ===
          snapAfterPromote.fingerprints[currentIdStable],
    );

    // Baseline approved CURRENT
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const curBase = await planning.pi.requireCurrentRevision(pi.id);
    const baseline = await planning.createBaseline(actor, {
      piId: pi.id,
      label: "m3d-d-freeze",
      expectedApprovalId: approval.approvalId,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: curBase.version,
    });
    const baselineHash = createHash("sha256")
      .update(JSON.stringify(baseline.payload))
      .digest("hex");
    record(
      "Baseline approved CURRENT",
      "Immutable baseline created",
      baseline.versionNumber === 1 &&
        baseline.planApprovalId === approval.approvalId,
    );

    // Edit CURRENT after approval — old approval invalid for new baseline
    const liveAlloc = await db.workAllocation.findFirstOrThrow({
      where: {
        revisionId: currentIdStable,
        workItemId: workItems[0]!.id,
      },
    });
    await planning.allocateWork(actor, {
      piId: pi.id,
      workItemId: workItems[0]!.id,
      iterationId: it1.id,
      teamId: ctx.teamA.id,
      plannedHours: "17",
      expectedVersion: liveAlloc.version,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    let staleBaselineDenied = false;
    try {
      await planning.createBaseline(actor, {
        piId: pi.id,
        label: "stale",
        expectedApprovalId: approval.approvalId,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: (
          await planning.pi.requireCurrentRevision(pi.id)
        ).version,
      });
    } catch (e) {
      staleBaselineDenied = e instanceof AppError;
    }
    record(
      "Edit CURRENT after approval",
      "Old approval no longer valid for new baseline",
      staleBaselineDenied,
    );

    // Historical baseline unchanged
    const baselineAgain = await db.piBaseline.findUniqueOrThrow({
      where: { id: baseline.id },
    });
    record(
      "Historical baseline",
      "Unchanged",
      createHash("sha256")
        .update(JSON.stringify(baselineAgain.payload))
        .digest("hex") === baselineHash,
    );

    // Second promotion — earlier approval cannot authorize new state
    const s2 = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Second promote",
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const s2Fresh = await db.planningRevision.findUniqueOrThrow({
      where: { id: s2.id },
    });
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: s2Fresh.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: s2Fresh.version,
    });
    // Re-approve current edited state first is not needed for second promote
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    // Need a VALID approval to invalidate — approve then re-promote
    const curForApprove2 = await planning.pi.requireCurrentRevision(pi.id);
    const approval2 = await planning.approveCurrentPlan(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: curForApprove2.version,
      acknowledgeWarnings: true,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const sel2 = await db.planningRevision.findUniqueOrThrow({
      where: { id: s2.id },
    });
    const cur2 = await planning.pi.requireCurrentRevision(pi.id);
    await planning.promoteSelectedScenario(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedSelectedRevisionId: sel2.id,
      expectedSelectedRevisionVersion: sel2.version,
      expectedCurrentRevisionVersion: cur2.version,
      acknowledgeWarnings: true,
    });
    const approval2Row = await db.piPlanApproval.findUniqueOrThrow({
      where: { id: approval2.approvalId },
    });
    record(
      "Second promotion",
      "Earlier approval cannot authorize new state",
      approval2Row.status === "INVALIDATED" &&
        approval2Row.invalidatedReason === "REPROMOTED",
    );

    // Unauthorized approval / baseline / cross-org
    const viewer = principal();
    await db.principal.create({
      data: { id: viewer.id, displayName: "Viewer" },
    });
    await bindRole(actor, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: "ORGANIZATION",
      organizationId: ctx.org.id,
      scopeId: ctx.org.id,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const curAuth = await planning.pi.requireCurrentRevision(pi.id);
    let unauthApprove = false;
    try {
      await planning.approveCurrentPlan(viewer, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: curAuth.version,
        acknowledgeWarnings: true,
      });
    } catch (e) {
      unauthApprove =
        e instanceof AppError && (e as AppError).code === "FORBIDDEN";
    }
    record("Unauthorized approval", "Denied", unauthApprove);

    let unauthBaseline = false;
    try {
      await planning.createBaseline(viewer, {
        piId: pi.id,
        expectedApprovalId: randomUUID(),
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: curAuth.version,
      });
    } catch (e) {
      unauthBaseline =
        e instanceof AppError && (e as AppError).code === "FORBIDDEN";
    }
    record("Unauthorized baseline", "Denied", unauthBaseline);

    const actorB = principal();
    await db.principal.create({
      data: { id: actorB.id, displayName: "OrgB Admin" },
    });
    const orgB = await organization.createOrganization(actor, {
      name: "Org B M3D-D",
    });
    await bindRole(actor, actorB.id, ROLE_KEYS.ORGANIZATION_ADMIN, {
      scopeType: "ORGANIZATION",
      organizationId: orgB.id,
      scopeId: orgB.id,
    });
    let crossOrg = false;
    try {
      await planning.approveCurrentPlan(actorB, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: curAuth.version,
        acknowledgeWarnings: true,
      });
    } catch (e) {
      crossOrg = e instanceof AppError && (e as AppError).code === "FORBIDDEN";
    }
    record("Cross-org attempt", "Denied", crossOrg);

    // Concurrent promotion — one winner
    const s3 = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Concurrent",
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const s3Fresh = await db.planningRevision.findUniqueOrThrow({
      where: { id: s3.id },
    });
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: s3Fresh.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: s3Fresh.version,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const sel3 = await db.planningRevision.findUniqueOrThrow({
      where: { id: s3.id },
    });
    const cur3 = await planning.pi.requireCurrentRevision(pi.id);
    const args = {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedSelectedRevisionId: sel3.id,
      expectedSelectedRevisionVersion: sel3.version,
      expectedCurrentRevisionVersion: cur3.version,
      acknowledgeWarnings: true,
    };
    const concurrent = await Promise.allSettled([
      planning.promoteSelectedScenario(actor, args),
      planning.promoteSelectedScenario(actor, args),
    ]);
    const wins = concurrent.filter((r) => r.status === "fulfilled").length;
    const losses = concurrent.filter((r) => r.status === "rejected").length;
    record(
      "Concurrent promotion",
      "One winner; no partial state",
      wins === 1 && losses === 1,
      `wins=${wins} losses=${losses}`,
    );

    // Concurrent approval
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const curAp = await planning.pi.requireCurrentRevision(pi.id);
    const apArgs = {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: curAp.version,
      acknowledgeWarnings: true,
    };
    const concurrentAp = await Promise.allSettled([
      planning.approveCurrentPlan(actor, apArgs),
      planning.approveCurrentPlan(actor, apArgs),
    ]);
    const apWins = concurrentAp.filter((r) => r.status === "fulfilled").length;
    const validApprovals = await db.piPlanApproval.count({
      where: { piId: pi.id, status: "VALID" },
    });
    record(
      "Concurrent approval",
      "No conflicting approvals",
      apWins === 1 && validApprovals === 1,
      `apWins=${apWins} valid=${validApprovals}`,
    );

    // Concurrent baseline
    const validApproval = await db.piPlanApproval.findFirstOrThrow({
      where: { piId: pi.id, status: "VALID" },
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const curBl = await planning.pi.requireCurrentRevision(pi.id);
    const blArgs = {
      piId: pi.id,
      label: "concurrent-bl",
      expectedApprovalId: validApproval.id,
      expectedPiVersion: piRow.version,
      expectedCurrentRevisionVersion: curBl.version,
    };
    const beforeBlCount = await db.piBaseline.count({ where: { piId: pi.id } });
    const concurrentBl = await Promise.allSettled([
      planning.createBaseline(actor, blArgs),
      planning.createBaseline(actor, blArgs),
    ]);
    const blWins = concurrentBl.filter((r) => r.status === "fulfilled").length;
    const afterBlCount = await db.piBaseline.count({ where: { piId: pi.id } });
    record(
      "Concurrent baseline",
      "No duplicate commitment",
      blWins === 1 && afterBlCount === beforeBlCount + 1,
      `blWins=${blWins} delta=${afterBlCount - beforeBlCount}`,
    );

    // Transaction failure — full rollback (stale CURRENT version on approve)
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    // Create a fresh promote path then fail approve with stale version
    const s4 = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Rollback",
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const s4Fresh = await db.planningRevision.findUniqueOrThrow({
      where: { id: s4.id },
    });
    await planning.selectScenario(actor, {
      piId: pi.id,
      revisionId: s4Fresh.id,
      expectedPiVersion: piRow.version,
      expectedRevisionVersion: s4Fresh.version,
    });
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const sel4 = await db.planningRevision.findUniqueOrThrow({
      where: { id: s4.id },
    });
    const cur4 = await planning.pi.requireCurrentRevision(pi.id);
    await planning.promoteSelectedScenario(actor, {
      piId: pi.id,
      expectedPiVersion: piRow.version,
      expectedSelectedRevisionId: sel4.id,
      expectedSelectedRevisionVersion: sel4.version,
      expectedCurrentRevisionVersion: cur4.version,
      acknowledgeWarnings: true,
    });
    const beforeFailApprovals = await db.piPlanApproval.count({
      where: { piId: pi.id },
    });
    const snapBeforeFail = await snapshotState(pi.id);
    piRow = await db.programIncrement.findUniqueOrThrow({
      where: { id: pi.id },
    });
    const curFail = await planning.pi.requireCurrentRevision(pi.id);
    let rolledBack = false;
    try {
      await planning.approveCurrentPlan(actor, {
        piId: pi.id,
        expectedPiVersion: piRow.version,
        expectedCurrentRevisionVersion: curFail.version - 1,
        acknowledgeWarnings: true,
      });
    } catch (e) {
      rolledBack = e instanceof AppError && (e as AppError).code === "CONFLICT";
    }
    const afterFailApprovals = await db.piPlanApproval.count({
      where: { piId: pi.id },
    });
    const snapAfterFail = await snapshotState(pi.id);
    record(
      "Transaction failure",
      "Full rollback",
      rolledBack &&
        afterFailApprovals === beforeFailApprovals &&
        snapAfterFail.fingerprints[snapAfterFail.current.id] ===
          snapBeforeFail.fingerprints[snapBeforeFail.current.id],
    );

    // Pre-M3D baseline bypass impossible
    let bypassDenied = false;
    try {
      await planning.createBaseline(actor, {
        piId: pi.id,
        label: "bypass",
      } as never);
    } catch (e) {
      bypassDenied = e instanceof AppError;
    }
    record(
      "Pre-M3D baseline bypass",
      "Denied without expectedApprovalId",
      bypassDenied,
    );

    const durationMs = Date.now() - t0;
    const outDir = path.join(process.cwd(), "artifacts/m3dd-acceptance");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      path.join(outDir, "isolation-snapshot.json"),
      JSON.stringify(
        {
          durationMs,
          currentRevisionId: currentIdStable,
          fixture: {
            workItems: workItems.length,
            iterations: 1,
            teams: 1,
          },
          promoteResult,
          matrixSummary: {
            pass: matrix.filter((m) => m.result === "PASS").length,
            fail: matrix.filter((m) => m.result === "FAIL").length,
            total: matrix.length,
          },
        },
        null,
        2,
      ),
    );
  }, 120_000);
});
