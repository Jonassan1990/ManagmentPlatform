import { cookies } from "next/headers";
import type { Principal } from "@/modules/identity-access/domain/types";
import { prisma } from "@/server/db";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import {
  DEMO_PERSONA_COOKIE,
  isDemoPersonaSwitchEnabled,
} from "@/modules/demo/it-hierarchy-demo";
import {
  impersonationKeyForPrincipal,
  isImpersonationKey,
  principalIdFromImpersonationKey,
} from "@/modules/demo/persona-keys";
import { codeFromSheetReference } from "@/modules/vacation/application/vacation-plan-sheet";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import { ScopeType } from "@prisma/client";

export type SheetPersonaOption = {
  key: string;
  displayName: string;
  levelLabel: string;
  sees: string;
  username: string;
  group: "managers" | "people" | "levels";
  optionLabel: string;
  departmentCode: string | null;
  role: string | null;
  principalId: string;
  hasAccess: boolean;
};

export async function readDemoPersonaCookie(): Promise<string | null> {
  if (!isDemoPersonaSwitchEnabled()) return null;
  try {
    const jar = await cookies();
    return jar.get(DEMO_PERSONA_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export function demoPersonaCookieOptions(maxAge = 60 * 60 * 12) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * When the switch is enabled and a person cookie is set,
 * use that person instead of the signed-in account.
 */
export async function applyDemoPersonaOverride(
  base: Principal | null,
): Promise<Principal | null> {
  if (!base || !isDemoPersonaSwitchEnabled()) return base;
  const key = await readDemoPersonaCookie();
  if (!isImpersonationKey(key)) return base;

  const person = await resolveImpersonationPrincipal(key);
  if (!person) return base;
  return {
    id: person.id,
    displayName: person.displayName,
    email: person.email,
    source: "demo",
  };
}

export async function resolveImpersonationPrincipal(key: string) {
  const byId = principalIdFromImpersonationKey(key);
  if (byId) {
    return prisma.principal.findFirst({ where: { id: byId } });
  }
  // Legacy sheet-/demo- subject cookies
  return prisma.principal.findFirst({ where: { externalSubject: key } });
}

/**
 * Guarantee the impersonated person can open the app (has any role binding).
 * Called when an admin switches View as.
 */
export async function ensurePersonaHasAccess(principalId: string): Promise<void> {
  const now = new Date();
  const existing = await prisma.roleBinding.count({
    where: {
      principalId,
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
  });
  if (existing > 0) return;

  const authz = new AuthorizationService(prisma);
  await authz.ensureSystemRoles();
  const viewer = await prisma.roleDefinition.findUniqueOrThrow({
    where: { key: ROLE_KEYS.VIEWER },
  });

  let organizationId =
    (
      await prisma.resource.findFirst({
        where: { linkedPrincipalId: principalId },
        select: { organizationId: true },
      })
    )?.organizationId ?? null;

  if (!organizationId) {
    organizationId =
      (
        await prisma.organization.findFirst({
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
      )?.id ?? null;
  }
  if (!organizationId) return;

  await prisma.roleBinding.create({
    data: {
      principalId,
      roleDefinitionId: viewer.id,
      scopeType: ScopeType.ORGANIZATION,
      organizationId,
      scopeId: organizationId,
    },
  });
}

/** Everyone who can be opened in the admin person drawer. */
export async function listSeededDemoPersonas(): Promise<SheetPersonaOption[]> {
  if (!isDemoPersonaSwitchEnabled()) return [];
  await ensureDemoDepartmentUsers();
  const now = new Date();
  const rows = await prisma.principal.findMany({
    where: {
      OR: [
        { externalSubject: { startsWith: "sheet-manager:" } },
        { externalSubject: { startsWith: "sheet-user:" } },
        { externalSubject: { startsWith: "demo:" } },
        { localLoginCredential: { isNot: null } },
        {
          roleBindings: {
            some: {
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
          },
        },
      ],
    },
    select: {
      id: true,
      externalSubject: true,
      displayName: true,
      localLoginCredential: { select: { username: true } },
      linkedResource: {
        select: { functionRole: true, referenceCode: true },
      },
      roleBindings: {
        where: {
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        select: {
          id: true,
          roleDefinition: { select: { key: true } },
        },
      },
    },
    orderBy: { displayName: "asc" },
    take: 2000,
  });

  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const key = impersonationKeyForPrincipal(row);
    if (seen.has(key)) return [];
    seen.add(key);

    const subject = row.externalSubject ?? "";
    const manager =
      subject.startsWith("sheet-manager:") ||
      subject.includes("-manager") ||
      row.roleBindings.some((binding) =>
        binding.roleDefinition.key.includes("manager"),
      );
    const departmentCode = subject.startsWith("sheet-manager:")
      ? subject.slice("sheet-manager:".length)
      : subject.startsWith("demo:")
        ? subject.slice("demo:".length)
        : codeFromSheetReference(row.linkedResource?.referenceCode);
    const name = row.displayName?.trim() || departmentCode || "Person";
    const role =
      row.linkedResource?.functionRole ?? (manager ? "Manager" : null);
    const username = row.localLoginCredential?.username ?? "";
    const levelLabel = departmentCode ?? (manager ? "Manager" : "People");
    const group: SheetPersonaOption["group"] = subject.startsWith("demo:")
      ? "levels"
      : manager
        ? "managers"
        : "people";
    const hasAccess = row.roleBindings.length > 0;
    const sees = !hasAccess
      ? `${name} has no role yet — switch will grant Viewer automatically.`
      : manager
        ? `Manager view${departmentCode ? ` for ${departmentCode}` : ""}. Can review vacation and mark the plan.`
        : `${name}${departmentCode ? ` in ${departmentCode}` : ""}. Sees their own dashboard and can request vacation.`;

    return [
      {
        key,
        displayName: name,
        levelLabel,
        sees,
        username,
        group,
        optionLabel: departmentCode
          ? `${name} · ${departmentCode}${role ? ` · ${role}` : ""}`
          : name,
        departmentCode,
        role,
        principalId: row.id,
        hasAccess,
      },
    ];
  });
}
