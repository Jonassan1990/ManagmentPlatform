import { PrismaClient, ScopeType } from "@prisma/client";
import { AppError } from "@/modules/shared/errors";
import {
  PERMISSIONS,
  ROLE_KEYS,
  type Permission,
} from "@/modules/shared/permissions";
import type { AuthScope, Principal } from "../domain/types";
import { isDevAuthEnabled, getEnv } from "@/server/env";

const PHASE3_GOVERNANCE_PERMISSIONS: Permission[] = [
  PERMISSIONS.GOVERNANCE_VIEW,
  PERMISSIONS.GOVERNANCE_SUBMIT,
  PERMISSIONS.APPROVAL_REVIEW,
  PERMISSIONS.DECISION_MAKE,
  PERMISSIONS.DECISION_CONDITION_RESOLVE,
  PERMISSIONS.POC_CREATE,
  PERMISSIONS.POC_EDIT,
  PERMISSIONS.POC_TRANSITION,
  PERMISSIONS.POC_EVALUATE,
  PERMISSIONS.APPROVAL_AUTHORITY_BUSINESS,
  PERMISSIONS.APPROVAL_AUTHORITY_ARCHITECTURE,
  PERMISSIONS.APPROVAL_AUTHORITY_SECURITY,
];

const PLATFORM_BOOTSTRAP_PERMISSIONS: Permission[] = [
  PERMISSIONS.PLATFORM_BOOTSTRAP,
  PERMISSIONS.ORG_STRUCTURE_READ,
  PERMISSIONS.ORG_STRUCTURE_MANAGE,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.ROLE_MANAGE,
  PERMISSIONS.INITIATIVE_VIEW,
  PERMISSIONS.INITIATIVE_CREATE,
  PERMISSIONS.INITIATIVE_EDIT,
  PERMISSIONS.INITIATIVE_MANAGE_DEMAND,
  PERMISSIONS.INITIATIVE_MANAGE_REQUIREMENTS,
  PERMISSIONS.INITIATIVE_MANAGE_PRESTUDY,
  PERMISSIONS.INITIATIVE_MANAGE_RISK,
  PERMISSIONS.INITIATIVE_ADVANCE,
  ...PHASE3_GOVERNANCE_PERMISSIONS,
];

const ORGANIZATION_ADMIN_PERMISSIONS: Permission[] = [
  PERMISSIONS.ORG_STRUCTURE_READ,
  PERMISSIONS.ORG_STRUCTURE_MANAGE,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.ROLE_MANAGE,
  PERMISSIONS.INITIATIVE_VIEW,
  PERMISSIONS.INITIATIVE_CREATE,
  PERMISSIONS.INITIATIVE_EDIT,
  PERMISSIONS.INITIATIVE_MANAGE_DEMAND,
  PERMISSIONS.INITIATIVE_MANAGE_REQUIREMENTS,
  PERMISSIONS.INITIATIVE_MANAGE_PRESTUDY,
  PERMISSIONS.INITIATIVE_MANAGE_RISK,
  PERMISSIONS.INITIATIVE_ADVANCE,
  ...PHASE3_GOVERNANCE_PERMISSIONS,
];
export class AuthorizationService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Resolves the current principal.
   * Production / non-dev: returns null unless a future OIDC adapter is wired.
   * DEV-only: ALLOW_DEV_AUTH=true + NODE_ENV=development + DEV_AUTH_PRINCIPAL_ID UUID.
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

    // Future OIDC adapter plugs in here. Fail closed for now.
    return null;
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
    await this.db.roleDefinition.upsert({
      where: { key: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN },
      create: {
        key: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN,
        name: "Platform Bootstrap Admin",
        description:
          "Temporary bootstrap authority used when no organization exists yet.",
        permissions: [...PLATFORM_BOOTSTRAP_PERMISSIONS],
      },
      update: {
        permissions: [...PLATFORM_BOOTSTRAP_PERMISSIONS],
      },
    });

    await this.db.roleDefinition.upsert({
      where: { key: ROLE_KEYS.ORGANIZATION_ADMIN },
      create: {
        key: ROLE_KEYS.ORGANIZATION_ADMIN,
        name: "Organization Admin",
        description: "Manage organization structure within an organization scope.",
        permissions: [...ORGANIZATION_ADMIN_PERMISSIONS],
      },
      update: {
        permissions: [...ORGANIZATION_ADMIN_PERMISSIONS],
      },
    });
  }

  /**
   * When the database has zero organizations, grant bootstrap binding to the principal.
   * Does not hardcode any personal identity.
   */
  async ensureBootstrapBinding(principalId: string): Promise<void> {
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

  async assertCan(
    principal: Principal,
    permission: Permission,
    scope: AuthScope,
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

    const allowed = bindings.some((binding) => {
      if (!binding.roleDefinition.permissions.includes(permission)) {
        return false;
      }
      return scopeMatches(binding.scopeType, binding.organizationId, binding.scopeId, scope);
    });

    if (!allowed) {
      throw new AppError(
        "FORBIDDEN",
        `Missing permission '${permission}' for the requested scope.`,
        {
          details: { permission, scope },
        },
      );
    }
  }
}

function scopeMatches(
  bindingScopeType: ScopeType,
  bindingOrgId: string | null,
  bindingScopeId: string | null,
  requested: AuthScope,
): boolean {
  if (bindingScopeType === ScopeType.PLATFORM) {
    // Platform scope may satisfy bootstrap and org manage during empty-state / admin paths.
    return true;
  }

  if (requested.type === "PLATFORM") {
    return false;
  }

  if (!bindingOrgId || bindingOrgId !== requested.organizationId) {
    return false;
  }

  switch (requested.type) {
    case "ORGANIZATION":
      return (
        bindingScopeType === ScopeType.ORGANIZATION ||
        bindingScopeType === ScopeType.SECTION ||
        bindingScopeType === ScopeType.DEPARTMENT ||
        bindingScopeType === ScopeType.TEAM
      );
    case "SECTION":
      if (bindingScopeType === ScopeType.ORGANIZATION) return true;
      return (
        bindingScopeType === ScopeType.SECTION &&
        bindingScopeId === requested.sectionId
      );
    case "DEPARTMENT":
      if (bindingScopeType === ScopeType.ORGANIZATION) return true;
      return (
        bindingScopeType === ScopeType.DEPARTMENT &&
        bindingScopeId === requested.departmentId
      );
    case "TEAM":
      if (bindingScopeType === ScopeType.ORGANIZATION) return true;
      return (
        bindingScopeType === ScopeType.TEAM &&
        bindingScopeId === requested.teamId
      );
    default:
      return false;
  }
}
