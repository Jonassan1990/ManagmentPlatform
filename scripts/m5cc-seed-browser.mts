/**
 * M5C-C — Seed Project workspace fixtures for browser QA.
 * Non-destructive upserts on management_platform_m3d_qa (Capacity Org).
 *
 * Usage:
 *   DATABASE_URL=... TEMP_AUTH_PRINCIPAL_ID=... npx tsx scripts/m5cc-seed-browser.mts
 */
import { randomUUID } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, ScopeType } from "@prisma/client";
import { ROLE_KEYS } from "../src/modules/shared/permissions";
import { resetEnvCacheForTests } from "../src/server/env";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
process.env.DATABASE_URL = dbUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? dbUrl;
process.env.ALLOW_DEV_AUTH = "false";
process.env.NODE_ENV = "test";
resetEnvCacheForTests();

const orgId =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5cc-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();

const PAST = new Date("2020-01-15T00:00:00.000Z");
const FUTURE = new Date("2027-06-01T00:00:00.000Z");

async function ensureActorBindings() {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "M5CC QA Actor" },
    update: { displayName: "M5CC QA Actor" },
  });
  const adminRole = await db.roleDefinition.findFirstOrThrow({
    where: { key: ROLE_KEYS.ORGANIZATION_ADMIN },
  });
  const existing = await db.roleBinding.findFirst({
    where: {
      principalId,
      roleDefinitionId: adminRole.id,
      organizationId: orgId,
      scopeType: ScopeType.ORGANIZATION,
      effectiveTo: null,
    },
  });
  if (!existing) {
    await db.roleBinding.create({
      data: {
        id: randomUUID(),
        principalId,
        roleDefinitionId: adminRole.id,
        scopeType: ScopeType.ORGANIZATION,
        organizationId: orgId,
      },
    });
  }
}

async function deleteInitiativeTree(initiativeId: string) {
  await db.projectIssue.deleteMany({
    where: { project: { initiativeId } },
  });
  await db.projectWorkItem.deleteMany({
    where: { project: { initiativeId } },
  });
  await db.projectMilestone.deleteMany({
    where: { project: { initiativeId } },
  });
  await db.projectParticipatingDepartment.deleteMany({
    where: { project: { initiativeId } },
  });
  await db.projectClosure.deleteMany({
    where: { project: { initiativeId } },
  });
  await db.project.deleteMany({ where: { initiativeId } });
  await db.lifecycleTransition.deleteMany({ where: { initiativeId } });
  await db.demand.deleteMany({ where: { initiativeId } });
  await db.risk.deleteMany({ where: { initiativeId } });
  await db.initiative.delete({ where: { id: initiativeId } });
}

async function resetRef(ref: string) {
  const existing = await db.initiative.findFirst({
    where: { organizationId: orgId, referenceKey: ref },
  });
  if (existing) await deleteInitiativeTree(existing.id);
}

async function ensureOwnerResource() {
  let resource = await db.resource.findFirst({
    where: { organizationId: orgId, referenceCode: "M5CC-OWNER" },
  });
  if (!resource) {
    resource = await db.resource.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        name: "M5CC Project Owner",
        type: "PERSON",
        referenceCode: "M5CC-OWNER",
        status: "ACTIVE",
      },
    });
  }
  return resource;
}

async function createInitiativeProject(opts: {
  initRef: string;
  projectRef: string;
  title: string;
  projectName: string;
  departmentId: string;
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
  ownerResourceId?: string | null;
  ownerName?: string | null;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  objectives?: string | null;
  description?: string | null;
}) {
  await resetRef(opts.initRef);
  const initiative = await db.initiative.create({
    data: {
      id: randomUUID(),
      organizationId: orgId,
      departmentId: opts.departmentId,
      referenceKey: opts.initRef,
      title: opts.title,
      requesterName: "M5CC Requester",
      businessOwnerName: opts.ownerName ?? "M5CC Business Owner",
      businessOwnerResourceId: opts.ownerResourceId ?? null,
      currentStage: "PROJECT",
      status: "ACTIVE",
    },
  });
  await db.demand.create({
    data: {
      id: randomUUID(),
      initiativeId: initiative.id,
      problemOpportunity: "Delivery workspace clarity",
      reasonForRequest: "Managers need actionable project overview",
      expectedValue: "Faster delivery decisions",
      affectedAreas: "Portfolio operations",
      urgency: "HIGH",
      strategicAlignment: "Platform UX",
      initialImpact: "Medium",
    },
  });
  const project = await db.project.create({
    data: {
      id: randomUUID(),
      initiativeId: initiative.id,
      organizationId: orgId,
      departmentId: opts.departmentId,
      referenceKey: opts.projectRef,
      name: opts.projectName,
      status: opts.status ?? "ACTIVE",
      ownerResourceId: opts.ownerResourceId ?? null,
      ownerName: opts.ownerName ?? null,
      plannedStart: opts.plannedStart ?? null,
      plannedEnd: opts.plannedEnd ?? null,
      objectives: opts.objectives ?? null,
      description: opts.description ?? null,
      priority: "HIGH",
    },
  });
  return { initiative, project };
}

async function main() {
  await ensureActorBindings();
  const dept = await db.department.findFirstOrThrow({
    where: { section: { organizationId: orgId } },
  });
  const owner = await ensureOwnerResource();

  // 1. Active — healthy-ish with open work
  const active = await createInitiativeProject({
    initRef: "INIT-M5CC-ACTIVE",
    projectRef: "PRJ-M5CC-ACTIVE",
    title: "M5CC Active Delivery",
    projectName: "Active delivery workspace",
    departmentId: dept.id,
    status: "ACTIVE",
    ownerResourceId: owner.id,
    ownerName: "M5CC Project Owner",
    plannedStart: new Date("2026-01-01"),
    plannedEnd: FUTURE,
    objectives: "Ship the delivery workspace for PMs and contributors.",
    description: "Active project with open work and clear ownership.",
  });
  await db.projectMilestone.create({
    data: {
      id: randomUUID(),
      projectId: active.project.id,
      referenceKey: "MS-M5CC-A1",
      title: "Foundation complete",
      status: "COMPLETED",
      criticality: true,
      plannedDate: new Date("2026-02-01"),
      actualDate: new Date("2026-02-01"),
    },
  });
  await db.projectMilestone.create({
    data: {
      id: randomUUID(),
      projectId: active.project.id,
      referenceKey: "MS-M5CC-A2",
      title: "Workspace launch",
      status: "IN_PROGRESS",
      criticality: true,
      plannedDate: FUTURE,
    },
  });
  await db.projectWorkItem.create({
    data: {
      id: randomUUID(),
      projectId: active.project.id,
      referenceKey: "WI-M5CC-A1",
      title: "Polish overview header",
      type: "TASK",
      status: "IN_PROGRESS",
    },
  });
  await db.projectWorkItem.create({
    data: {
      id: randomUUID(),
      projectId: active.project.id,
      referenceKey: "WI-M5CC-A2",
      title: "Archive unused cards",
      type: "TASK",
      status: "DONE",
    },
  });

  // 2. Blocked — active blocker issue
  const blocked = await createInitiativeProject({
    initRef: "INIT-M5CC-BLOCKED",
    projectRef: "PRJ-M5CC-BLOCKED",
    title: "M5CC Blocked Delivery",
    projectName: "Blocked modernization project",
    departmentId: dept.id,
    status: "ACTIVE",
    ownerResourceId: owner.id,
    ownerName: "M5CC Project Owner",
    plannedEnd: FUTURE,
    objectives: "Unblock vendor access before continuing delivery.",
  });
  await db.projectIssue.create({
    data: {
      id: randomUUID(),
      projectId: blocked.project.id,
      organizationId: orgId,
      referenceKey: "ISS-M5CC-BLK",
      title: "Vendor access blocker",
      severity: "HIGH",
      status: "OPEN",
      isBlocker: true,
      description: "External vendor cannot provision environments.",
    },
  });
  await db.projectIssue.create({
    data: {
      id: randomUUID(),
      projectId: blocked.project.id,
      organizationId: orgId,
      referenceKey: "ISS-M5CC-CRIT",
      title: "Security control gap",
      severity: "CRITICAL",
      status: "OPEN",
      isBlocker: false,
    },
  });
  await db.projectWorkItem.create({
    data: {
      id: randomUUID(),
      projectId: blocked.project.id,
      referenceKey: "WI-M5CC-B1",
      title: "Waiting on access",
      type: "TASK",
      status: "READY",
    },
  });

  // 3. Delayed — missed / past-due milestone
  const delayed = await createInitiativeProject({
    initRef: "INIT-M5CC-DELAYED",
    projectRef: "PRJ-M5CC-DELAYED",
    title: "M5CC Delayed Delivery",
    projectName: "Delayed rollout project",
    departmentId: dept.id,
    status: "ACTIVE",
    ownerResourceId: owner.id,
    ownerName: "M5CC Project Owner",
    plannedEnd: PAST,
    objectives: "Recover schedule after missed go-live.",
  });
  await db.projectMilestone.create({
    data: {
      id: randomUUID(),
      projectId: delayed.project.id,
      referenceKey: "MS-M5CC-D1",
      title: "Missed go-live",
      status: "MISSED",
      criticality: true,
      plannedDate: PAST,
    },
  });
  await db.projectMilestone.create({
    data: {
      id: randomUUID(),
      projectId: delayed.project.id,
      referenceKey: "MS-M5CC-D2",
      title: "Past planned checkpoint",
      status: "PLANNED",
      criticality: false,
      plannedDate: PAST,
    },
  });

  // 4. Completed / closed with closure record
  const completed = await createInitiativeProject({
    initRef: "INIT-M5CC-DONE",
    projectRef: "PRJ-M5CC-DONE",
    title: "M5CC Completed Delivery",
    projectName: "Completed delivery project",
    departmentId: dept.id,
    status: "COMPLETED",
    ownerResourceId: owner.id,
    ownerName: "M5CC Project Owner",
    plannedEnd: PAST,
    objectives: "Historical completed delivery.",
  });
  await db.projectMilestone.create({
    data: {
      id: randomUUID(),
      projectId: completed.project.id,
      referenceKey: "MS-M5CC-C1",
      title: "Final release",
      status: "COMPLETED",
      criticality: true,
      plannedDate: PAST,
      actualDate: PAST,
    },
  });
  await db.projectWorkItem.create({
    data: {
      id: randomUUID(),
      projectId: completed.project.id,
      referenceKey: "WI-M5CC-C1",
      title: "Ship release",
      type: "TASK",
      status: "DONE",
    },
  });
  await db.projectClosure.create({
    data: {
      id: randomUUID(),
      projectId: completed.project.id,
      closedAt: new Date("2026-03-20T12:00:00.000Z"),
      closedByPrincipalId: principalId,
      outcome: "DELIVERED",
      summary: "Delivered to production and handed to operations.",
      lessonsLearned: "Surface blockers above the fold earlier.",
      finalDeliveryNote: "Acceptance signed 2026-03-18.",
      readinessSnapshot: { hardBlockers: [], warnings: [] },
    },
  });

  // 5. Cancelled / closed
  const cancelled = await createInitiativeProject({
    initRef: "INIT-M5CC-CAN",
    projectRef: "PRJ-M5CC-CAN",
    title: "M5CC Cancelled Effort",
    projectName: "Cancelled effort project",
    departmentId: dept.id,
    status: "CANCELLED",
    ownerResourceId: owner.id,
    ownerName: "M5CC Project Owner",
    objectives: "Stopped after funding cut.",
  });
  await db.projectClosure.create({
    data: {
      id: randomUUID(),
      projectId: cancelled.project.id,
      closedAt: new Date("2026-02-10T09:00:00.000Z"),
      closedByPrincipalId: principalId,
      outcome: "CANCELLED",
      summary: "Cancelled due to budget reallocation.",
      readinessSnapshot: { hardBlockers: [], warnings: [] },
    },
  });

  // 6. Missing data — no owner, no dates, sparse delivery
  const missing = await createInitiativeProject({
    initRef: "INIT-M5CC-MISS",
    projectRef: "PRJ-M5CC-MISS",
    title: "M5CC Missing Data",
    projectName: "Sparse project shell",
    departmentId: dept.id,
    status: "ACTIVE",
    ownerResourceId: null,
    ownerName: null,
    plannedStart: null,
    plannedEnd: null,
    objectives: null,
    description: null,
  });

  // 7. No project yet (initiative only) — next action → Pilot
  await resetRef("INIT-M5CC-NOPRJ");
  const noProject = await db.initiative.create({
    data: {
      id: randomUUID(),
      organizationId: orgId,
      departmentId: dept.id,
      referenceKey: "INIT-M5CC-NOPRJ",
      title: "M5CC No Project Yet",
      requesterName: "M5CC Requester",
      businessOwnerName: "M5CC Business Owner",
      currentStage: "PILOT",
      status: "ACTIVE",
    },
  });
  await db.demand.create({
    data: {
      id: randomUUID(),
      initiativeId: noProject.id,
      problemOpportunity: "Awaiting conversion",
      reasonForRequest: "Pilot scaled; project not created",
      expectedValue: "Explicit convert",
      affectedAreas: "Delivery",
      urgency: "MEDIUM",
      strategicAlignment: "Platform UX",
      initialImpact: "Low",
    },
  });

  const seed = {
    organizationId: orgId,
    departmentId: dept.id,
    principalId,
    ownerResourceId: owner.id,
    initiatives: {
      active: {
        id: active.initiative.id,
        projectId: active.project.id,
        ref: "INIT-M5CC-ACTIVE",
        projectRef: "PRJ-M5CC-ACTIVE",
      },
      blocked: {
        id: blocked.initiative.id,
        projectId: blocked.project.id,
        ref: "INIT-M5CC-BLOCKED",
        projectRef: "PRJ-M5CC-BLOCKED",
      },
      delayed: {
        id: delayed.initiative.id,
        projectId: delayed.project.id,
        ref: "INIT-M5CC-DELAYED",
        projectRef: "PRJ-M5CC-DELAYED",
      },
      completed: {
        id: completed.initiative.id,
        projectId: completed.project.id,
        ref: "INIT-M5CC-DONE",
        projectRef: "PRJ-M5CC-DONE",
      },
      cancelled: {
        id: cancelled.initiative.id,
        projectId: cancelled.project.id,
        ref: "INIT-M5CC-CAN",
        projectRef: "PRJ-M5CC-CAN",
      },
      missing: {
        id: missing.initiative.id,
        projectId: missing.project.id,
        ref: "INIT-M5CC-MISS",
        projectRef: "PRJ-M5CC-MISS",
      },
      noProject: {
        id: noProject.id,
        projectId: null,
        ref: "INIT-M5CC-NOPRJ",
        projectRef: null,
      },
    },
  };

  fs.writeFileSync(
    path.join(outDir, "seed.json"),
    JSON.stringify(seed, null, 2),
  );
  console.log(JSON.stringify(seed, null, 2));
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
