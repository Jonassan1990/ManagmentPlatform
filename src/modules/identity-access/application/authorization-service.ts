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

const PHASE4_PILOT_PROJECT_PERMISSIONS: Permission[] = [
  PERMISSIONS.PILOT_CREATE,
  PERMISSIONS.PILOT_EDIT,
  PERMISSIONS.PILOT_TRANSITION,
  PERMISSIONS.PILOT_EVALUATE,
  PERMISSIONS.PROJECT_CONVERT,
  PERMISSIONS.PROJECT_VIEW,
  PERMISSIONS.PROJECT_EDIT,
  PERMISSIONS.PROJECT_MANAGE_MILESTONES,
  PERMISSIONS.PROJECT_MANAGE_WORKITEMS,
  PERMISSIONS.GOVERNANCE_POLICY_MANAGE,
];

const PHASE5_PI_PLANNING_PERMISSIONS: Permission[] = [
  PERMISSIONS.PI_VIEW,
  PERMISSIONS.PI_CREATE,
  PERMISSIONS.PI_EDIT,
  PERMISSIONS.PI_TRANSITION,
  PERMISSIONS.PI_ALLOCATE,
  PERMISSIONS.PI_MANAGE_CAPACITY,
  PERMISSIONS.PI_MANAGE_DEPENDENCY,
  PERMISSIONS.PI_REVIEW,
  PERMISSIONS.PI_BASELINE,
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
  ...PHASE4_PILOT_PROJECT_PERMISSIONS,
  ...PHASE5_PI_PLANNING_PERMISSIONS,
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
  ...PHASE4_PILOT_PROJECT_PERMISSIONS,
  ...PHASE5_PI_PLANNING_PERMISSIONS,
];
export class AuthorizationService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Resolves the current principal.
   * 1. Explicit override (tests)
   * 2. DEV auth bridge (development only)
   * 3. OIDC session → Principal via session.principalId
   * 4. null (fail closed)
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
      });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        source: "oidc",
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
   * DEV / test empty-state helper: when zero organizations exist, grant bootstrap binding.
   * Production OIDC must NEVER auto-grant — use IdentityService.consumeBootstrapToken instead.
   * Does not hardcode any personal identity.
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

  /** Non-throwing permission check for UI capability flags. */
  async can(
    principal: Principal,
    permission: Permission,
    scope: AuthScope,
  ): Promise<boolean> {
    try {
      await this.assertCan(principal, permission, scope);
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
        return false;
      }
      throw error;
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
