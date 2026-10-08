import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { hash } from "bcryptjs";
import {
  getEnv,
  getTempAuthEnv,
  isDevAuthEnabled,
  isTempAuthConfigured,
  resetEnvCacheForTests,
} from "@/server/env";
import {
  resetTempAuthThrottleForTests,
  verifyTempAuthCredentials,
} from "@/modules/identity-access/application/temp-auth-credentials";
import { TEMP_AUTH_ISSUER } from "@/modules/identity-access/application/temp-auth-constants";

const PRINCIPAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function sampleHash(password = "correct-horse-battery-staple"): Promise<string> {
  return hash(password, 4);
}

describe("temp auth configuration gate", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetEnvCacheForTests();
    delete process.env.AUTH_SECRET;
    delete process.env.TEMP_AUTH_USERNAME;
    delete process.env.TEMP_AUTH_PASSWORD_HASH;
    delete process.env.TEMP_AUTH_PRINCIPAL_ID;
    delete process.env.TEMP_AUTH_DISPLAY_NAME;
    delete process.env.ALLOW_DEV_AUTH;
    delete process.env.DEV_AUTH_PRINCIPAL_ID;
  });

  afterEach(() => {
    process.env = { ...original };
    resetEnvCacheForTests();
  });

  it("no temp env → provider unavailable", () => {
    expect(isTempAuthConfigured()).toBe(false);
    expect(getTempAuthEnv()).toBeNull();
  });

  it("partial temp env → fail-closed", async () => {
    process.env.AUTH_SECRET = "sixteen-chars-min!";
    process.env.TEMP_AUTH_USERNAME = "owner";
    // missing hash + principal
    expect(isTempAuthConfigured()).toBe(false);
    expect(getTempAuthEnv()).toBeNull();
  });

  it("invalid UUID → configuration rejected", async () => {
    process.env.AUTH_SECRET = "sixteen-chars-min!";
    process.env.TEMP_AUTH_USERNAME = "owner";
    process.env.TEMP_AUTH_PASSWORD_HASH = await sampleHash();
    process.env.TEMP_AUTH_PRINCIPAL_ID = "not-a-uuid";
    expect(isTempAuthConfigured()).toBe(false);
    expect(getTempAuthEnv()).toBeNull();
  });

  it("missing AUTH_SECRET → temp auth rejected", async () => {
    process.env.TEMP_AUTH_USERNAME = "owner";
    process.env.TEMP_AUTH_PASSWORD_HASH = await sampleHash();
    process.env.TEMP_AUTH_PRINCIPAL_ID = PRINCIPAL;
    expect(isTempAuthConfigured()).toBe(false);
  });

  it("complete valid config → enabled", async () => {
    process.env.AUTH_SECRET = "sixteen-chars-min!";
    process.env.TEMP_AUTH_USERNAME = "owner";
    process.env.TEMP_AUTH_PASSWORD_HASH = await sampleHash();
    process.env.TEMP_AUTH_PRINCIPAL_ID = PRINCIPAL;
    process.env.TEMP_AUTH_DISPLAY_NAME = "Owner";
    const cfg = getTempAuthEnv();
    expect(cfg).not.toBeNull();
    expect(cfg?.TEMP_AUTH_USERNAME).toBe("owner");
    expect(cfg?.TEMP_AUTH_PRINCIPAL_ID).toBe(PRINCIPAL);
    expect(isTempAuthConfigured()).toBe(true);
  });

  it("accepts base64-encoded hash (dotenv-safe)", async () => {
    const digest = await sampleHash();
    process.env.AUTH_SECRET = "sixteen-chars-min!";
    process.env.TEMP_AUTH_USERNAME = "owner";
    process.env.TEMP_AUTH_PASSWORD_HASH = `base64:${Buffer.from(digest, "utf8").toString("base64")}`;
    process.env.TEMP_AUTH_PRINCIPAL_ID = PRINCIPAL;
    const cfg = getTempAuthEnv();
    expect(cfg?.TEMP_AUTH_PASSWORD_HASH).toBe(digest);
    expect(isTempAuthConfigured()).toBe(true);
  });

  it("TEMP AUTH configured does not enable DEV auth in production", async () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://example";
    process.env.AUTH_SECRET = "sixteen-chars-min!";
    process.env.TEMP_AUTH_USERNAME = "owner";
    process.env.TEMP_AUTH_PASSWORD_HASH = await sampleHash();
    process.env.TEMP_AUTH_PRINCIPAL_ID = PRINCIPAL;
    // even if someone sets DEV flags
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.DEV_AUTH_PRINCIPAL_ID = PRINCIPAL;

    expect(isTempAuthConfigured()).toBe(true);
    const env = getEnv();
    expect(env.ALLOW_DEV_AUTH).toBe(false);
    expect(isDevAuthEnabled(env)).toBe(false);
  });
});

describe("temp auth credential verification", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetTempAuthThrottleForTests();
  });

  afterEach(() => {
    process.env = { ...original };
    resetTempAuthThrottleForTests();
  });

  it("valid username + password → ok; wrong password / username → denied", async () => {
    const password = "correct-horse-battery-staple";
    const config = {
      AUTH_SECRET: "sixteen-chars-min!",
      TEMP_AUTH_USERNAME: "owner",
      TEMP_AUTH_PASSWORD_HASH: await sampleHash(password),
      TEMP_AUTH_PRINCIPAL_ID: PRINCIPAL,
    };

    expect(
      await verifyTempAuthCredentials({
        username: "owner",
        password,
        config,
      }),
    ).toBe(true);

    expect(
      await verifyTempAuthCredentials({
        username: "owner",
        password: "wrong-password-here",
        config,
      }),
    ).toBe(false);

    expect(
      await verifyTempAuthCredentials({
        username: "other",
        password,
        config,
      }),
    ).toBe(false);
  });
});

describe("temp auth constants", () => {
  it("uses stable synthetic issuer", () => {
    expect(TEMP_AUTH_ISSUER).toBe("urn:managmentplatform:temp-auth:v1");
  });
});
