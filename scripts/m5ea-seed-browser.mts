/**
 * M5E-A — Compose Resource Planning fixtures for browser QA.
 * Ensures M2E Capacity Org (overload / shared / unavailable PI) exists.
 * Non-destructive (no truncate).
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5ea-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();

async function ensureCapacityOrg() {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "M5EA QA Actor" },
    update: {},
  });

  let org = await db.organization.findFirst({
    where: { name: "M2E Capacity Org" },
  });
  if (!org) {
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
      throw new Error("seed-m2e-capacity-ui failed");
    }
    org = await db.organization.findFirstOrThrow({
      where: { name: "M2E Capacity Org" },
    });
  }
  return org;
}

const org = await ensureCapacityOrg();

const section = await db.section.findFirstOrThrow({
  where: { organizationId: org.id },
  orderBy: { createdAt: "asc" },
});
const departments = await db.department.findMany({
  where: { sectionId: section.id },
  orderBy: { name: "asc" },
});
const deptA =
  departments.find((d) => /Asset/i.test(d.name)) ?? departments[0]!;
const teams = await db.team.findMany({
  where: { departmentId: deptA.id },
  orderBy: { name: "asc" },
});
const teamA = teams[0]!;

const pi = await db.programIncrement.findFirstOrThrow({
  where: { organizationId: org.id, referenceKey: "PI-M2E-CAP" },
  include: {
    revisions: true,
    participatingTeams: true,
    iterations: true,
  },
});
const unavailablePi = await db.programIncrement.findFirst({
  where: { organizationId: org.id, referenceKey: "PI-M2E-EMPTY" },
});
const current = pi.revisions.find((r) => r.isCurrent) ?? null;

const seed = {
  milestone: "M5E-A",
  generatedAt: new Date().toISOString(),
  startingMainHint: "d362c61",
  organizationId: org.id,
  organizationName: org.name,
  principalId,
  sectionId: section.id,
  departmentId: deptA.id,
  departmentName: deptA.name,
  teamId: teamA.id,
  teamName: teamA.name,
  piId: pi.id,
  piReference: pi.referenceKey,
  piName: pi.name,
  piStatus: pi.status,
  unavailablePiId: unavailablePi?.id ?? null,
  currentRevisionId: current?.id ?? null,
  teamCount: pi.participatingTeams.length,
  iterationCount: pi.iterations.length,
  paths: {
    resourcePlanning: `/portfolio/capacity?organizationId=${org.id}&piId=${pi.id}`,
    unavailable: unavailablePi
      ? `/portfolio/capacity?organizationId=${org.id}&piId=${unavailablePi.id}`
      : null,
    portfolio: `/portfolio?organizationId=${org.id}`,
    piBoard: `/pi/${pi.id}/board`,
    piCapacity: `/pi/${pi.id}/capacity`,
  },
};

fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(seed, null, 2));
console.log(JSON.stringify(seed, null, 2));
await db.$disconnect();
