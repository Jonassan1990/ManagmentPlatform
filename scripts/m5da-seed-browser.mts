/**
 * M5D-A — Ensure Capacity Org + PI fixtures for PI Planning browser QA.
 * Reuses seed-m2e-capacity-ui (non-destructive).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
process.env.DATABASE_URL = dbUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? dbUrl;
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5da-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();

const m2e = spawnSync("node", ["scripts/seed-m2e-capacity-ui.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: dbUrl,
    DIRECT_URL: dbUrl,
    TEMP_AUTH_PRINCIPAL_ID: principalId,
  },
  encoding: "utf8",
});
if (m2e.status !== 0) {
  console.error(m2e.stderr || m2e.stdout);
  process.exit(1);
}

const org = await db.organization.findFirstOrThrow({
  where: { name: "M2E Capacity Org" },
});
const pi = await db.programIncrement.findFirstOrThrow({
  where: { organizationId: org.id },
  orderBy: { startDate: "desc" },
  include: {
    revisions: { where: { isCurrent: true }, take: 1 },
    participatingTeams: true,
  },
});

const seed = {
  milestone: "M5D-A",
  generatedAt: new Date().toISOString(),
  organizationId: org.id,
  principalId,
  piId: pi.id,
  piReference: pi.referenceKey,
  piName: pi.name,
  currentRevisionId: pi.revisions[0]?.id ?? null,
  teamCount: pi.participatingTeams.length,
  boardPath: `/pi/${pi.id}/board`,
  capacityPath: `/pi/${pi.id}/capacity`,
  comparePath: `/pi/${pi.id}/compare`,
  reviewPath: `/pi/${pi.id}/review`,
};

fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(seed, null, 2));
console.log(JSON.stringify(seed, null, 2));
await db.$disconnect();
