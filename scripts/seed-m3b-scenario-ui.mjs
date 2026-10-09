/**
 * Seed deterministic PI fixtures for M3B scenario browser QA.
 * Safe to re-run; does not truncate the shared browser QA database.
 *
 * Usage:
 *   TEMP_AUTH_PRINCIPAL_ID=<uuid> node scripts/seed-m3b-scenario-ui.mjs
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const db = new PrismaClient();
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID || process.env.DEV_AUTH_PRINCIPAL_ID;
if (!principalId) {
  throw new Error("TEMP_AUTH_PRINCIPAL_ID (or DEV_AUTH_PRINCIPAL_ID) required");
}

const ORG_NAME = "M3B Scenario Org";
const PI_START = new Date("2026-04-01T00:00:00.000Z");
const PI_END = new Date("2026-06-30T00:00:00.000Z");
const IT1_START = new Date("2026-04-01T00:00:00.000Z");
const IT1_END = new Date("2026-04-14T00:00:00.000Z");

const PI_PERMS = [
  "org.structure.read",
  "org.structure.manage",
  "audit.read",
  "role.manage",
  "initiative.view",
  "initiative.create",
  "initiative.edit",
  "project.view",
  "project.edit",
  "project.manage_workitems",
  "pi.view",
  "pi.create",
  "pi.edit",
  "pi.allocate",
  "pi.manage_capacity",
  "pi.transition",
  "pi.review",
  "pi.baseline",
  "governance.view",
];

async function ensureOrgAdminRole() {
  let role = await db.roleDefinition.findFirst({
    where: { key: "organization.admin" },
  });
  if (!role) {
    role = await db.roleDefinition.create({
      data: {
        key: "organization.admin",
        name: "Organization Admin",
        description: "seed",
        permissions: PI_PERMS,
      },
    });
  }
  return role;
}

async function main() {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "M3B Scenario Tester" },
    update: { displayName: "M3B Scenario Tester" },
  });

  const orgAdmin = await ensureOrgAdminRole();

  let org = await db.organization.findFirst({ where: { name: ORG_NAME } });
  if (!org) {
    org = await db.organization.create({
      data: {
        name: ORG_NAME,
        description: "Seeded for M3B scenario board browser QA",
      },
    });
  }

  const binding = await db.roleBinding.findFirst({
    where: {
      principalId,
      roleDefinitionId: orgAdmin.id,
      scopeType: "ORGANIZATION",
      organizationId: org.id,
    },
  });
  if (!binding) {
    await db.roleBinding.create({
      data: {
        principalId,
        roleDefinitionId: orgAdmin.id,
        scopeType: "ORGANIZATION",
        organizationId: org.id,
      },
    });
  }

  let section = await db.section.findFirst({
    where: { organizationId: org.id, name: "M3B Section" },
  });
  if (!section) {
    section = await db.section.create({
      data: { organizationId: org.id, name: "M3B Section" },
    });
  }

  let dept = await db.department.findFirst({
    where: { sectionId: section.id, name: "Delivery" },
  });
  if (!dept) {
    dept = await db.department.create({
      data: { sectionId: section.id, name: "Delivery" },
    });
  }

  let team = await db.team.findFirst({
    where: { departmentId: dept.id, name: "Alpha Team" },
  });
  if (!team) {
    team = await db.team.create({
      data: { departmentId: dept.id, name: "Alpha Team" },
    });
  }

  let resource = await db.resource.findFirst({
    where: { organizationId: org.id, name: "Planner Resource" },
  });
  if (!resource) {
    resource = await db.resource.create({
      data: {
        organizationId: org.id,
        name: "Planner Resource",
        type: "PERSON",
        capacityHoursPerWeek: 40,
      },
    });
  }

  const membership = await db.resourceMembership.findFirst({
    where: { resourceId: resource.id, teamId: team.id, effectiveTo: null },
  });
  if (!membership) {
    await db.resourceMembership.create({
      data: {
        resourceId: resource.id,
        teamId: team.id,
        isPrimary: true,
        allocationPercent: 100,
      },
    });
  }

  let initiative = await db.initiative.findFirst({
    where: { organizationId: org.id, referenceKey: "INIT-M3B01" },
  });
  if (!initiative) {
    initiative = await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: dept.id,
        referenceKey: "INIT-M3B01",
        title: "M3B Initiative",
        requesterName: "Requester",
        businessOwnerName: "Owner",
        currentStage: "PROJECT",
        status: "ACTIVE",
      },
    });
  }

  let project = await db.project.findFirst({
    where: { organizationId: org.id, referenceKey: "PRJ-M3B01" },
  });
  if (!project) {
    project = await db.project.create({
      data: {
        initiativeId: initiative.id,
        organizationId: org.id,
        departmentId: dept.id,
        referenceKey: "PRJ-M3B01",
        name: "M3B Delivery Project",
        status: "ACTIVE",
      },
    });
  }

  let wi1 = await db.projectWorkItem.findFirst({
    where: { projectId: project.id, referenceKey: "WI-001" },
  });
  if (!wi1) {
    wi1 = await db.projectWorkItem.create({
      data: {
        projectId: project.id,
        type: "TASK",
        referenceKey: "WI-001",
        title: "Scenario seed work A",
        status: "BACKLOG",
        estimateHours: 40,
      },
    });
  }
  let wi2 = await db.projectWorkItem.findFirst({
    where: { projectId: project.id, referenceKey: "WI-002" },
  });
  if (!wi2) {
    wi2 = await db.projectWorkItem.create({
      data: {
        projectId: project.id,
        type: "TASK",
        referenceKey: "WI-002",
        title: "Scenario seed work B",
        status: "BACKLOG",
        estimateHours: 20,
      },
    });
  }

  let pi = await db.programIncrement.findFirst({
    where: { organizationId: org.id, name: "M3B What-If PI" },
    include: { revisions: true, iterations: true },
  });
  if (!pi) {
    const counter = await db.piReferenceCounter.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
    });
    const refNum = counter.nextValue === 2 ? 1 : counter.nextValue - 1;
    pi = await db.programIncrement.create({
      data: {
        organizationId: org.id,
        sectionId: section.id,
        referenceKey: `PI-${String(refNum).padStart(4, "0")}`,
        name: "M3B What-If PI",
        startDate: PI_START,
        endDate: PI_END,
        status: "PLANNING",
        revisions: {
          create: {
            key: "CURRENT",
            label: "Current plan",
            isCurrent: true,
            status: "ACTIVE_PLAN",
            createdByPrincipalId: principalId,
          },
        },
        iterations: {
          create: {
            referenceKey: "IT-1",
            name: "IT1",
            sequence: 1,
            startDate: IT1_START,
            endDate: IT1_END,
          },
        },
        participatingDepartments: {
          create: { departmentId: dept.id },
        },
        participatingTeams: {
          create: { teamId: team.id, departmentId: dept.id },
        },
      },
      include: { revisions: true, iterations: true },
    });
  }

  const current = pi.revisions.find((r) => r.isCurrent);
  const iteration = pi.iterations[0];
  if (current && iteration) {
    const existingAlloc = await db.workAllocation.findFirst({
      where: { revisionId: current.id, workItemId: wi1.id },
    });
    if (!existingAlloc) {
      await db.workAllocation.create({
        data: {
          revisionId: current.id,
          workItemId: wi1.id,
          iterationId: iteration.id,
          teamId: team.id,
          plannedHours: 40,
        },
      });
    }
  }

  console.log(
    JSON.stringify({
      organizationId: org.id,
      piId: pi.id,
      boardPath: `/pi/${pi.id}/board`,
      referenceKey: pi.referenceKey,
      workItemIds: [wi1.id, wi2.id],
      seedToken: randomUUID().slice(0, 8),
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
