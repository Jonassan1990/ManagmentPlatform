import { createHash } from "node:crypto";
import { prisma } from "@/server/db";
import { IT_DEMO_IDS } from "@/modules/demo/it-hierarchy-demo";
import {
  departmentSheetCode,
  parentSheetCode,
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

function sheetReference(code: string, name: string): string {
  const base = `${SHEET_PREFIX}${code}:${name}`;
  if (base.length <= 100) return base;
  const hash = createHash("sha256").update(base).digest("hex").slice(0, 8);
  return `${SHEET_PREFIX}${code}:${name.slice(0, 50)}:${hash}`.slice(0, 100);
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
    department.people.map((person) => ({
      organizationId: section.organizationId,
      name: person.name.slice(0, 200),
      referenceCode: sheetReference(department.code, person.name),
      type: "PERSON" as const,
      functionRole: (person.group ?? "Employee").slice(0, 200),
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
    const code = row.referenceCode.slice(SHEET_PREFIX.length).split(":")[0] ?? "";
    const department = byCode.get(code);
    const person = roster
      .find((item) => item.code === code)
      ?.people.find((item) => sheetReference(code, item.name) === row.referenceCode);
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
