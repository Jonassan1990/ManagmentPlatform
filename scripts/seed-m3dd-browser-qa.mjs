/**
 * Seed PI with CURRENT only for M3D-D browser acceptance.
 * Browser creates Scenario A, clones B, then promote→approve→baseline.
 * DB: management_platform_m3d_qa (isolated from integration suites).
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "node:path";
import { randomUUID } from "crypto";

const db = new PrismaClient();
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID || process.env.DEV_AUTH_PRINCIPAL_ID;
if (!principalId) {
  throw new Error("TEMP_AUTH_PRINCIPAL_ID required");
}

const ORG_NAME = "M3D-D Acceptance Org";
const PI_START = new Date("2026-07-01T00:00:00.000Z");
const PI_END = new Date("2026-09-30T00:00:00.000Z");
const IT1_START = new Date("2026-07-01T00:00:00.000Z");
const IT1_END = new Date("2026-07-14T00:00:00.000Z");

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

async function main() {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "M3D-D Tester" },
    update: { displayName: "M3D-D Tester" },
  });

  let role = await db.roleDefinition.findFirst({
    where: { key: "organization.admin" },
  });
  if (!role) {
    role = await db.roleDefinition.create({
      data: {
        key: "organization.admin",
        name: "Organization Admin",
        permissions: PI_PERMS,
      },
    });
  } else if (
    !role.permissions.includes("pi.review") ||
    !role.permissions.includes("pi.baseline")
  ) {
    await db.roleDefinition.update({
      where: { id: role.id },
      data: { permissions: [...new Set([...role.permissions, ...PI_PERMS])] },
    });
  }

  let org = await db.organization.findFirst({ where: { name: ORG_NAME } });
  if (!org) {
    org = await db.organization.create({
      data: { name: ORG_NAME, description: "M3D-D browser QA" },
    });
  }

  const binding = await db.roleBinding.findFirst({
    where: {
      principalId,
      roleDefinitionId: role.id,
      scopeType: "ORGANIZATION",
      organizationId: org.id,
    },
  });
  if (!binding) {
    await db.roleBinding.create({
      data: {
        principalId,
        roleDefinitionId: role.id,
        scopeType: "ORGANIZATION",
        organizationId: org.id,
      },
    });
  }

  let section = await db.section.findFirst({
    where: { organizationId: org.id, name: "Section" },
  });
  if (!section) {
    section = await db.section.create({
      data: { organizationId: org.id, name: "Section" },
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
    where: { departmentId: dept.id, name: "Alpha" },
  });
  if (!team) {
    team = await db.team.create({
      data: { departmentId: dept.id, name: "Alpha" },
    });
  }
  let resource = await db.resource.findFirst({
    where: { organizationId: org.id, name: "Planner" },
  });
  if (!resource) {
    resource = await db.resource.create({
      data: {
        organizationId: org.id,
        name: "Planner",
        type: "PERSON",
        capacityHoursPerWeek: 40,
      },
    });
  }
  if (
    !(await db.resourceMembership.findFirst({
      where: { resourceId: resource.id, teamId: team.id, effectiveTo: null },
    }))
  ) {
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
    where: { organizationId: org.id, referenceKey: "INIT-M3DD1" },
  });
  if (!initiative) {
    initiative = await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: dept.id,
        referenceKey: "INIT-M3DD1",
        title: "M3D-D Initiative",
        requesterName: "Requester",
        businessOwnerName: "Owner",
        currentStage: "PROJECT",
        status: "ACTIVE",
      },
    });
  }
  let project = await db.project.findFirst({
    where: { organizationId: org.id, referenceKey: "PRJ-M3DD1" },
  });
  if (!project) {
    project = await db.project.create({
      data: {
        initiativeId: initiative.id,
        organizationId: org.id,
        departmentId: dept.id,
        referenceKey: "PRJ-M3DD1",
        name: "M3D-D Project",
        status: "ACTIVE",
      },
    });
  }
  const workTitles = [
    ["WI-DD-001", "Work A"],
    ["WI-DD-002", "Work B"],
  ];
  const workItems = [];
  for (const [ref, title] of workTitles) {
    let wi = await db.projectWorkItem.findFirst({
      where: { projectId: project.id, referenceKey: ref },
    });
    if (!wi) {
      wi = await db.projectWorkItem.create({
        data: {
          projectId: project.id,
          type: "TASK",
          referenceKey: ref,
          title,
          status: "BACKLOG",
          estimateHours: 16,
        },
      });
    }
    workItems.push(wi);
  }

  const token = randomUUID().slice(0, 8);
  const pi = await db.programIncrement.create({
    data: {
      organizationId: org.id,
      sectionId: section.id,
      referenceKey: `PI-M3DD-${token}`,
      name: `M3D-D Acceptance PI ${token}`,
      startDate: PI_START,
      endDate: PI_END,
      status: "REVIEW",
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
      participatingDepartments: { create: { departmentId: dept.id } },
      participatingTeams: {
        create: { teamId: team.id, departmentId: dept.id },
      },
    },
    include: { revisions: true, iterations: true },
  });

  const current = pi.revisions.find((r) => r.isCurrent);
  const iteration = pi.iterations[0];
  await db.workAllocation.create({
    data: {
      revisionId: current.id,
      workItemId: workItems[0].id,
      iterationId: iteration.id,
      teamId: team.id,
      plannedHours: 8,
    },
  });

  const seed = {
    organizationId: org.id,
    piId: pi.id,
    currentRevisionId: current.id,
    workItemIdA: workItems[0].id,
    workItemIdB: workItems[1].id,
    iterationId: iteration.id,
    teamId: team.id,
    boardPath: `/pi/${pi.id}/board`,
  };
  const outDir = path.join(process.cwd(), "artifacts/m3dd-qa");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "seed.json"),
    JSON.stringify(seed, null, 2),
  );
  console.log(JSON.stringify(seed, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
