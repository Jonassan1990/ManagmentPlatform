/**
 * M5D-C — Compose PI Planning fixtures for end-to-end acceptance.
 * Ensures M2E Capacity Org + at least one draft scenario for Compare.
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5dc-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();

async function ensureCapacityOrg() {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "M5DC QA Actor" },
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

const pi = await db.programIncrement.findFirstOrThrow({
  where: { organizationId: org.id },
  orderBy: { startDate: "desc" },
  include: {
    revisions: { orderBy: { createdAt: "asc" } },
    participatingTeams: true,
    iterations: true,
  },
});

const current = pi.revisions.find((r) => r.isCurrent) ?? null;
let drafts = pi.revisions.filter(
  (r) => !r.isCurrent && r.status === "DRAFT" && !r.archivedAt,
);

// Ensure a draft scenario exists for Compare / Select journeys.
if (current && drafts.length === 0) {
  const key = `SCN-M5DC-${Date.now().toString(36).slice(-6)}`;
  const draft = await db.planningRevision.create({
    data: {
      piId: pi.id,
      key,
      label: "M5DC Alt Staffing",
      status: "DRAFT",
      isCurrent: false,
      version: 1,
      createdByPrincipalId: principalId,
    },
  });
  // Copy CURRENT allocations into draft so Compare has deltas to show.
  const currentAllocs = await db.workAllocation.findMany({
    where: { revisionId: current.id },
  });
  if (currentAllocs.length > 0) {
    await db.workAllocation.createMany({
      data: currentAllocs.map((a) => ({
        revisionId: draft.id,
        workItemId: a.workItemId,
        iterationId: a.iterationId,
        teamId: a.teamId,
        resourceId: a.resourceId,
        plannedHours: a.plannedHours,
        notes: a.notes,
      })),
    });
  }
  drafts = [draft];
}

const seed = {
  milestone: "M5D-C",
  generatedAt: new Date().toISOString(),
  startingMainHint: "ecaa3ec",
  organizationId: org.id,
  organizationName: org.name,
  principalId,
  piId: pi.id,
  piReference: pi.referenceKey,
  piName: pi.name,
  piStatus: pi.status,
  currentRevisionId: current?.id ?? null,
  draftScenarioIds: drafts.map((d) => d.id),
  draftScenarioLabels: drafts.map((d) => d.label ?? d.key),
  teamCount: pi.participatingTeams.length,
  iterationCount: pi.iterations.length,
  paths: {
    board: `/pi/${pi.id}/board`,
    capacity: `/pi/${pi.id}/capacity`,
    compare: `/pi/${pi.id}/compare`,
    review: `/pi/${pi.id}/review`,
    baseline: `/pi/${pi.id}/baseline`,
    portfolio: `/portfolio`,
    portfolioCapacity: `/portfolio/capacity`,
    piList: `/pi`,
  },
};

fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(seed, null, 2));
console.log(JSON.stringify(seed, null, 2));
await db.$disconnect();
