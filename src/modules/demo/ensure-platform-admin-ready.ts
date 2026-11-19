import { prisma } from "@/server/db";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { ensureVacationSheetRoster } from "@/modules/demo/ensure-vacation-sheet-roster";
import {
  DEMO_ORG_NAME,
  DEMO_SECTION_NAME,
  IT_DEMO_DEPTS,
  IT_DEMO_IDS,
} from "@/modules/demo/it-hierarchy-demo";
import { getTempAuthEnv } from "@/server/env";
import { ROLE_KEYS } from "@/modules/shared/permissions";

export type PlatformAdminReadyResult = {
  organizationId: string;
  sectionId: string;
  departmentCount: number;
  peopleReady: boolean;
  peopleCount: number;
  grantedOrgAdmin: boolean;
  story?: {
    castCount: number;
    pendingVacations: number;
    initiatives: number;
    projects: number;
    projectReady: boolean;
  };
};

export type EnsurePlatformAdminReadyOptions = {
  /** Default false — sheet roster is huge and used to time out Prepare. */
  syncVacationSheetRoster?: boolean;
};

/**
 * Idempotent setup for the admin config page:
 * ensure Industrial IT org + section + departments, grant the actor
 * organization.admin, then seed the INFB manager portfolio story.
 * Never wipes existing data.
 */
export async function ensurePlatformAdminReady(
  actorPrincipalId: string,
  options: EnsurePlatformAdminReadyOptions = {},
): Promise<PlatformAdminReadyResult> {
  const syncVacationSheetRoster = options.syncVacationSheetRoster === true;
  const authz = new AuthorizationService(prisma);
  await authz.ensureSystemRoles();
  await authz.ensurePlatformBootstrapAdmin(actorPrincipalId);

  await prisma.principal.upsert({
    where: { id: actorPrincipalId },
    create: {
      id: actorPrincipalId,
      displayName: "Platform Admin",
    },
    update: {},
  });

  const org = await prisma.organization.upsert({
    where: { id: IT_DEMO_IDS.org },
    create: {
      id: IT_DEMO_IDS.org,
      name: DEMO_ORG_NAME,
      description:
        "Industrial IT organization for management demos (I → IN → departments).",
    },
    update: {
      name: DEMO_ORG_NAME,
      status: "ACTIVE",
    },
  });

  const section = await prisma.section.upsert({
    where: { id: IT_DEMO_IDS.sectionIn },
    create: {
      id: IT_DEMO_IDS.sectionIn,
      organizationId: org.id,
      name: DEMO_SECTION_NAME,
      description:
        "IT section used by the vacation plan and View as person drawer.",
    },
    update: {
      name: DEMO_SECTION_NAME,
      status: "ACTIVE",
    },
  });

  const deptRows = Object.values(IT_DEMO_DEPTS);
  for (const department of deptRows) {
    await prisma.department.upsert({
      where: { id: department.id },
      create: {
        id: department.id,
        sectionId: section.id,
        name: department.name,
        description: department.description,
      },
      update: {
        name: department.name,
        description: department.description,
        status: "ACTIVE",
      },
    });
  }

  await prisma.department.updateMany({
    where: {
      id: { in: [IT_DEMO_IDS.deptInfb, IT_DEMO_IDS.deptInff] },
    },
    data: { parentDepartmentId: IT_DEMO_IDS.deptInf },
  });

  const teams = [
    {
      id: IT_DEMO_IDS.teamInfPlatform,
      departmentId: IT_DEMO_IDS.deptInf,
      name: "Platform",
    },
    {
      id: IT_DEMO_IDS.teamInfbApps,
      departmentId: IT_DEMO_IDS.deptInfb,
      name: "Apps",
    },
    {
      id: IT_DEMO_IDS.teamInfbOps,
      departmentId: IT_DEMO_IDS.deptInfb,
      name: "Ops",
    },
    {
      id: IT_DEMO_IDS.teamInffData,
      departmentId: IT_DEMO_IDS.deptInff,
      name: "Data",
    },
    {
      id: IT_DEMO_IDS.teamIngInfra,
      departmentId: IT_DEMO_IDS.deptIng,
      name: "Infra",
    },
    {
      id: IT_DEMO_IDS.teamInaDemand,
      departmentId: IT_DEMO_IDS.deptIna,
      name: "Demand",
    },
  ] as const;
  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      create: {
        id: team.id,
        departmentId: team.departmentId,
        name: team.name,
      },
      update: { name: team.name, status: "ACTIVE" },
    });
  }

  await authz.grantOrganizationAdmin(actorPrincipalId, org.id);

  // Focused manager walkthrough data first (fast, idempotent, must succeed).
  const { ensureManagerDemoStory } = await import(
    "@/modules/demo/ensure-manager-demo-story"
  );
  const story = await ensureManagerDemoStory();

  // Optional / never block Prepare: full sheet roster is hundreds of people.
  if (syncVacationSheetRoster) {
    void ensureVacationSheetRoster().catch((error) => {
      console.error(
        "[demo] vacation sheet roster sync skipped",
        error instanceof Error ? error.message : "unknown",
      );
    });
  }

  const peopleCount = await prisma.principal.count({
    where: {
      OR: [
        { externalSubject: { startsWith: "sheet-manager:" } },
        { externalSubject: { startsWith: "sheet-user:" } },
        { externalSubject: { startsWith: "demo:story-" } },
      ],
    },
  });
  const boundCount = await prisma.roleBinding.count({
    where: {
      organizationId: org.id,
      principal: {
        OR: [
          { externalSubject: { startsWith: "sheet-manager:" } },
          { externalSubject: { startsWith: "sheet-user:" } },
          { externalSubject: { startsWith: "demo:story-" } },
        ],
      },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
    },
  });

  return {
    organizationId: org.id,
    sectionId: section.id,
    departmentCount: deptRows.length,
    peopleReady: peopleCount > 0 && boundCount > 0,
    peopleCount,
    grantedOrgAdmin: true,
    story,
  };
}

/** If this principal is the configured TEMP_AUTH owner, grant platform admin. */
export async function ensureTempAuthOwnerPlatformAccess(
  principalId: string,
): Promise<boolean> {
  const temp = getTempAuthEnv();
  if (!temp || temp.TEMP_AUTH_PRINCIPAL_ID !== principalId) {
    return false;
  }
  const authz = new AuthorizationService(prisma);
  return authz.ensurePlatformBootstrapAdmin(principalId);
}

export async function getPlatformAdminStatus(actorPrincipalId: string) {
  const [orgCount, sheetPeople, bindings, hasPlatformAdmin, orgAdminOrgs] =
    await Promise.all([
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.principal.count({
        where: {
          OR: [
            { externalSubject: { startsWith: "sheet-manager:" } },
            { externalSubject: { startsWith: "sheet-user:" } },
          ],
        },
      }),
      prisma.roleBinding.count({
        where: {
          principal: {
            OR: [
              { externalSubject: { startsWith: "sheet-manager:" } },
              { externalSubject: { startsWith: "sheet-user:" } },
            ],
          },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
      }),
      prisma.roleBinding.count({
        where: {
          principalId: actorPrincipalId,
          roleDefinition: { key: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN },
          scopeType: "PLATFORM",
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
      }),
      prisma.roleBinding.count({
        where: {
          principalId: actorPrincipalId,
          roleDefinition: { key: ROLE_KEYS.ORGANIZATION_ADMIN },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
      }),
    ]);

  const demoOrg = await prisma.organization.findUnique({
    where: { id: IT_DEMO_IDS.org },
    select: { id: true, name: true },
  });

  const { getManagerDemoPortfolioStatus } = await import(
    "@/modules/demo/ensure-manager-demo-story"
  );
  const portfolio = await getManagerDemoPortfolioStatus();

  return {
    organizationCount: orgCount,
    sheetPeopleCount: sheetPeople,
    sheetBindingCount: bindings,
    hasPlatformAdmin: hasPlatformAdmin > 0,
    hasOrganizationAdmin: orgAdminOrgs > 0,
    demoOrganization: demoOrg,
    portfolio,
    personaSwitchEnabled:
      process.env.ALLOW_DEMO_PERSONA_SWITCH === "true" ||
      process.env.ALLOW_DEMO_PERSONA_SWITCH === "1",
  };
}
