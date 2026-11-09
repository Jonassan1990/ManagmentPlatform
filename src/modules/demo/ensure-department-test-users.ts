import { ScopeType } from "@prisma/client";
import { hash as bcryptHash } from "bcryptjs";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { LOCAL_LOGIN_ISSUER } from "@/modules/identity-access/application/temp-auth-constants";
import { prisma } from "@/server/db";
import { ensureVacationSheetRoster } from "@/modules/demo/ensure-vacation-sheet-roster";
import {
  DEMO_DEPARTMENT_USERS,
  DEMO_PERSONA_PASSWORD,
  IT_DEMO_IDS,
} from "@/modules/demo/it-hierarchy-demo";

const ORG_ADMIN_PRINCIPAL_ID = "a1000000-0000-4000-8000-000000000101";

let pending: Promise<void> | null = null;

/**
 * Insert the 25 department test people when the IT demo org already exists.
 * Does not wipe or recreate the organization. Safe to call on each shell render;
 * a completed run is remembered for the life of the process.
 */
export function ensureDemoDepartmentUsers(): Promise<void> {
  if (!pending) {
    pending = run().catch((error) => {
      pending = null;
      console.error(
        "[demo] department test users were not created",
        error instanceof Error ? error.name : "unknown",
      );
    });
  }
  return pending;
}

async function run(): Promise<void> {
  await ensureVacationSheetRoster();
  const principalIds = DEMO_DEPARTMENT_USERS.map((user) => user.principalId);
  const resourceIds = DEMO_DEPARTMENT_USERS.map((user) => user.resourceId);
  const [existingPrincipals, existingResources] = await Promise.all([
    prisma.principal.findMany({
      where: { id: { in: principalIds } },
      select: { id: true },
    }),
    prisma.resource.findMany({
      where: { id: { in: resourceIds } },
      select: { id: true },
    }),
  ]);
  if (
    existingPrincipals.length === principalIds.length &&
    existingResources.length === resourceIds.length
  ) {
    await Promise.all(
      DEMO_DEPARTMENT_USERS.map((user) =>
        prisma.resource.update({
          where: { id: user.resourceId },
          data: {
            name: user.displayName,
            functionRole: user.functionRole,
          },
        }),
      ),
    );
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: IT_DEMO_IDS.org },
    select: { id: true },
  });
  if (!org) return;

  let role = await prisma.roleDefinition.findUnique({
    where: { key: "organization.viewer" },
    select: { id: true },
  });
  if (!role) {
    await new AuthorizationService(prisma).ensureSystemRoles();
    role = await prisma.roleDefinition.findUnique({
      where: { key: "organization.viewer" },
      select: { id: true },
    });
  }
  if (!role) return;

  const teams = await prisma.team.findMany({
    where: {
      id: { in: [...new Set(DEMO_DEPARTMENT_USERS.map((user) => user.teamId))] },
    },
    select: { id: true },
  });
  const teamIds = new Set(teams.map((team) => team.id));
  const passwordHash = await bcryptHash(DEMO_PERSONA_PASSWORD, 10);
  const actor = await prisma.principal.findUnique({
    where: { id: ORG_ADMIN_PRINCIPAL_ID },
    select: { id: true },
  });

  const failures: string[] = [];
  for (const user of DEMO_DEPARTMENT_USERS) {
    try {
      await prisma.principal.upsert({
        where: { id: user.principalId },
        create: {
          id: user.principalId,
          displayName: user.displayName,
          externalSubject: `demo:${user.key}`,
        },
        update: { displayName: user.displayName },
      });

      const identity = await prisma.externalIdentity.findUnique({
        where: {
          issuer_subject: {
            issuer: LOCAL_LOGIN_ISSUER,
            subject: user.username,
          },
        },
        select: { principalId: true },
      });
      if (!identity) {
        await prisma.externalIdentity.create({
          data: {
            issuer: LOCAL_LOGIN_ISSUER,
            subject: user.username,
            principalId: user.principalId,
            displayNameSnapshot: user.displayName,
          },
        });
      }

      const loginByPrincipal = await prisma.localLoginCredential.findUnique({
        where: { principalId: user.principalId },
        select: { id: true },
      });
      const loginByUsername = await prisma.localLoginCredential.findUnique({
        where: { username: user.username },
        select: { principalId: true },
      });
      if (
        !loginByPrincipal &&
        (!loginByUsername || loginByUsername.principalId === user.principalId)
      ) {
        await prisma.localLoginCredential.create({
          data: {
            principalId: user.principalId,
            username: user.username,
            passwordHash,
            displayName: user.displayName,
            createdByPrincipalId: actor?.id ?? null,
          },
        });
      }

      const binding = await prisma.roleBinding.findFirst({
        where: {
          principalId: user.principalId,
          roleDefinitionId: role.id,
          scopeType: ScopeType.DEPARTMENT,
          scopeId: user.departmentId,
        },
        select: { id: true },
      });
      if (!binding) {
        await prisma.roleBinding.create({
          data: {
            principalId: user.principalId,
            roleDefinitionId: role.id,
            scopeType: ScopeType.DEPARTMENT,
            organizationId: org.id,
            scopeId: user.departmentId,
          },
        });
      }

      if (!teamIds.has(user.teamId)) continue;

      await prisma.resource.upsert({
        where: { id: user.resourceId },
        create: {
          id: user.resourceId,
          organizationId: org.id,
          name: user.displayName,
          type: "PERSON",
          functionRole: user.functionRole,
          skillsJson: [user.functionRole, user.departmentLabel],
          capacityHoursPerWeek: 40,
          status: "ACTIVE",
          linkedPrincipalId: user.principalId,
        },
        update: {
          name: user.displayName,
          functionRole: user.functionRole,
          linkedPrincipalId: user.principalId,
        },
      });

      const membership = await prisma.resourceMembership.findFirst({
        where: { resourceId: user.resourceId, teamId: user.teamId },
        select: { id: true },
      });
      if (!membership) {
        await prisma.resourceMembership.create({
          data: {
            resourceId: user.resourceId,
            teamId: user.teamId,
            isPrimary: true,
            allocationPercent: 100,
          },
        });
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.name : "unknown");
    }
  }

  if (failures.length > 0) {
    throw new Error(`department-users:${failures.length}`);
  }
}
