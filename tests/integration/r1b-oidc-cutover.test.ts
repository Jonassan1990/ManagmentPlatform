import { randomUUID } from "crypto";
import { PrismaClient, ScopeType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { IdentityService } from "@/modules/identity-access/application/identity-service";
import { validateOidcSignInClaims } from "@/modules/identity-access/application/oidc-claims";
import { TEMP_AUTH_ISSUER } from "@/modules/identity-access/application/temp-auth-constants";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import { resetEnvCacheForTests } from "@/server/env";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";

process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? databaseUrl;
process.env.ALLOW_DEV_AUTH = "false";
resetEnvCacheForTests();

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const identity = new IdentityService(db, authz, audit);

async function resetDb() {
  await db.auditEvent.deleteMany();
  await db.bootstrapConsumption.deleteMany();
  await db.externalIdentity.deleteMany();
  await db.roleBinding.deleteMany();
  await db.principal.deleteMany();
  await db.roleDefinition.deleteMany();
  await db.organization.deleteMany();
}

async function platformAdmin(): Promise<Principal> {
  await authz.ensureSystemRoles();
  const p = await db.principal.create({
    data: { displayName: "Platform Admin" },
  });
  const role = await db.roleDefinition.findUniqueOrThrow({
    where: { key: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN },
  });
  await db.roleBinding.create({
    data: {
      principalId: p.id,
      roleDefinitionId: role.id,
      scopeType: ScopeType.PLATFORM,
    },
  });
  return { id: p.id, displayName: p.displayName, source: "test" };
}

beforeAll(async () => {
  await db.$connect();
});

beforeEach(async () => {
  await resetDb();
  delete process.env.BOOTSTRAP_SETUP_TOKEN;
  resetEnvCacheForTests();
});

afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("R1-B OIDC identity linking", () => {
  it("links OIDC subject to existing Principal without granting roles", async () => {
    const admin = await platformAdmin();
    const ownerId = randomUUID();
    await db.principal.create({
      data: { id: ownerId, displayName: "Temp Owner" },
    });
    await db.externalIdentity.create({
      data: {
        issuer: TEMP_AUTH_ISSUER,
        subject: "owner",
        principalId: ownerId,
      },
    });

    const issuer = "https://idp.example.com";
    const subject = `oidc-${randomUUID()}`;
    const result = await identity.linkOidcIdentityToPrincipal(admin, {
      targetPrincipalId: ownerId,
      issuer,
      subject,
      confirmExplicitLink: true,
      displayNameSnapshot: "Owner SSO",
    });

    expect(result.created).toBe(true);
    expect(result.principalId).toBe(ownerId);

    const link = await db.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
    });
    expect(link?.principalId).toBe(ownerId);

    // Temp-auth identity preserved
    const temp = await db.externalIdentity.findUnique({
      where: {
        issuer_subject: { issuer: TEMP_AUTH_ISSUER, subject: "owner" },
      },
    });
    expect(temp?.principalId).toBe(ownerId);

    // Linking does not grant RoleBindings on the target
    const bindings = await db.roleBinding.count({
      where: { principalId: ownerId },
    });
    expect(bindings).toBe(0);

    // Subsequent OIDC resolve reuses the linked Principal
    const resolved = await identity.resolveOrCreateFromOidc({
      issuer,
      subject,
      displayName: "Owner SSO",
    });
    expect(resolved.id).toBe(ownerId);
  });

  it("denies link without PLATFORM ROLE_MANAGE", async () => {
    // Prevent test-env auto-bootstrap (ensureBootstrapBinding) by having an org.
    await db.organization.create({
      data: { name: "Deny Org", version: 1 },
    });
    await authz.ensureSystemRoles();
    const viewerRole = await db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.VIEWER },
    });
    const org = await db.organization.findFirstOrThrow();
    const viewer = await db.principal.create({
      data: { displayName: "Viewer" },
    });
    await db.roleBinding.create({
      data: {
        principalId: viewer.id,
        roleDefinitionId: viewerRole.id,
        scopeType: ScopeType.ORGANIZATION,
        organizationId: org.id,
        scopeId: org.id,
      },
    });
    const target = await db.principal.create({
      data: { displayName: "Target" },
    });
    await expect(
      identity.linkOidcIdentityToPrincipal(
        { id: viewer.id, displayName: "Viewer", source: "test" },
        {
          targetPrincipalId: target.id,
          issuer: "https://idp.example.com",
          subject: "sub-1",
          confirmExplicitLink: true,
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed on identity conflict (other Principal)", async () => {
    const admin = await platformAdmin();
    const a = await db.principal.create({ data: { displayName: "A" } });
    const b = await db.principal.create({ data: { displayName: "B" } });
    const issuer = "https://idp.example.com";
    const subject = `sub-${randomUUID()}`;
    await db.externalIdentity.create({
      data: { issuer, subject, principalId: a.id },
    });

    await expect(
      identity.linkOidcIdentityToPrincipal(admin, {
        targetPrincipalId: b.id,
        issuer,
        subject,
        confirmExplicitLink: true,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("does not auto-merge by email — JIT creates a separate Principal", async () => {
    const ownerId = randomUUID();
    await db.principal.create({
      data: {
        id: ownerId,
        displayName: "Temp Owner",
        email: "same@example.com",
      },
    });

    const jit = await identity.resolveOrCreateFromOidc({
      issuer: "https://idp.example.com",
      subject: `sub-${randomUUID()}`,
      email: "same@example.com",
      displayName: "Temp Owner",
    });
    expect(jit.id).not.toBe(ownerId);
  });

  it("refuses linking the temporary-auth issuer", async () => {
    const admin = await platformAdmin();
    const target = await db.principal.create({
      data: { displayName: "Target" },
    });
    await expect(
      identity.linkOidcIdentityToPrincipal(admin, {
        targetPrincipalId: target.id,
        issuer: TEMP_AUTH_ISSUER,
        subject: "owner",
        confirmExplicitLink: true,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("R1-B claim validation + coexistence", () => {
  it("rejects expired-token style missing subject at claim layer", () => {
    // Auth.js rejects expired tokens before callbacks; we still harden empty sub.
    expect(
      validateOidcSignInClaims({
        expectedIssuer: "https://idp.example.com",
        expectedAudience: "client",
        issuer: "https://idp.example.com",
        subject: undefined,
      }).ok,
    ).toBe(false);
  });

  it("temp-auth and OIDC Principals remain isolated without explicit link", async () => {
    const tempId = randomUUID();
    await identity.resolveOrCreateFromTempAuth({
      principalId: tempId,
      username: "owner",
      displayName: "Temp",
    });
    const oidc = await identity.resolveOrCreateFromOidc({
      issuer: "https://idp.example.com",
      subject: `sub-${randomUUID()}`,
    });
    expect(oidc.id).not.toBe(tempId);
  });

  it("RoleBinding denial: OIDC JIT has no access until binding", async () => {
    const p = await identity.resolveOrCreateFromOidc({
      issuer: "https://idp.example.com",
      subject: `sub-${randomUUID()}`,
    });
    expect(await identity.hasAnyAccess(p.id)).toBe(false);
  });

  it("admin access via binding after link preserves PLATFORM role on same Principal", async () => {
    const admin = await platformAdmin();
    const ownerId = randomUUID();
    await db.principal.create({ data: { id: ownerId, displayName: "Owner" } });
    await authz.ensureBootstrapBinding(ownerId);

    const issuer = "https://idp.example.com";
    const subject = `sub-${randomUUID()}`;
    await identity.linkOidcIdentityToPrincipal(admin, {
      targetPrincipalId: ownerId,
      issuer,
      subject,
      confirmExplicitLink: true,
    });

    const resolved = await identity.resolveOrCreateFromOidc({
      issuer,
      subject,
    });
    expect(resolved.id).toBe(ownerId);
    expect(await identity.hasAnyAccess(ownerId)).toBe(true);

    const role = await db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN },
    });
    const binding = await db.roleBinding.findFirst({
      where: {
        principalId: ownerId,
        roleDefinitionId: role.id,
        scopeType: ScopeType.PLATFORM,
        effectiveTo: null,
      },
    });
    expect(binding).toBeTruthy();
  });
});
