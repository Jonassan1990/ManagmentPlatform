import { ScopeType } from "@prisma/client";
import { hash as bcryptHash } from "bcryptjs";
import { prisma } from "@/server/db";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { LOCAL_LOGIN_ISSUER } from "@/modules/identity-access/application/temp-auth-constants";
import { DEMO_PERSONA_PASSWORD, IT_DEMO_IDS } from "@/modules/demo/it-hierarchy-demo";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import {
  codeFromSheetReference,
  departmentSheetCode,
  parentSheetCode,
  sheetJob,
  sheetPrincipalId,
  sheetReferenceCode,
  sheetUsername,
  vacationSheetRoster,
} from "@/modules/vacation/application/vacation-plan-sheet";

const SHEET_PREFIX = "sheet:";

let pending: Promise<void> | null = null;

/**
 * Put the 2026 vacation-sheet departments and people into the organization,
 * so a department shows the same people as its vacation plan.
 */
export function ensureVacationSheetRoster(): Promise<void> {
  if (!pending) {
    pending = run().catch((error) => {
      pending = null;
      console.error(
        "[demo] vacation sheet roster was not created",
        error instanceof Error ? error.name : "unknown",
      );
    });
  }
  return pending;
}

async function run(): Promise<void> {
  const roster = vacationSheetRoster();
  const expected = roster.reduce((sum, department) => sum + department.people.length, 0);
  const section = await prisma.section.findUnique({
    where: { id: IT_DEMO_IDS.sectionIn },
    select: { id: true, organizationId: true },
  });
  if (!section) return;

  const existingDepartments = await prisma.department.findMany({
    where: { sectionId: section.id },
    select: { id: true, name: true, parentDepartmentId: true },
  });
  const byCode = new Map<string, { id: string; parentDepartmentId: string | null }>();
  for (const department of existingDepartments) {
    const code = departmentSheetCode(department.name);
    if (code) byCode.set(code, department);
  }

  const missing = roster.filter((department) => !byCode.has(department.code));
  if (missing.length > 0) {
    await prisma.department.createMany({
      data: missing.map((department) => ({
        sectionId: section.id,
        name: department.code,
        description: "People from the 2026 vacation plan.",
      })),
      skipDuplicates: true,
    });
    const created = await prisma.department.findMany({
      where: { sectionId: section.id, name: { in: missing.map((department) => department.code) } },
      select: { id: true, name: true, parentDepartmentId: true },
    });
    for (const department of created) {
      const code = departmentSheetCode(department.name);
      if (code) byCode.set(code, department);
    }
  }

  for (const department of roster) {
    const parentCode = parentSheetCode(department.code);
    const parent = parentCode ? byCode.get(parentCode) : null;
    const current = byCode.get(department.code);
    if (!parent || !current || current.parentDepartmentId || parent.id === current.id) continue;
    await prisma.department.update({
      where: { id: current.id },
      data: { parentDepartmentId: parent.id },
    });
    current.parentDepartmentId = parent.id;
  }

  const departmentIds = [...byCode.values()].map((department) => department.id);
  const [have, memberCount] = await Promise.all([
    prisma.resource.count({
      where: {
        organizationId: section.organizationId,
        referenceCode: { startsWith: SHEET_PREFIX },
      },
    }),
    prisma.resourceMembership.count({
      where: {
        effectiveTo: null,
        resource: { referenceCode: { startsWith: SHEET_PREFIX } },
      },
    }),
  ]);
  if (have >= expected && memberCount >= expected) {
    await closeOtherMembers(departmentIds);
    await syncSheetAccounts(section.organizationId, byCode);
    return;
  }

  const teamPairs = new Map<string, { departmentId: string; name: string }>();
  for (const department of roster) {
    const record = byCode.get(department.code);
    if (!record) continue;
    for (const person of department.people) {
      const name = person.group ?? "Team";
      teamPairs.set(`${record.id}:${name}`, { departmentId: record.id, name });
    }
  }
  const existingTeams = await prisma.team.findMany({
    where: { departmentId: { in: departmentIds } },
    select: { id: true, departmentId: true, name: true },
  });
  const teamByKey = new Map(
    existingTeams.map((team) => [`${team.departmentId}:${team.name}`, team.id]),
  );
  const missingTeams = [...teamPairs.entries()].filter(([key]) => !teamByKey.has(key));
  if (missingTeams.length > 0) {
    await prisma.team.createMany({
      data: missingTeams.map(([, team]) => team),
      skipDuplicates: true,
    });
    const reloaded = await prisma.team.findMany({
      where: { departmentId: { in: departmentIds } },
      select: { id: true, departmentId: true, name: true },
    });
    for (const team of reloaded) {
      teamByKey.set(`${team.departmentId}:${team.name}`, team.id);
    }
  }

  const existingResources = await prisma.resource.findMany({
    where: {
      organizationId: section.organizationId,
      referenceCode: { startsWith: SHEET_PREFIX },
    },
    select: { id: true, referenceCode: true },
  });
  const resourceByCode = new Map(
    existingResources.map((resource) => [resource.referenceCode, resource.id]),
  );
  const resourceRows = roster.flatMap((department) =>
    department.people.map((person, index) => ({
      organizationId: section.organizationId,
      name: person.name.slice(0, 200),
      referenceCode: sheetReferenceCode(department.code, person.name),
      type: "PERSON" as const,
      functionRole: sheetJob(index).slice(0, 200),
      capacityHoursPerWeek: 40,
      status: "ACTIVE" as const,
    })),
  );
  const missingResources = resourceRows.filter((row) => !resourceByCode.has(row.referenceCode));
  if (missingResources.length > 0) {
    await prisma.resource.createMany({ data: missingResources, skipDuplicates: true });
    const reloaded = await prisma.resource.findMany({
      where: {
        organizationId: section.organizationId,
        referenceCode: { in: missingResources.map((row) => row.referenceCode) },
      },
      select: { id: true, referenceCode: true },
    });
    for (const resource of reloaded) {
      if (resource.referenceCode) resourceByCode.set(resource.referenceCode, resource.id);
    }
  }

  const wanted = resourceRows.flatMap((row) => {
    const code = codeFromSheetReference(row.referenceCode) ?? "";
    const department = byCode.get(code);
    const person = roster
      .find((item) => item.code === code)
      ?.people.find((item) => sheetReferenceCode(code, item.name) === row.referenceCode);
    if (!department || !person) return [];
    const teamId = teamByKey.get(`${department.id}:${person.group ?? "Team"}`);
    const resourceId = resourceByCode.get(row.referenceCode);
    if (!teamId || !resourceId) return [];
    return [{ resourceId, teamId }];
  });
  const existingMemberships = await prisma.resourceMembership.findMany({
    where: {
      effectiveTo: null,
      resourceId: { in: [...resourceByCode.values()] },
    },
    select: { resourceId: true, teamId: true },
  });
  const memberKey = new Set(
    existingMemberships.map((membership) => `${membership.resourceId}:${membership.teamId}`),
  );
  const missingMemberships = wanted.filter(
    (membership) => !memberKey.has(`${membership.resourceId}:${membership.teamId}`),
  );
  if (missingMemberships.length > 0) {
    await prisma.resourceMembership.createMany({
      data: missingMemberships.map((membership) => ({
        resourceId: membership.resourceId,
        teamId: membership.teamId,
        isPrimary: true,
        allocationPercent: 100,
      })),
    });
  }

  await closeOtherMembers(departmentIds);
  await syncSheetAccounts(section.organizationId, byCode);
}

async function syncSheetAccounts(
  organizationId: string,
  byCode: Map<string, { id: string; parentDepartmentId: string | null }>,
): Promise<void> {
  const roster = vacationSheetRoster();
  const expected = roster.reduce((sum, department) => sum + department.people.length, 0);
  const [linked, managers, managerRoles, boundCount] = await Promise.all([
    prisma.resource.count({
      where: {
        organizationId,
        referenceCode: { startsWith: SHEET_PREFIX },
        linkedPrincipalId: { not: null },
        functionRole: "Manager",
      },
    }),
    prisma.principal.count({
      where: { externalSubject: { startsWith: "sheet-manager:" } },
    }),
    prisma.resource.count({
      where: {
        organizationId,
        referenceCode: { startsWith: SHEET_PREFIX },
        functionRole: { notIn: ["Employee", "SCANIA ITS", "SIGMA", "Asociety"] },
      },
    }),
    prisma.roleBinding.count({
      where: {
        organizationId,
        principal: { externalSubject: { startsWith: "sheet-" } },
      },
    }),
  ]);
  if (
    linked >= roster.length &&
    managers >= roster.length &&
    managerRoles >= expected &&
    boundCount >= expected
  ) {
    return;
  }

  await new AuthorizationService(prisma).ensureSystemRoles();
  const roleRows = await prisma.roleDefinition.findMany({
    where: { key: { in: [ROLE_KEYS.DEPARTMENT_MANAGER, ROLE_KEYS.VIEWER] } },
    select: { id: true, key: true },
  });
  const managerRole = roleRows.find((role) => role.key === ROLE_KEYS.DEPARTMENT_MANAGER);
  const viewerRole = roleRows.find((role) => role.key === ROLE_KEYS.VIEWER);
  if (!managerRole || !viewerRole) return;

  const passwordHash = await bcryptHash(DEMO_PERSONA_PASSWORD, 10);
  const people = roster.flatMap((department) =>
    department.people.map((person, index) => {
      const reference = sheetReferenceCode(department.code, person.name);
      const manager = index === 0;
      return {
        reference,
        name: person.name.slice(0, 200),
        role: sheetJob(index),
        username: sheetUsername(department.code, index, person.name),
        principalId: sheetPrincipalId(reference),
        externalSubject: manager
          ? `sheet-manager:${department.code}`
          : `sheet-user:${reference}`,
        manager,
        departmentId: byCode.get(department.code)?.id ?? null,
      };
    }),
  );

  await prisma.principal.createMany({
    data: people.map((person) => ({
      id: person.principalId,
      displayName: person.name,
      externalSubject: person.externalSubject,
    })),
    skipDuplicates: true,
  });
  await prisma.externalIdentity.createMany({
    data: people.map((person) => ({
      issuer: LOCAL_LOGIN_ISSUER,
      subject: person.username,
      principalId: person.principalId,
      displayNameSnapshot: person.name,
    })),
    skipDuplicates: true,
  });
  await prisma.localLoginCredential.createMany({
    data: people.map((person) => ({
      principalId: person.principalId,
      username: person.username,
      passwordHash,
      displayName: person.name,
    })),
    skipDuplicates: true,
  });

  const byRole = new Map<string, string[]>();
  for (const person of people) {
    const codes = byRole.get(person.role) ?? [];
    codes.push(person.reference);
    byRole.set(person.role, codes);
  }
  for (const [role, references] of byRole) {
    await prisma.resource.updateMany({
      where: { organizationId, referenceCode: { in: references } },
      data: { functionRole: role },
    });
  }

  await prisma.$executeRaw`
    UPDATE "resources" AS r
    SET "linkedPrincipalId" = p.id
    FROM "principals" AS p
    WHERE r."organizationId" = ${organizationId}::uuid
      AND r."linkedPrincipalId" IS NULL
      AND p."externalSubject" = 'sheet-user:' || r."referenceCode"
  `;
  const managersToLink = people.filter((person) => person.manager);
  for (const person of managersToLink) {
    await prisma.resource.updateMany({
      where: {
        organizationId,
        referenceCode: person.reference,
        linkedPrincipalId: null,
      },
      data: { linkedPrincipalId: person.principalId },
    });
  }

  const existingBindings = await prisma.roleBinding.findMany({
    where: { principalId: { in: people.map((person) => person.principalId) } },
    select: { principalId: true, roleDefinitionId: true, scopeId: true },
  });
  const bound = new Set(
    existingBindings.map(
      (binding) => `${binding.principalId}:${binding.roleDefinitionId}:${binding.scopeId}`,
    ),
  );
  const bindings = people.flatMap((person) => {
    if (!person.departmentId) return [];
    const roleId = person.manager ? managerRole.id : viewerRole.id;
    const key = `${person.principalId}:${roleId}:${person.departmentId}`;
    if (bound.has(key)) return [];
    return [
      {
        principalId: person.principalId,
        roleDefinitionId: roleId,
        scopeType: ScopeType.DEPARTMENT,
        organizationId,
        scopeId: person.departmentId,
      },
    ];
  });
  if (bindings.length > 0) {
    await prisma.roleBinding.createMany({ data: bindings });
  }
}

async function closeOtherMembers(departmentIds: string[]): Promise<void> {
  await prisma.resourceMembership.updateMany({
    where: {
      effectiveTo: null,
      team: { departmentId: { in: departmentIds } },
      resource: {
        OR: [
          { referenceCode: null },
          { NOT: { referenceCode: { startsWith: SHEET_PREFIX } } },
        ],
      },
    },
    data: { effectiveTo: new Date() },
  });
}
