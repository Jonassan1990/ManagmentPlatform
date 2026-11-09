import { EntityStatus, type PrismaClient } from "@prisma/client";
import { IT_DEMO_IDS } from "@/modules/demo/it-hierarchy-demo";

/** Short org codes from the Q hierarchy, plus the Scania root shown beside them. */
export function isQOrganizationName(name: string): boolean {
  const trimmed = name.trim();
  if (/^scania$/i.test(trimmed)) return true;
  return /^Q[A-Z0-9]{0,4}$/i.test(trimmed);
}

export function isIndustrialItOrganization(id: string, name: string): boolean {
  if (id === IT_DEMO_IDS.org) return true;
  return /^\s*I\b/i.test(name) && /industrial it/i.test(name);
}

let pending: Promise<void> | null = null;

/** Archive Q / Scania organizations once per process. Industrial IT stays active. */
export function ensureQOrganizationsRetired(db: PrismaClient): Promise<void> {
  if (!pending) {
    pending = retireQOrganizations(db)
      .then(() => undefined)
      .catch((error) => {
        pending = null;
        console.error(
          "[org] q organizations were not removed",
          error instanceof Error ? error.name : "unknown",
        );
      });
  }
  return pending;
}

export async function retireQOrganizations(db: PrismaClient): Promise<number> {
  const orgs = await db.organization.findMany({
    where: { status: EntityStatus.ACTIVE },
    select: { id: true, name: true, parentOrganizationId: true },
  });

  const retire = new Set<string>();
  for (const org of orgs) {
    if (isIndustrialItOrganization(org.id, org.name)) continue;
    if (isQOrganizationName(org.name)) retire.add(org.id);
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const org of orgs) {
      if (retire.has(org.id) || isIndustrialItOrganization(org.id, org.name)) {
        continue;
      }
      if (org.parentOrganizationId && retire.has(org.parentOrganizationId)) {
        retire.add(org.id);
        grew = true;
      }
    }
  }

  const ids = [...retire];
  if (ids.length === 0) return 0;

  await db.organization.updateMany({
    where: { id: { in: ids } },
    data: { status: EntityStatus.ARCHIVED },
  });

  const sections = await db.section.findMany({
    where: { organizationId: { in: ids } },
    select: { id: true },
  });
  const sectionIds = sections.map((section) => section.id);
  if (sectionIds.length > 0) {
    await db.section.updateMany({
      where: { id: { in: sectionIds } },
      data: { status: EntityStatus.ARCHIVED },
    });
    const departments = await db.department.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true },
    });
    const departmentIds = departments.map((department) => department.id);
    if (departmentIds.length > 0) {
      await db.department.updateMany({
        where: { id: { in: departmentIds } },
        data: { status: EntityStatus.ARCHIVED },
      });
      await db.team.updateMany({
        where: { departmentId: { in: departmentIds } },
        data: { status: EntityStatus.ARCHIVED },
      });
    }
  }

  await db.resource.updateMany({
    where: { organizationId: { in: ids } },
    data: { status: EntityStatus.ARCHIVED },
  });

  const itSections = await db.section.findMany({
    where: { organizationId: IT_DEMO_IDS.org },
    select: { id: true },
  });
  if (itSections.length > 0) {
    const itDepartments = await db.department.findMany({
      where: {
        sectionId: { in: itSections.map((section) => section.id) },
        status: EntityStatus.ACTIVE,
      },
      select: { id: true, name: true },
    });
    const qDepartmentIds = itDepartments
      .filter((department) => isQOrganizationName(department.name))
      .map((department) => department.id);
    if (qDepartmentIds.length > 0) {
      await db.department.updateMany({
        where: { id: { in: qDepartmentIds } },
        data: { status: EntityStatus.ARCHIVED },
      });
      await db.team.updateMany({
        where: { departmentId: { in: qDepartmentIds } },
        data: { status: EntityStatus.ARCHIVED },
      });
    }
  }

  console.log(`[org] archived ${ids.length} non-IT organization(s)`);
  return ids.length;
}
