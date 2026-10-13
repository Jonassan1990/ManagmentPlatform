import { createHash, timingSafeEqual } from "crypto";
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs";
import { PrismaClient, ScopeType } from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS, ROLE_KEYS } from "@/modules/shared/permissions";
import type { Principal } from "../domain/types";
import { AuthorizationService } from "./authorization-service";
import { getBootstrapSetupToken } from "@/server/env";
import {
  LOCAL_LOGIN_ISSUER,
  TEMP_AUTH_ISSUER,
} from "./temp-auth-constants";

export type OidcIdentityInput = {
  issuer: string;
  subject: string;
  email?: string | null;
  displayName?: string | null;
};

export type TempAuthIdentityInput = {
  principalId: string;
  username: string;
  displayName?: string | null;
};

export type LinkOidcIdentityInput = {
  targetPrincipalId: string;
  issuer: string;
  subject: string;
  emailSnapshot?: string | null;
  displayNameSnapshot?: string | null;
  /** Must be true — blocks accidental calls that omit operator intent. */
  confirmExplicitLink: true;
};

const BOOTSTRAP_KEY = "default";

function safeEqualString(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export class IdentityService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  /**
   * JIT provision: create Principal + ExternalIdentity if missing.
   * New principals receive NO role bindings (least privilege).
   */
  async resolveOrCreateFromOidc(input: OidcIdentityInput): Promise<Principal> {
    const issuer = input.issuer.trim();
    const subject = input.subject.trim();
    if (!issuer || !subject) {
      throw new AppError("VALIDATION", "OIDC issuer and subject are required");
    }

    const existing = await this.db.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
      include: { principal: true },
    });

    if (existing) {
      await this.db.externalIdentity.update({
        where: { id: existing.id },
        data: {
          lastLoginAt: new Date(),
          emailSnapshot: input.email ?? existing.emailSnapshot,
          displayNameSnapshot:
            input.displayName ?? existing.displayNameSnapshot,
        },
      });
      if (input.email || input.displayName) {
        await this.db.principal.update({
          where: { id: existing.principalId },
          data: {
            email: input.email ?? existing.principal.email,
            displayName:
              input.displayName ?? existing.principal.displayName,
          },
        });
      }
      return {
        id: existing.principalId,
        displayName:
          input.displayName ??
          existing.principal.displayName ??
          existing.displayNameSnapshot,
        email: input.email ?? existing.principal.email ?? undefined,
        source: "oidc",
      };
    }

    const principal = await this.db.$transaction(async (tx) => {
      const created = await tx.principal.create({
        data: {
          displayName: input.displayName ?? null,
          email: input.email ?? null,
        },
      });
      await tx.externalIdentity.create({
        data: {
          issuer,
          subject,
          principalId: created.id,
          emailSnapshot: input.email ?? null,
          displayNameSnapshot: input.displayName ?? null,
          lastLoginAt: new Date(),
        },
      });
      return created;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "identity.oidc.jit_provision",
      subjectType: "Principal",
      subjectId: principal.id,
      payload: {
        issuer,
        subject,
        emailPresent: Boolean(input.email),
      },
      result: "success",
    });

    return {
      id: principal.id,
      displayName: principal.displayName,
      email: principal.email ?? undefined,
      source: "oidc",
    };
  }

  /**
   * Resolve/create the single temporary owner Principal + ExternalIdentity (ADR-026).
   * Uses configured TEMP_AUTH_PRINCIPAL_ID as the stable Principal id.
   * Fails closed on conflicting identity state (never silently overwrite).
   * Does NOT grant RoleBindings.
   */
  async resolveOrCreateFromTempAuth(
    input: TempAuthIdentityInput,
  ): Promise<Principal> {
    const principalId = input.principalId.trim();
    const subject = input.username.trim();
    const issuer = TEMP_AUTH_ISSUER;
    if (!principalId || !subject) {
      throw new AppError(
        "VALIDATION",
        "Temporary auth principal id and username are required.",
      );
    }

    const existingLink = await this.db.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
      include: { principal: true },
    });

    if (existingLink && existingLink.principalId !== principalId) {
      console.error(
        "[temp-auth] identity conflict: ExternalIdentity subject bound to a different Principal",
      );
      throw new AppError(
        "CONFLICT",
        "Temporary authentication is misconfigured.",
      );
    }

    const principalRow = await this.db.principal.findUnique({
      where: { id: principalId },
      include: {
        externalIdentities: {
          where: { issuer },
        },
      },
    });

    if (principalRow) {
      const otherTemp = principalRow.externalIdentities.find(
        (ei) => ei.subject !== subject,
      );
      if (otherTemp) {
        // Controlled operator rename of TEMP_AUTH_USERNAME for the *same*
        // configured principal (keeps RoleBindings).
        if (principalRow.externalIdentities.length !== 1) {
          console.error(
            "[temp-auth] identity conflict: Principal has multiple temp-auth subjects",
          );
          throw new AppError(
            "CONFLICT",
            "Temporary authentication is misconfigured.",
          );
        }
        await this.db.externalIdentity.update({
          where: { id: otherTemp.id },
          data: {
            subject,
            lastLoginAt: new Date(),
            displayNameSnapshot:
              input.displayName ?? otherTemp.displayNameSnapshot,
          },
        });
        if (input.displayName) {
          await this.db.principal.update({
            where: { id: principalId },
            data: { displayName: input.displayName },
          });
        }
        return {
          id: principalId,
          displayName:
            input.displayName ?? principalRow.displayName ?? subject,
          email: principalRow.email ?? undefined,
          source: "temp",
        };
      }
    }

    if (existingLink) {
      await this.db.externalIdentity.update({
        where: { id: existingLink.id },
        data: {
          lastLoginAt: new Date(),
          displayNameSnapshot:
            input.displayName ?? existingLink.displayNameSnapshot,
        },
      });
      if (input.displayName) {
        await this.db.principal.update({
          where: { id: principalId },
          data: { displayName: input.displayName },
        });
      }
      return {
        id: principalId,
        displayName:
          input.displayName ??
          existingLink.principal.displayName ??
          existingLink.displayNameSnapshot,
        email: existingLink.principal.email ?? undefined,
        source: "temp",
      };
    }

    const principal = await this.db.$transaction(async (tx) => {
      const created =
        principalRow ??
        (await tx.principal.create({
          data: {
            id: principalId,
            displayName: input.displayName ?? null,
          },
        }));

      if (principalRow && input.displayName) {
        await tx.principal.update({
          where: { id: principalId },
          data: { displayName: input.displayName },
        });
      }

      await tx.externalIdentity.create({
        data: {
          issuer,
          subject,
          principalId,
          displayNameSnapshot: input.displayName ?? null,
          lastLoginAt: new Date(),
        },
      });

      return created;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "identity.temp_auth.resolve",
      subjectType: "Principal",
      subjectId: principal.id,
      payload: {
        issuer,
        // subject is a configured username, not a secret — but keep payload minimal
        subjectPresent: true,
        createdPrincipal: !principalRow,
      },
      result: "success",
    });

    return {
      id: principal.id,
      displayName: input.displayName ?? principal.displayName,
      email: principal.email ?? undefined,
      source: "temp",
    };
  }

  /**
   * Create a Principal with local username/password for testing, and optionally
   * assign an organization-scoped role binding in the same operation.
   * Requires ROLE_MANAGE on the target organization.
   */
  async createLocalTestUser(
    actor: Principal,
    input: {
      organizationId: string;
      username: string;
      password: string;
      displayName?: string | null;
      roleDefinitionId?: string | null;
      scopeType?: ScopeType;
      scopeId?: string | null;
    },
  ): Promise<{
    principalId: string;
    username: string;
    displayName: string | null;
    roleBindingId: string | null;
  }> {
    await this.authz.assertCan(actor, PERMISSIONS.ROLE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: input.organizationId,
    });

    const username = input.username.trim().toLowerCase();
    const displayName = input.displayName?.trim() || username;
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
      throw new AppError(
        "VALIDATION",
        "Username must be 3–64 characters: letters, numbers, . _ - (start with letter/number).",
      );
    }
    if (input.password.length < 8 || input.password.length > 200) {
      throw new AppError(
        "VALIDATION",
        "Password must be between 8 and 200 characters.",
      );
    }

    const taken = await this.db.localLoginCredential.findUnique({
      where: { username },
    });
    if (taken) {
      throw new AppError("CONFLICT", "That username is already in use.");
    }

    const passwordHash = await bcryptHash(input.password, 10);

    const created = await this.db.$transaction(async (tx) => {
      const principal = await tx.principal.create({
        data: { displayName },
      });
      await tx.localLoginCredential.create({
        data: {
          principalId: principal.id,
          username,
          passwordHash,
          displayName,
          createdByPrincipalId: actor.id,
        },
      });
      await tx.externalIdentity.create({
        data: {
          issuer: LOCAL_LOGIN_ISSUER,
          subject: username,
          principalId: principal.id,
          displayNameSnapshot: displayName,
        },
      });
      return principal;
    });

    let roleBindingId: string | null = null;
    if (input.roleDefinitionId) {
      const scopeType = input.scopeType ?? ScopeType.ORGANIZATION;
      const binding = await this.authz.assignRoleBinding(actor, {
        principalId: created.id,
        roleDefinitionId: input.roleDefinitionId,
        scopeType,
        organizationId: input.organizationId,
        scopeId:
          scopeType === ScopeType.ORGANIZATION
            ? input.organizationId
            : input.scopeId ?? null,
      });
      roleBindingId = binding.id;
    }

    await this.audit.record({
      actorPrincipalId: actor.id,
      actionType: "identity.local_login.create",
      subjectType: "Principal",
      subjectId: created.id,
      organizationId: input.organizationId,
      payload: {
        username,
        roleAssigned: Boolean(roleBindingId),
      },
      result: "success",
    });

    return {
      principalId: created.id,
      username,
      displayName,
      roleBindingId,
    };
  }

  /**
   * Authenticate a local test user by username/password.
   * Returns Principal on success, null on failure (caller applies delay/throttle).
   */
  async authenticateLocalLogin(input: {
    username: string;
    password: string;
  }): Promise<Principal | null> {
    const username = input.username.trim().toLowerCase();
    if (!username || !input.password) return null;

    const row = await this.db.localLoginCredential.findUnique({
      where: { username },
      include: { principal: true },
    });
    if (!row || row.disabledAt) return null;

    let ok = false;
    try {
      ok = await bcryptCompare(input.password, row.passwordHash);
    } catch {
      ok = false;
    }
    if (!ok) return null;

    await this.db.externalIdentity.updateMany({
      where: {
        issuer: LOCAL_LOGIN_ISSUER,
        subject: username,
        principalId: row.principalId,
      },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: row.principal.id,
      displayName: row.displayName ?? row.principal.displayName,
      email: row.principal.email ?? undefined,
      source: "local",
    };
  }

  async listLocalLogins(actor: Principal, organizationId: string) {
    await this.authz.assertCan(actor, PERMISSIONS.ROLE_MANAGE, {
      type: "ORGANIZATION",
      organizationId,
    });
    return this.db.localLoginCredential.findMany({
      where: await this.localLoginVisibilityWhere(actor, organizationId),
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        username: true,
        displayName: true,
        principalId: true,
        disabledAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Set a new password for a local test login visible in this organization.
   * Clears disabledAt so a locked test account can sign in again.
   * Does not change roles or the Principal id.
   */
  async resetLocalLoginPassword(
    actor: Principal,
    input: {
      organizationId: string;
      credentialId: string;
      password: string;
    },
  ): Promise<{ credentialId: string; username: string; principalId: string }> {
    await this.authz.assertCan(actor, PERMISSIONS.ROLE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: input.organizationId,
    });

    if (input.password.length < 8 || input.password.length > 200) {
      throw new AppError(
        "VALIDATION",
        "Password must be between 8 and 200 characters.",
      );
    }

    const row = await this.db.localLoginCredential.findFirst({
      where: {
        id: input.credentialId,
        ...(await this.localLoginVisibilityWhere(actor, input.organizationId)),
      },
      select: { id: true, username: true, principalId: true },
    });
    if (!row) {
      throw new AppError(
        "NOT_FOUND",
        "Local login was not found in this organization.",
      );
    }

    const passwordHash = await bcryptHash(input.password, 10);
    await this.db.localLoginCredential.update({
      where: { id: row.id },
      data: { passwordHash, disabledAt: null },
    });

    await this.audit.record({
      actorPrincipalId: actor.id,
      actionType: "identity.local_login.reset_password",
      subjectType: "Principal",
      subjectId: row.principalId,
      organizationId: input.organizationId,
      payload: { username: row.username },
      result: "success",
    });

    return {
      credentialId: row.id,
      username: row.username,
      principalId: row.principalId,
    };
  }

  /** Bindings in this org, plus logins this actor created (may have no role yet). */
  private async localLoginVisibilityWhere(
    actor: Principal,
    organizationId: string,
  ) {
    const bindings = await this.db.roleBinding.findMany({
      where: {
        organizationId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      select: { principalId: true },
    });
    const principalIds = [...new Set(bindings.map((b) => b.principalId))];
    return {
      OR: [
        { principalId: { in: principalIds } },
        { createdByPrincipalId: actor.id },
      ],
    };
  }

  /**
   * Explicit, auditable link of an OIDC (issuer, subject) to an existing Principal.
   *
   * Cutover use case: attach enterprise SSO to the temporary owner Principal so
   * RoleBindings and audit history remain on the same Principal id.
   *
   * Rules:
   * - Actor must hold PLATFORM ROLE_MANAGE (authentication ≠ authorization).
   * - Never matches or merges by email / display name.
   * - Refuses if (issuer, subject) is already bound to a different Principal.
   * - Refuses if target Principal already has a different subject for the same issuer.
   * - Does not grant RoleBindings.
   * - Does not delete or alter TEMP_AUTH ExternalIdentity rows.
   */
  async linkOidcIdentityToPrincipal(
    actor: Principal,
    input: LinkOidcIdentityInput,
  ): Promise<{ principalId: string; externalIdentityId: string; created: boolean }> {
    if (input.confirmExplicitLink !== true) {
      throw new AppError(
        "VALIDATION",
        "Explicit confirmation is required to link an OIDC identity.",
      );
    }

    await this.authz.assertCan(actor, PERMISSIONS.ROLE_MANAGE, {
      type: "PLATFORM",
    });

    const issuer = input.issuer.trim().replace(/\/+$/, "");
    const subject = input.subject.trim();
    const targetPrincipalId = input.targetPrincipalId.trim();
    if (!issuer || !subject || !targetPrincipalId) {
      throw new AppError(
        "VALIDATION",
        "issuer, subject, and targetPrincipalId are required.",
      );
    }
    if (issuer === TEMP_AUTH_ISSUER) {
      throw new AppError(
        "VALIDATION",
        "Cannot link the temporary-auth issuer through the OIDC link procedure.",
      );
    }

    const target = await this.db.principal.findUnique({
      where: { id: targetPrincipalId },
      include: {
        externalIdentities: {
          where: { issuer },
        },
      },
    });
    if (!target) {
      throw new AppError("NOT_FOUND", "Target Principal not found.");
    }

    const existing = await this.db.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
    });

    if (existing && existing.principalId !== targetPrincipalId) {
      await this.audit.record({
        actorPrincipalId: actor.id,
        actionType: "identity.oidc.link",
        subjectType: "Principal",
        subjectId: targetPrincipalId,
        payload: {
          reason: "identity_conflict_other_principal",
          issuer,
          subjectPresent: true,
        },
        result: "denied",
      });
      throw new AppError(
        "CONFLICT",
        "This OIDC identity is already linked to a different Principal.",
      );
    }

    const sameIssuerOtherSubject = target.externalIdentities.find(
      (ei) => ei.subject !== subject,
    );
    if (sameIssuerOtherSubject && !existing) {
      await this.audit.record({
        actorPrincipalId: actor.id,
        actionType: "identity.oidc.link",
        subjectType: "Principal",
        subjectId: targetPrincipalId,
        payload: {
          reason: "principal_already_has_issuer_subject",
          issuer,
          subjectPresent: true,
        },
        result: "denied",
      });
      throw new AppError(
        "CONFLICT",
        "Target Principal already has a different subject for this issuer.",
      );
    }

    if (existing && existing.principalId === targetPrincipalId) {
      await this.db.externalIdentity.update({
        where: { id: existing.id },
        data: {
          emailSnapshot: input.emailSnapshot ?? existing.emailSnapshot,
          displayNameSnapshot:
            input.displayNameSnapshot ?? existing.displayNameSnapshot,
        },
      });
      await this.audit.record({
        actorPrincipalId: actor.id,
        actionType: "identity.oidc.link",
        subjectType: "ExternalIdentity",
        subjectId: existing.id,
        payload: {
          issuer,
          subjectPresent: true,
          targetPrincipalId,
          created: false,
        },
        result: "success",
      });
      return {
        principalId: targetPrincipalId,
        externalIdentityId: existing.id,
        created: false,
      };
    }

    const created = await this.db.externalIdentity.create({
      data: {
        issuer,
        subject,
        principalId: targetPrincipalId,
        emailSnapshot: input.emailSnapshot ?? null,
        displayNameSnapshot: input.displayNameSnapshot ?? null,
      },
    });

    if (input.emailSnapshot || input.displayNameSnapshot) {
      await this.db.principal.update({
        where: { id: targetPrincipalId },
        data: {
          email: input.emailSnapshot ?? target.email,
          displayName: input.displayNameSnapshot ?? target.displayName,
        },
      });
    }

    await this.audit.record({
      actorPrincipalId: actor.id,
      actionType: "identity.oidc.link",
      subjectType: "ExternalIdentity",
      subjectId: created.id,
      payload: {
        issuer,
        subjectPresent: true,
        targetPrincipalId,
        created: true,
      },
      result: "success",
    });

    return {
      principalId: targetPrincipalId,
      externalIdentityId: created.id,
      created: true,
    };
  }

  async isBootstrapConsumed(): Promise<boolean> {
    const row = await this.db.bootstrapConsumption.findUnique({
      where: { bootstrapKey: BOOTSTRAP_KEY },
    });
    return Boolean(row);
  }

  async hasAnyAccess(principalId: string): Promise<boolean> {
    const now = new Date();
    const count = await this.db.roleBinding.count({
      where: {
        principalId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
    });
    return count > 0;
  }

  /**
   * One-time bootstrap: validate BOOTSTRAP_SETUP_TOKEN, grant PLATFORM_BOOTSTRAP,
   * record BootstrapConsumption so the token cannot be reused.
   */
  async consumeBootstrapToken(
    principal: Principal,
    token: string,
  ): Promise<void> {
    const expected = getBootstrapSetupToken();
    if (!expected) {
      throw new AppError(
        "FORBIDDEN",
        "Bootstrap is not configured. Set BOOTSTRAP_SETUP_TOKEN.",
      );
    }
    if (!token || !safeEqualString(token.trim(), expected)) {
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "identity.bootstrap.consume",
        subjectType: "BootstrapConsumption",
        payload: { reason: "invalid_token" },
        result: "denied",
      });
      throw new AppError("FORBIDDEN", "Invalid bootstrap token.");
    }

    const already = await this.isBootstrapConsumed();
    if (already) {
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "identity.bootstrap.consume",
        subjectType: "BootstrapConsumption",
        payload: { reason: "already_consumed" },
        result: "denied",
      });
      throw new AppError(
        "CONFLICT",
        "Bootstrap has already been consumed and cannot be reused.",
      );
    }

    await this.authz.ensureSystemRoles();
    const role = await this.db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN },
    });

    try {
      await this.db.$transaction(async (tx) => {
        await tx.bootstrapConsumption.create({
          data: {
            principalId: principal.id,
            bootstrapKey: BOOTSTRAP_KEY,
            note: "One-time platform bootstrap via BOOTSTRAP_SETUP_TOKEN",
          },
        });
        const existing = await tx.roleBinding.findFirst({
          where: {
            principalId: principal.id,
            roleDefinitionId: role.id,
            scopeType: ScopeType.PLATFORM,
            effectiveTo: null,
          },
        });
        if (!existing) {
          await tx.roleBinding.create({
            data: {
              principalId: principal.id,
              roleDefinitionId: role.id,
              scopeType: ScopeType.PLATFORM,
            },
          });
        }
      });
    } catch (error) {
      // Unique constraint on bootstrapKey → concurrent second consume
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        throw new AppError(
          "CONFLICT",
          "Bootstrap has already been consumed and cannot be reused.",
        );
      }
      throw error;
    }

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "identity.bootstrap.consume",
      subjectType: "BootstrapConsumption",
      subjectId: principal.id,
      payload: {
        bootstrapKey: BOOTSTRAP_KEY,
        roleKey: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN,
      },
      result: "success",
    });
  }
}
