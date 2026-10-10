import { PrismaClient, ScopeType } from "@prisma/client";
import { AppError } from "@/modules/shared/errors";
import {
  PERMISSIONS,
  ROLE_KEYS,
  type Permission,
} from "@/modules/shared/permissions";
import type { AuthScope, Principal } from "../domain/types";
import { isDevAuthEnabled, getEnv } from "@/server/env";
import { SYSTEM_ROLE_PACKS } from "./role-packs";
import { scopeMatchesAsync } from "./scope-policy";
import {
  ownershipGrantsPermission,
  type OwnershipRelationship,
} from "./relationship-policy";
import { logger } from "@/server/logger";
import { TEMP_AUTH_ISSUER } from "./temp-auth-constants";

export class AuthorizationService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Resolves the current principal.
   * 1. Explicit override (tests)
   * 2. DEV auth bridge (development only)
   * 3. Auth.js session (OIDC or temp-credentials) → Principal via session.principalId
   * 4. null (fail closed)
   *
   * DEV auth and temporary production credentials are separate paths.
   */
  async resolveCurrentPrincipal(
    override?: Principal | null,
  ): Promise<Principal | null> {
    if (override !== undefined) {
      return override;
    }

    const env = getEnv();
    if (isDevAuthEnabled(env)) {
      const id = env.DEV_AUTH_PRINCIPAL_ID!;
      await this.db.principal.upsert({
        where: { id },
        create: {
          id,
          displayName: env.DEV_AUTH_DISPLAY_NAME ?? "Local Developer",
          externalSubject: `dev:${id}`,
        },
        update: {
          displayName: env.DEV_AUTH_DISPLAY_NAME ?? "Local Developer",
        },
      });
      return {
        id,
        displayName: env.DEV_AUTH_DISPLAY_NAME ?? "Local Developer",
        source: "dev",
      };
    }

    // Dynamic import avoids circular init with auth.ts ↔ prisma ↔ this service.
    try {
      const { auth } = await import("@/server/auth");
      const session = await auth();
      const principalId = session?.principalId ?? session?.user?.principalId;
      if (!principalId) {
        return null;
      }
      const row = await this.db.principal.findUnique({
        where: { id: principalId },
        include: {
          externalIdentities: {
            where: { issuer: TEMP_AUTH_ISSUER },
            take: 1,
          },
        },
      });
      if (!row) {
        return null;
      }
      const viaTemp = row.externalIdentities.length > 0;
      return {
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        source: viaTemp ? "temp" : "oidc",
      };
    } catch {
      return null;
    }
  }

  async requirePrincipal(override?: Principal | null): Promise<Principal> {
    const principal = await this.resolveCurrentPrincipal(override);
    if (!principal) {
      throw new AppError(
        "UNAUTHORIZED",
        "Authentication is required. No principal is available.",
      );
    }
    return principal;
  }

  async ensureSystemRoles(): Promise<void> {
    for (const pack of SYSTEM_ROLE_PACKS) {
      await this.db.roleDefinition.upsert({
        where: { key: pack.key },
        create: {
          key: pack.key,
          name: pack.name,
          description: pack.description,
          permissions: [...pack.permissions],
        },
        update: {
          name: pack.name,
          description: pack.description,
          permissions: [...pack.permissions],
        },
      });
    }
  }

  /**
   * DEV / test empty-state helper: when zero organizations exist, grant bootstrap binding.
   * Production OIDC must NEVER auto-grant — use IdentityService.consumeBootstrapToken instead.
   */
  async ensureBootstrapBinding(principalId: string): Promise<void> {
    const env = getEnv();
    const allowAutoBootstrap =
      isDevAuthEnabled(env) || env.NODE_ENV === "test";
    if (!allowAutoBootstrap) {
      return;
    }

    await this.ensureSystemRoles();
    const orgCount = await this.db.organization.count();
    if (orgCount > 0) return;

    const role = await this.db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN },
    });

    const existing = await this.db.roleBinding.findFirst({
      where: {
        principalId,
        roleDefinitionId: role.id,
        scopeType: ScopeType.PLATFORM,
        effectiveTo: null,
      },
    });
    if (existing) return;

    await this.db.roleBinding.create({
      data: {
        principalId,
        roleDefinitionId: role.id,
        scopeType: ScopeType.PLATFORM,
      },
    });
  }

  async grantOrganizationAdmin(
    principalId: string,
    organizationId: string,
  ): Promise<void> {
    await this.ensureSystemRoles();
    const role = await this.db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.ORGANIZATION_ADMIN },
    });

    const existing = await this.db.roleBinding.findFirst({
      where: {
        principalId,
        roleDefinitionId: role.id,
        scopeType: ScopeType.ORGANIZATION,
        organizationId,
        effectiveTo: null,
      },
    });
    if (existing) return;

    await this.db.roleBinding.create({
      data: {
        principalId,
        roleDefinitionId: role.id,
        scopeType: ScopeType.ORGANIZATION,
        organizationId,
        scopeId: organizationId,
      },
    });
  }

  /**
   * Deny-by-default authorization: Permission + Scope (+ optional Ownership relationship).
   */
  async assertCan(
    principal: Principal,
    permission: Permission,
    scope: AuthScope,
    relationship?: OwnershipRelationship,
  ): Promise<void> {
    await this.ensureBootstrapBinding(principal.id);

    const now = new Date();
    const bindings = await this.db.roleBinding.findMany({
      where: {
        principalId: principal.id,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      include: { roleDefinition: true },
    });

    for (const binding of bindings) {
      if (!binding.roleDefinition.permissions.includes(permission)) {
        continue;
      }
      const matches = await scopeMatchesAsync(
        this.db,
        binding.scopeType,
        binding.organizationId,
        binding.scopeId,
        scope,
      );
      if (matches) {
        return;
      }
    }

    if (
      relationship &&
      (await ownershipGrantsPermission(
        this.db,
        principal,
        permission,
        relationship,
      ))
    ) {
      return;
    }

    logger.warn("authz.denied", {
      permission,
      scopeType: scope.type,
      principalId: principal.id,
    });
    throw new AppError(
      "FORBIDDEN",
      `Missing permission '${permission}' for the requested scope.`,
      {
        details: { permission, scope },
      },
    );
  }

  /** Non-throwing permission check for UI capability flags. */
  async can(
    principal: Principal,
    permission: Permission,
    scope: AuthScope,
    relationship?: OwnershipRelationship,
  ): Promise<boolean> {
    try {
      await this.assertCan(principal, permission, scope, relationship);
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Presentation helper for shell/nav capability flags.
   * True when an active RoleBinding in the organization includes the permission,
   * regardless of SECTION/DEPARTMENT/TEAM vs ORGANIZATION binding depth.
   * Does not replace assertCan — child scopes still cannot authorize ancestor writes.
   */
  async hasPermissionInOrganization(
    principal: Principal,
    permission: Permission,
    organizationId: string,
  ): Promise<boolean> {
    await this.ensureBootstrapBinding(principal.id);
    const now = new Date();
    const bindings = await this.db.roleBinding.findMany({
      where: {
        principalId: principal.id,
        organizationId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      include: { roleDefinition: true },
    });
    return bindings.some((b) =>
      b.roleDefinition.permissions.includes(permission),
    );
  }

  // ---------------------------------------------------------------------------
  // Role / binding administration (ROLE_MANAGE)
  // ---------------------------------------------------------------------------

  async listRoleDefinitions(principal: Principal, organizationId: string) {
    await this.assertCan(principal, PERMISSIONS.ROLE_MANAGE, {
      type: "ORGANIZATION",
      organizationId,
    });
    await this.ensureSystemRoles();
    return this.db.roleDefinition.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        permissions: true,
      },
    });
  }

  async listOrganizationPrincipals(
    principal: Principal,
    organizationId: string,
  ) {
    await this.assertCan(principal, PERMISSIONS.ROLE_MANAGE, {
      type: "ORGANIZATION",
      organizationId,
    });
    // ROLE_MANAGE may assign to any known Principal (not Resources). Cap for UI.
    return this.db.principal.findMany({
      orderBy: { displayName: "asc" },
      take: 500,
      select: { id: true, displayName: true, email: true },
    });
  }

  async listRoleBindings(principal: Principal, organizationId: string) {
    await this.assertCan(principal, PERMISSIONS.ROLE_MANAGE, {
      type: "ORGANIZATION",
      organizationId,
    });
    return this.db.roleBinding.findMany({
      where: {
        OR: [
          { organizationId },
          // PLATFORM bindings visible only to callers who also have PLATFORM ROLE_MANAGE
        ],
      },
      include: {
        roleDefinition: {
          select: { id: true, key: true, name: true },
        },
        principal: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listPlatformBindingsForAdmin(principal: Principal) {
    await this.assertCan(principal, PERMISSIONS.ROLE_MANAGE, {
      type: "PLATFORM",
    });
    return this.db.roleBinding.findMany({
      where: { scopeType: ScopeType.PLATFORM },
      include: {
        roleDefinition: { select: { id: true, key: true, name: true } },
        principal: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async assignRoleBinding(
    actor: Principal,
    input: {
      principalId: string;
      roleDefinitionId: string;
      scopeType: ScopeType;
      organizationId?: string | null;
      scopeId?: string | null;
      effectiveFrom?: Date | null;
      effectiveTo?: Date | null;
    },
  ) {
    await this.ensureSystemRoles();
    const role = await this.db.roleDefinition.findUnique({
      where: { id: input.roleDefinitionId },
    });
    if (!role) throw new AppError("NOT_FOUND", "Role definition not found.");

    const target = await this.db.principal.findUnique({
      where: { id: input.principalId },
    });
    if (!target) throw new AppError("NOT_FOUND", "Principal not found.");

    await this.validateBindingScope(input);

    if (input.scopeType === ScopeType.PLATFORM) {
      await this.assertCan(actor, PERMISSIONS.ROLE_MANAGE, { type: "PLATFORM" });
    } else {
      if (!input.organizationId) {
        throw new AppError(
          "VALIDATION",
          "organizationId is required for non-PLATFORM bindings.",
        );
      }
      await this.assertCan(actor, PERMISSIONS.ROLE_MANAGE, {
        type: "ORGANIZATION",
        organizationId: input.organizationId,
      });
      if (role.key === ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN) {
        throw new AppError(
          "VALIDATION",
          "Platform Admin role may only be bound at PLATFORM scope.",
        );
      }
    }

    const created = await this.db.roleBinding.create({
      data: {
        principalId: input.principalId,
        roleDefinitionId: input.roleDefinitionId,
        scopeType: input.scopeType,
        organizationId:
          input.scopeType === ScopeType.PLATFORM
            ? null
            : input.organizationId ?? null,
        scopeId:
          input.scopeType === ScopeType.ORGANIZATION
            ? input.organizationId ?? null
            : input.scopeType === ScopeType.PLATFORM
              ? null
              : input.scopeId ?? null,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        effectiveTo: input.effectiveTo ?? null,
      },
      include: {
        roleDefinition: { select: { key: true, name: true } },
      },
    });

    await this.db.auditEvent.create({
      data: {
        actorPrincipalId: actor.id,
        actionType: "role_binding.created",
        subjectType: "RoleBinding",
        subjectId: created.id,
        organizationId: created.organizationId,
        payload: {
          targetPrincipalId: created.principalId,
          roleKey: created.roleDefinition.key,
          roleName: created.roleDefinition.name,
          scopeType: created.scopeType,
          organizationId: created.organizationId,
          scopeId: created.scopeId,
          effectiveFrom: created.effectiveFrom,
          effectiveTo: created.effectiveTo,
        },
        result: "success",
      },
    });

    return created;
  }

  async expireRoleBinding(
    actor: Principal,
    input: { bindingId: string; effectiveTo?: Date | null },
  ) {
    const binding = await this.db.roleBinding.findUnique({
      where: { id: input.bindingId },
      include: { roleDefinition: true },
    });
    if (!binding) throw new AppError("NOT_FOUND", "Role binding not found.");

    if (binding.scopeType === ScopeType.PLATFORM) {
      await this.assertCan(actor, PERMISSIONS.ROLE_MANAGE, { type: "PLATFORM" });
    } else if (binding.organizationId) {
      await this.assertCan(actor, PERMISSIONS.ROLE_MANAGE, {
        type: "ORGANIZATION",
        organizationId: binding.organizationId,
      });
    } else {
      throw new AppError("VALIDATION", "Binding has invalid scope.");
    }

    await this.assertNotLastAdminBinding(binding);

    const effectiveTo = input.effectiveTo ?? new Date();
    const updated = await this.db.roleBinding.update({
      where: { id: binding.id },
      data: { effectiveTo },
    });

    await this.db.auditEvent.create({
      data: {
        actorPrincipalId: actor.id,
        actionType: "role_binding.expired",
        subjectType: "RoleBinding",
        subjectId: binding.id,
        organizationId: binding.organizationId,
        payload: {
          targetPrincipalId: binding.principalId,
          roleKey: binding.roleDefinition.key,
          oldScopeType: binding.scopeType,
          oldOrganizationId: binding.organizationId,
          oldScopeId: binding.scopeId,
          newEffectiveTo: effectiveTo,
          previousEffectiveTo: binding.effectiveTo,
        },
        result: "success",
      },
    });

    return updated;
  }

  private async validateBindingScope(input: {
    scopeType: ScopeType;
    organizationId?: string | null;
    scopeId?: string | null;
  }) {
    if (input.scopeType === ScopeType.PLATFORM) {
      if (input.organizationId || input.scopeId) {
        throw new AppError(
          "VALIDATION",
          "PLATFORM bindings must not set organizationId or scopeId.",
        );
      }
      return;
    }
    if (!input.organizationId) {
      throw new AppError(
        "VALIDATION",
        "organizationId is required for scoped bindings.",
      );
    }
    const org = await this.db.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org || org.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Organization not found.");
    }

    if (input.scopeType === ScopeType.ORGANIZATION) {
      return;
    }
    if (!input.scopeId) {
      throw new AppError(
        "VALIDATION",
        "scopeId is required for SECTION/DEPARTMENT/TEAM bindings.",
      );
    }

    if (input.scopeType === ScopeType.SECTION) {
      const section = await this.db.section.findUnique({
        where: { id: input.scopeId },
      });
      if (!section || section.organizationId !== input.organizationId) {
        throw new AppError(
          "VALIDATION",
          "Section must belong to the selected organization.",
        );
      }
      return;
    }
    if (input.scopeType === ScopeType.DEPARTMENT) {
      const department = await this.db.department.findUnique({
        where: { id: input.scopeId },
        include: { section: true },
      });
      if (
        !department ||
        department.section.organizationId !== input.organizationId
      ) {
        throw new AppError(
          "VALIDATION",
          "Department must belong to the selected organization.",
        );
      }
      return;
    }
    if (input.scopeType === ScopeType.TEAM) {
      const team = await this.db.team.findUnique({
        where: { id: input.scopeId },
        include: { department: { include: { section: true } } },
      });
      if (
        !team ||
        team.department.section.organizationId !== input.organizationId
      ) {
        throw new AppError(
          "VALIDATION",
          "Team must belong to the selected organization.",
        );
      }
    }
  }

  /**
   * Prevent removing the last usable PLATFORM ROLE_MANAGE or last ORGANIZATION admin
   * binding for an organization.
   */
  private async assertNotLastAdminBinding(binding: {
    id: string;
    scopeType: ScopeType;
    organizationId: string | null;
    roleDefinition: { permissions: string[]; key: string };
  }) {
    const now = new Date();
    const hasRoleManage = binding.roleDefinition.permissions.includes(
      PERMISSIONS.ROLE_MANAGE,
    );
    if (!hasRoleManage) return;

    if (binding.scopeType === ScopeType.PLATFORM) {
      const others = await this.db.roleBinding.count({
        where: {
          id: { not: binding.id },
          scopeType: ScopeType.PLATFORM,
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          roleDefinition: {
            permissions: { has: PERMISSIONS.ROLE_MANAGE },
          },
        },
      });
      if (others === 0) {
        throw new AppError(
          "VALIDATION",
          "Cannot expire the last PLATFORM role-management binding.",
        );
      }
      return;
    }

    if (
      binding.organizationId &&
      binding.roleDefinition.key === ROLE_KEYS.ORGANIZATION_ADMIN
    ) {
      const others = await this.db.roleBinding.count({
        where: {
          id: { not: binding.id },
          organizationId: binding.organizationId,
          scopeType: ScopeType.ORGANIZATION,
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          roleDefinition: { key: ROLE_KEYS.ORGANIZATION_ADMIN },
        },
      });
      if (others === 0) {
        throw new AppError(
          "VALIDATION",
          "Cannot expire the last Organization Admin binding for this organization.",
        );
      }
    }
  }
}
