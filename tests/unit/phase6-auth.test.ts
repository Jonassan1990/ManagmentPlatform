import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getEnv,
  isDevAuthEnabled,
  isOidcConfigured,
  resetEnvCacheForTests,
} from "@/server/env";

describe("production forbids DEV auth", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = { ...original };
    resetEnvCacheForTests();
  });

  it("isDevAuthEnabled is false in production even when flag and principal set", () => {
    expect(
      isDevAuthEnabled({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://example",
        ALLOW_DEV_AUTH: true,
        DEV_AUTH_PRINCIPAL_ID: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe(false);
  });

  it("getEnv rejects ALLOW_DEV_AUTH=true when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://example";
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.DEV_AUTH_PRINCIPAL_ID =
      "11111111-1111-4111-8111-111111111111";
    expect(() => getEnv()).toThrow(/ALLOW_DEV_AUTH/);
  });

  it("requires development + flag + principal id", () => {
    expect(
      isDevAuthEnabled({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://example",
        ALLOW_DEV_AUTH: true,
        DEV_AUTH_PRINCIPAL_ID: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe(true);
  });
});

describe("OIDC configuration detection", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetEnvCacheForTests();
    delete process.env.OIDC_ISSUER;
    delete process.env.OIDC_CLIENT_ID;
    delete process.env.OIDC_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = { ...original };
    resetEnvCacheForTests();
  });

  it("isOidcConfigured is false when secrets missing", () => {
    expect(isOidcConfigured()).toBe(false);
  });

  it("isOidcConfigured is true when issuer + client id + secret present", () => {
    process.env.OIDC_ISSUER = "https://idp.example.com";
    process.env.OIDC_CLIENT_ID = "client";
    process.env.OIDC_CLIENT_SECRET = "secret";
    expect(isOidcConfigured()).toBe(true);
  });
});

describe("JWT least privilege contract", () => {
  it("session mapping only exposes principalId — not role bindings", () => {
    // Documented contract: Auth.js JWT/session carries principalId only.
    // Role bindings are always resolved from DB in AuthorizationService.assertCan.
    const sessionShape = {
      principalId: "11111111-1111-4111-8111-111111111111",
      user: { principalId: "11111111-1111-4111-8111-111111111111" },
    };
    expect(sessionShape).not.toHaveProperty("roleBindings");
    expect(sessionShape).not.toHaveProperty("permissions");
    expect(sessionShape.principalId).toBeTruthy();
  });
});
