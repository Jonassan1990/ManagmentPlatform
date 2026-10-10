/**
 * M5E-B — Seed fixtures for Reports browser QA (reuses M2E Capacity Org).
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5eb-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();

await db.principal.upsert({
  where: { id: principalId },
  create: { id: principalId, displayName: "M5EB QA Actor" },
  update: { displayName: "M5EB QA Actor" },
});

let org = await db.organization.findFirst({
  where: { name: "M2E Capacity Org" },
});
if (!org) {
  const m2e = spawnSync("node", ["scripts/seed-m2e-capacity-ui.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl, TEMP_AUTH_PRINCIPAL_ID: principalId },
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

const adminRole = await db.roleDefinition.findFirstOrThrow({
  where: { key: "organization.admin" },
});
const active = await db.roleBinding.findFirst({
  where: {
    principalId,
    roleDefinitionId: adminRole.id,
    organizationId: org.id,
    effectiveTo: null,
  },
});
if (!active) {
  await db.roleBinding.create({
    data: {
      principalId,
      roleDefinitionId: adminRole.id,
      scopeType: "ORGANIZATION",
      organizationId: org.id,
      scopeId: org.id,
    },
  });
}

const section = await db.section.findFirstOrThrow({
  where: { organizationId: org.id },
});
const dept = await db.department.findFirstOrThrow({
  where: { sectionId: section.id },
  orderBy: { name: "asc" },
});
const team = await db.team.findFirstOrThrow({
  where: { departmentId: dept.id },
});
const pi = await db.programIncrement.findFirstOrThrow({
  where: { organizationId: org.id, referenceKey: "PI-M2E-CAP" },
});

const seed = {
  milestone: "M5E-B",
  generatedAt: new Date().toISOString(),
  organizationId: org.id,
  departmentId: dept.id,
  sectionId: section.id,
  teamId: team.id,
  piId: pi.id,
  principalId,
  paths: {
    reports: `/portfolio/reports?organizationId=${org.id}&reportType=portfolio_summary`,
    capacityReport: `/portfolio/reports?organizationId=${org.id}&piId=${pi.id}&reportType=pi_capacity`,
    resourceReport: `/portfolio/reports?organizationId=${org.id}&piId=${pi.id}&reportType=resource_allocation`,
    projectStatus: `/portfolio/reports?organizationId=${org.id}&reportType=project_status`,
    risks: `/portfolio/reports?organizationId=${org.id}&reportType=risks_blockers`,
    governance: `/portfolio/reports?organizationId=${org.id}&reportType=governance_decisions`,
    exportCsv: `/api/reports/export?organizationId=${org.id}&reportType=portfolio_summary`,
    capacityExport: `/api/reports/export?organizationId=${org.id}&piId=${pi.id}&reportType=pi_capacity`,
  },
};

fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(seed, null, 2));
console.log(JSON.stringify(seed, null, 2));
await db.$disconnect();
