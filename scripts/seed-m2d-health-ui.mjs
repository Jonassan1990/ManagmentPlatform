/**
 * Seed deterministic delivery-health fixtures for M2D-B browser QA.
 * Safe to re-run; does not truncate the database.
 *
 * Usage:
 *   DEV_AUTH_PRINCIPAL_ID=<uuid> node scripts/seed-m2d-health-ui.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const principalId = process.env.DEV_AUTH_PRINCIPAL_ID;
if (!principalId) throw new Error("DEV_AUTH_PRINCIPAL_ID required");

const AS_OF_PAST = new Date("2020-01-01T00:00:00.000Z");
const FUTURE = new Date("2027-01-01T00:00:00.000Z");

async function ensureOrgAdminRole() {
  let orgAdmin = await db.roleDefinition.findFirst({
    where: { key: "organization.admin" },
  });
  if (!orgAdmin) {
    orgAdmin = await db.roleDefinition.create({
      data: {
        key: "organization.admin",
        name: "Organization Admin",
        description: "seed",
        permissions: [
          "org.structure.read",
          "org.structure.manage",
          "audit.read",
          "role.manage",
          "initiative.view",
          "initiative.create",
          "initiative.edit",
          "project.view",
          "project.edit",
          "pi.view",
          "governance.view",
          "governance.submit",
        ],
      },
    });
  }
  return orgAdmin;
}

async function ensureInitiative(referenceKey, data) {
  const found = await db.initiative.findFirst({ where: { referenceKey } });
  if (found) return found;
  return db.initiative.create({ data: { referenceKey, ...data } });
}

async function ensureProject(referenceKey, data) {
  const found = await db.project.findFirst({ where: { referenceKey } });
  if (found) return found;
  return db.project.create({ data: { referenceKey, ...data } });
}

async function main() {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "Local Health Tester" },
    update: { displayName: "Local Health Tester" },
  });

  const orgAdmin = await ensureOrgAdminRole();

  let org = await db.organization.findFirst({ where: { name: "M2D Health Org" } });
  if (!org) {
    org = await db.organization.create({
      data: {
        name: "M2D Health Org",
        description: "Seeded for delivery-health dashboard browser journey",
      },
    });
  }

  let section = await db.section.findFirst({
    where: { organizationId: org.id, name: "Delivery" },
  });
  if (!section) {
    section = await db.section.create({
      data: { organizationId: org.id, name: "Delivery" },
    });
  }

  let dept = await db.department.findFirst({
    where: { sectionId: section.id, name: "Platform" },
  });
  if (!dept) {
    dept = await db.department.create({
      data: { sectionId: section.id, name: "Platform" },
    });
  }

  let resource = await db.resource.findFirst({
    where: { organizationId: org.id, name: "Jordan Owner" },
  });
  if (!resource) {
    resource = await db.resource.create({
      data: {
        organizationId: org.id,
        name: "Jordan Owner",
        type: "PERSON",
        referenceCode: "JO-1",
      },
    });
  }

  const existingBind = await db.roleBinding.findFirst({
    where: {
      principalId,
      organizationId: org.id,
      roleDefinitionId: orgAdmin.id,
      effectiveTo: null,
    },
  });
  if (!existingBind) {
    await db.roleBinding.create({
      data: {
        principalId,
        roleDefinitionId: orgAdmin.id,
        scopeType: "ORGANIZATION",
        organizationId: org.id,
        scopeId: org.id,
      },
    });
  }

  const baseInit = {
    organizationId: org.id,
    departmentId: dept.id,
    requesterName: "Requester",
    businessOwnerName: "Jordan Owner",
    businessOwnerResourceId: resource.id,
    currentStage: "PROJECT",
    status: "ACTIVE",
  };

  const initBlocked = await ensureInitiative("M2D-BLK", {
    ...baseInit,
    title: "Blocked modernization",
  });
  const initRisk = await ensureInitiative("M2D-RISK", {
    ...baseInit,
    title: "At-risk rollout",
  });
  const initOk = await ensureInitiative("M2D-OK", {
    ...baseInit,
    title: "On-track delivery",
  });
  const initUnk = await ensureInitiative("M2D-UNK", {
    ...baseInit,
    title: "Unknown schedule",
  });
  const initDone = await ensureInitiative("M2D-DONE", {
    ...baseInit,
    title: "Completed delivery",
  });
  const initCan = await ensureInitiative("M2D-CAN", {
    ...baseInit,
    title: "Cancelled effort",
  });

  const blocked = await ensureProject("M2D-PRJ-BLK", {
    initiativeId: initBlocked.id,
    organizationId: org.id,
    departmentId: dept.id,
    name: "Blocked modernization project",
    status: "ACTIVE",
    plannedEnd: FUTURE,
    ownerResourceId: resource.id,
    ownerName: "Jordan Owner",
  });
  const existingIssue = await db.projectIssue.findFirst({
    where: { projectId: blocked.id, referenceKey: "M2D-ISS-1" },
  });
  if (!existingIssue) {
    await db.projectIssue.create({
      data: {
        projectId: blocked.id,
        organizationId: org.id,
        referenceKey: "M2D-ISS-1",
        title: "Vendor access blocker",
        severity: "HIGH",
        status: "OPEN",
        isBlocker: true,
      },
    });
  }

  const atRisk = await ensureProject("M2D-PRJ-RISK", {
    initiativeId: initRisk.id,
    organizationId: org.id,
    departmentId: dept.id,
    name: "At-risk rollout project",
    status: "ACTIVE",
    plannedEnd: AS_OF_PAST,
    ownerResourceId: resource.id,
  });
  const existingMs = await db.projectMilestone.findFirst({
    where: { projectId: atRisk.id, referenceKey: "M2D-MS-1" },
  });
  if (!existingMs) {
    await db.projectMilestone.create({
      data: {
        projectId: atRisk.id,
        referenceKey: "M2D-MS-1",
        title: "Missed go-live",
        status: "MISSED",
        criticality: true,
        plannedDate: AS_OF_PAST,
      },
    });
  }

  await ensureProject("M2D-PRJ-OK", {
    initiativeId: initOk.id,
    organizationId: org.id,
    departmentId: dept.id,
    name: "On-track delivery project",
    status: "ACTIVE",
    plannedEnd: FUTURE,
    ownerResourceId: resource.id,
  });

  await ensureProject("M2D-PRJ-UNK", {
    initiativeId: initUnk.id,
    organizationId: org.id,
    departmentId: dept.id,
    name: "Unknown schedule project",
    status: "ACTIVE",
    ownerResourceId: resource.id,
  });

  await ensureProject("M2D-PRJ-DONE", {
    initiativeId: initDone.id,
    organizationId: org.id,
    departmentId: dept.id,
    name: "Completed delivery project",
    status: "COMPLETED",
    plannedEnd: AS_OF_PAST,
    ownerResourceId: resource.id,
  });

  await ensureProject("M2D-PRJ-CAN", {
    initiativeId: initCan.id,
    organizationId: org.id,
    departmentId: dept.id,
    name: "Cancelled effort project",
    status: "CANCELLED",
    ownerResourceId: resource.id,
  });

  console.log(
    JSON.stringify(
      {
        orgId: org.id,
        departmentId: dept.id,
        principalId,
        projects: {
          blocked: blocked.id,
          atRisk: atRisk.id,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
