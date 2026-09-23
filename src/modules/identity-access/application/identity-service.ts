import { createHash, timingSafeEqual } from "crypto";
import { PrismaClient, ScopeType } from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AppError } from "@/modules/shared/errors";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import type { Principal } from "../domain/types";
import { AuthorizationService } from "./authorization-service";
import { getBootstrapSetupToken } from "@/server/env";

export type OidcIdentityInput = {
  issuer: string;
  subject: string;
  email?: string | null;
  displayName?: string | null;
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
