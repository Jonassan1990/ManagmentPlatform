import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";

process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? databaseUrl;

const db = new PrismaClient();

describe("R1-C database readiness probe (isolated)", () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("SELECT 1 succeeds against isolated database", async () => {
    const rows = await db.$queryRaw`SELECT 1::int AS ok`;
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as { ok: number }[])[0]?.ok).toBe(1);
  });

  it("fails closed when given an unreachable host (dependency failure)", async () => {
    const bad = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://mgmt:mgmt_dev_only@127.0.0.1:1/nope?schema=public&connect_timeout=1",
        },
      },
    });
    await expect(bad.$queryRaw`SELECT 1`).rejects.toBeTruthy();
    await bad.$disconnect().catch(() => undefined);
  });
});
