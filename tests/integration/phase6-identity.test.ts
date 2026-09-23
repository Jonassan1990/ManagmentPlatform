import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { IdentityService } from "@/modules/identity-access/application/identity-service";
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

function principal(id = randomUUID()): Principal {
  return { id, displayName: "Test Principal", source: "test" };
}

async function resetDb() {
  await db.auditEvent.deleteMany();
  await db.bootstrapConsumption.deleteMany();
  await db.externalIdentity.deleteMany();
  await db.roleBinding.deleteMany();
  await db.principal.deleteMany();
  await db.roleDefinition.deleteMany();
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

describe("ExternalIdentity JIT provision", () => {
  it("creates Principal + ExternalIdentity with no role bindings", async () => {
    const issuer = "https://idp.example.com";
    const subject = `sub-${randomUUID()}`;
    const p = await identity.resolveOrCreateFromOidc({
      issuer,
      subject,
      email: "user@example.com",
      displayName: "Example User",
    });

    expect(p.source).toBe("oidc");
    expect(p.email).toBe("user@example.com");

    const link = await db.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
    });
    expect(link?.principalId).toBe(p.id);

    const bindings = await db.roleBinding.count({
      where: { principalId: p.id },
    });
    expect(bindings).toBe(0);
    expect(await identity.hasAnyAccess(p.id)).toBe(false);
  });

  it("reuses the same Principal for the same issuer+subject", async () => {
    const issuer = "https://idp.example.com";
    const subject = `sub-${randomUUID()}`;
    const first = await identity.resolveOrCreateFromOidc({
      issuer,
      subject,
      displayName: "First",
    });
    const second = await identity.resolveOrCreateFromOidc({
      issuer,
      subject,
      displayName: "Second",
    });
    expect(second.id).toBe(first.id);

    const count = await db.externalIdentity.count({
      where: { issuer, subject },
    });
    expect(count).toBe(1);
  });

  it("treats different issuers as distinct identities even with same subject", async () => {
    const subject = `sub-${randomUUID()}`;
    const a = await identity.resolveOrCreateFromOidc({
      issuer: "https://idp-a.example.com",
      subject,
    });
    const b = await identity.resolveOrCreateFromOidc({
      issuer: "https://idp-b.example.com",
      subject,
    });
    expect(a.id).not.toBe(b.id);
  });
});

describe("secure bootstrap consumption", () => {
  it("grants PLATFORM_BOOTSTRAP once then rejects reuse", async () => {
    process.env.BOOTSTRAP_SETUP_TOKEN = "test-bootstrap-token-16chars";
    resetEnvCacheForTests();

    const actor = principal();
    await db.principal.create({
      data: { id: actor.id, displayName: actor.displayName },
    });

    expect(await identity.isBootstrapConsumed()).toBe(false);
    await identity.consumeBootstrapToken(actor, "test-bootstrap-token-16chars");
    expect(await identity.isBootstrapConsumed()).toBe(true);
    expect(await identity.hasAnyAccess(actor.id)).toBe(true);

    const binding = await db.roleBinding.findFirst({
      where: { principalId: actor.id },
      include: { roleDefinition: true },
    });
    expect(binding?.roleDefinition.key).toBe(ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN);
    expect(binding?.scopeType).toBe("PLATFORM");

    const other = principal();
    await db.principal.create({
      data: { id: other.id, displayName: other.displayName },
    });
    await expect(
      identity.consumeBootstrapToken(other, "test-bootstrap-token-16chars"),
    ).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<AppError>);
  });

  it("rejects invalid bootstrap token", async () => {
    process.env.BOOTSTRAP_SETUP_TOKEN = "test-bootstrap-token-16chars";
    resetEnvCacheForTests();

    const actor = principal();
    await db.principal.create({
      data: { id: actor.id, displayName: actor.displayName },
    });

    await expect(
      identity.consumeBootstrapToken(actor, "wrong-token-also-long-enough"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AppError>);
    expect(await identity.isBootstrapConsumed()).toBe(false);
  });
});

describe("DEV auth still works in development test env", () => {
  it("resolveCurrentPrincipal upserts DEV principal when enabled", async () => {
    const id = randomUUID();
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.DEV_AUTH_PRINCIPAL_ID = id;
    process.env.DEV_AUTH_DISPLAY_NAME = "Local Dev";
    resetEnvCacheForTests();

    const resolved = await authz.resolveCurrentPrincipal();
    expect(resolved?.id).toBe(id);
    expect(resolved?.source).toBe("dev");

    // restore for other tests
    process.env.ALLOW_DEV_AUTH = "false";
    delete process.env.DEV_AUTH_PRINCIPAL_ID;
    process.env.NODE_ENV = "test";
    resetEnvCacheForTests();
  });
});
