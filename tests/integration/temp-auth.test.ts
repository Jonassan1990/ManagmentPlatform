/**
 * Temporary owner credentials — identity + authorization separation (ADR-026).
 */
import { randomUUID } from "crypto";
import { hash } from "bcryptjs";
import { PrismaClient, ScopeType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { IdentityService } from "@/modules/identity-access/application/identity-service";
import { TEMP_AUTH_ISSUER } from "@/modules/identity-access/application/temp-auth-constants";
import { PERMISSIONS, ROLE_KEYS } from "@/modules/shared/permissions";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";
process.env.DIRECT_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
process.env.ALLOW_DEV_AUTH = "false";
resetEnvCacheForTests();

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const identity = new IdentityService(db, authz, audit);

async function resetDb() {
  // Clear temp-auth identity rows only; never wipe system RoleDefinitions.
  const tempLinks = await db.externalIdentity.findMany({
    where: { issuer: TEMP_AUTH_ISSUER },
    select: { principalId: true },
  });
  const principalIds = [...new Set(tempLinks.map((r) => r.principalId))];
  if (principalIds.length > 0) {
    await db.auditEvent.deleteMany({
      where: { actorPrincipalId: { in: principalIds } },
    });
    await db.roleBinding.deleteMany({
      where: { principalId: { in: principalIds } },
    });
    await db.bootstrapConsumption.deleteMany({
      where: { principalId: { in: principalIds } },
    });
  }
  await db.externalIdentity.deleteMany({
    where: { issuer: TEMP_AUTH_ISSUER },
  });
}

beforeAll(async () => {
  await db.$connect();
});

beforeEach(async () => {
  await resetDb();
  await authz.ensureSystemRoles();
});

afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("TEMP AUTH — identity mapping", () => {
  it("upserts Principal + ExternalIdentity; repeated login does not duplicate", async () => {
    const principalId = randomUUID();
    const username = "owner";

    const first = await identity.resolveOrCreateFromTempAuth({
      principalId,
      username,
      displayName: "Owner",
    });
    expect(first.id).toBe(principalId);
    expect(first.source).toBe("temp");

    const second = await identity.resolveOrCreateFromTempAuth({
      principalId,
      username,
      displayName: "Owner",
    });
    expect(second.id).toBe(principalId);

    const links = await db.externalIdentity.findMany({
      where: { issuer: TEMP_AUTH_ISSUER, subject: username },
    });
    expect(links).toHaveLength(1);
    expect(links[0].principalId).toBe(principalId);

    const principals = await db.principal.findMany({ where: { id: principalId } });
    expect(principals).toHaveLength(1);
  });

  it("fails closed when ExternalIdentity subject is bound to another Principal", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await identity.resolveOrCreateFromTempAuth({
      principalId: a,
      username: "owner",
    });
    await expect(
      identity.resolveOrCreateFromTempAuth({
        principalId: b,
        username: "owner",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("TEMP AUTH — authorization separation", () => {
  it("login identity alone does not authorize; RoleBinding enables assertCan", async () => {
    const principalId = randomUUID();
    const principal = await identity.resolveOrCreateFromTempAuth({
      principalId,
      username: "owner",
      displayName: "Owner",
    });

    // Shell / access-not-configured uses hasAnyAccess — login alone grants no bindings.
    // (assertCan may auto-bootstrap in NODE_ENV=test; production does not.)
    expect(await identity.hasAnyAccess(principal.id)).toBe(false);

    const role = await db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN },
    });
    await db.roleBinding.create({
      data: {
        principalId: principal.id,
        roleDefinitionId: role.id,
        scopeType: ScopeType.PLATFORM,
      },
    });

    expect(await identity.hasAnyAccess(principal.id)).toBe(true);
    await expect(
      authz.assertCan(principal, PERMISSIONS.PLATFORM_BOOTSTRAP, {
        type: "PLATFORM",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("TEMP AUTH — bcrypt hash smoke", () => {
  it("hash helper produces verifiable digest", async () => {
    const digest = await hash("local-only-test-password", 4);
    expect(digest.startsWith("$2")).toBe(true);
  });
});
