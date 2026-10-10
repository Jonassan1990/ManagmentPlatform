/**
 * M5C-D — Compose M5C-A/B/C fixtures for end-to-end Initiative→Project acceptance.
 * Non-destructive; ensures Capacity Org, runs child seeds, writes unified seed.json.
 *
 * Usage:
 *   DATABASE_URL=... TEMP_AUTH_PRINCIPAL_ID=... npx tsx scripts/m5cd-seed-browser.mts
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
const preferredOrgId =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5cd-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();

async function ensureCapacityOrg(): Promise<string> {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "M5CD QA Actor" },
    update: {},
  });

  let org = await db.organization.findUnique({ where: { id: preferredOrgId } });
  if (!org) {
    org = await db.organization.findFirst({
      where: { name: "M2E Capacity Org" },
    });
  }
  if (!org) {
    // Recreate baseline capacity org (integration resets can wipe QA DB).
    const m2e = spawnSync(
      "node",
      ["scripts/seed-m2e-capacity-ui.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: dbUrl,
          DIRECT_URL: dbUrl,
          TEMP_AUTH_PRINCIPAL_ID: principalId,
        },
        encoding: "utf8",
      },
    );
    if (m2e.status !== 0) {
      console.error(m2e.stderr || m2e.stdout);
      throw new Error("seed-m2e-capacity-ui failed");
    }
    org = await db.organization.findFirst({
      where: { name: "M2E Capacity Org" },
    });
  }
  if (!org) {
    throw new Error("Capacity Org unavailable after seed-m2e");
  }
  return org.id;
}

const envBase = {
  ...process.env,
  DATABASE_URL: dbUrl,
  DIRECT_URL: dbUrl,
  TEMP_AUTH_PRINCIPAL_ID: principalId,
};

function run(cmd: string, args: string[], extraEnv: Record<string, string> = {}) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: { ...envBase, ...extraEnv },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`seed step failed: ${cmd} ${args.join(" ")}`);
  }
  return r.stdout;
}

const orgId = await ensureCapacityOrg();
await db.$disconnect();

const m5caDir = path.join(process.cwd(), "artifacts/m5ca-qa");
const m5cbDir = path.join(process.cwd(), "artifacts/m5cb-qa");
const m5ccDir = path.join(process.cwd(), "artifacts/m5cc-qa");
fs.mkdirSync(m5caDir, { recursive: true });
fs.mkdirSync(m5cbDir, { recursive: true });
fs.mkdirSync(m5ccDir, { recursive: true });

const orgEnv = { QA_ORG_ID: orgId };

run("node", ["scripts/m5ca-seed-browser.mjs"], {
  ...orgEnv,
  QA_SEED_OUT: path.join(m5caDir, "seed.json"),
});
run("npx", ["tsx", "scripts/m5cb-seed-browser.mts"], {
  ...orgEnv,
  QA_OUT_DIR: m5cbDir,
});
run("npx", ["tsx", "scripts/m5cc-seed-browser.mts"], {
  ...orgEnv,
  QA_OUT_DIR: m5ccDir,
});

const m5ca = JSON.parse(
  fs.readFileSync(path.join(m5caDir, "seed.json"), "utf8"),
);
const m5cb = JSON.parse(
  fs.readFileSync(path.join(m5cbDir, "seed.json"), "utf8"),
);
const m5cc = JSON.parse(
  fs.readFileSync(path.join(m5ccDir, "seed.json"), "utf8"),
);

const seed = {
  milestone: "M5C-D",
  generatedAt: new Date().toISOString(),
  organizationId:
    m5cc.organizationId ?? m5cb.organizationId ?? m5ca.organizationId,
  principalId,
  sources: {
    m5ca: path.join(m5caDir, "seed.json"),
    m5cb: path.join(m5cbDir, "seed.json"),
    m5cc: path.join(m5ccDir, "seed.json"),
  },
  lifecycle: {
    demand: m5ca.initiatives?.demand ?? null,
    requirements: m5ca.initiatives?.requirements ?? null,
    preStudy: m5ca.initiatives?.preStudy ?? null,
    governanceNoSubmission: m5cb.initiatives?.noSubmission ?? null,
    governancePending: m5cb.initiatives?.pendingApproval ?? null,
    governanceDecision: m5cb.initiatives?.awaitingDecision ?? null,
    conditional: m5cb.initiatives?.conditional ?? null,
    poc: m5cb.initiatives?.poc ?? null,
    pilot: m5cb.initiatives?.pilot ?? null,
    projectActive: m5cc.initiatives?.active ?? null,
    projectBlocked: m5cc.initiatives?.blocked ?? null,
    projectDelayed: m5cc.initiatives?.delayed ?? null,
    projectCompleted: m5cc.initiatives?.completed ?? null,
    projectCancelled: m5cc.initiatives?.cancelled ?? null,
    projectMissing: m5cc.initiatives?.missing ?? null,
    noProject: m5cc.initiatives?.noProject ?? null,
  },
};

fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(seed, null, 2));
console.log(JSON.stringify(seed, null, 2));
