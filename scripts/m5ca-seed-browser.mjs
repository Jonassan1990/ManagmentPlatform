/**
 * M5C-A — Non-destructive seed of Initiative stages for browser QA.
 * Uses M2E Capacity Org on management_platform_m3d_qa.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const orgId =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const outPath =
  process.env.QA_SEED_OUT ??
  path.join(process.cwd(), "artifacts/m5ca-qa/seed.json");

async function main() {
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const dept = await db.department.findFirstOrThrow({
    where: { section: { organizationId: orgId } },
    include: { section: true },
  });

  let ownerResource = await db.resource.findFirst({
    where: {
      organizationId: orgId,
      name: "M5CA Owner Fixture",
      type: "PERSON",
    },
  });
  if (!ownerResource) {
    ownerResource = await db.resource.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        name: "M5CA Owner Fixture",
        type: "PERSON",
        status: "ACTIVE",
        skillsJson: [],
        capacityHoursPerWeek: 40,
      },
    });
  }

  async function upsertInitiative(ref, data) {
    const existing = await db.initiative.findFirst({
      where: { organizationId: orgId, referenceKey: ref },
    });
    if (existing) {
      const updated = await db.initiative.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          currentStage: data.currentStage,
          businessOwnerName: data.businessOwnerName,
          businessOwnerResourceId: data.businessOwnerResourceId ?? null,
          requesterName: data.requesterName,
          status: "ACTIVE",
        },
      });
      return updated;
    }
    return db.initiative.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        departmentId: dept.id,
        referenceKey: ref,
        title: data.title,
        currentStage: data.currentStage,
        status: "ACTIVE",
        requesterName: data.requesterName,
        businessOwnerName: data.businessOwnerName,
        businessOwnerResourceId: data.businessOwnerResourceId ?? null,
        demand: {
          create: {
            problemOpportunity: data.problem,
            reasonForRequest: data.reason,
            expectedValue: data.value,
            strategicAlignment: data.alignment ?? "Portfolio efficiency",
            urgency: data.urgency ?? "HIGH",
            affectedAreas: "Operations",
            initialImpact: "Medium",
          },
        },
      },
    });
  }

  const demand = await upsertInitiative("INIT-M5CA-DEMAND", {
    title: "M5CA New Demand",
    currentStage: "DEMAND",
    requesterName: "Requester Snapshot",
    businessOwnerName: "Unlinked Owner Snapshot",
    businessOwnerResourceId: null,
    problem: "Manual intake is slow and error-prone.",
    reason: "Need structured demand capture.",
    value: "Faster intake with clear ownership.",
    urgency: "MEDIUM",
  });

  const requirements = await upsertInitiative("INIT-M5CA-REQ", {
    title: "M5CA Requirements Stage",
    currentStage: "REQUIREMENTS",
    requesterName: "Requester Snapshot",
    businessOwnerName: "M5CA Owner Fixture",
    businessOwnerResourceId: ownerResource.id,
    problem: "Requirements are incomplete for governance.",
    reason: "Need accepted requirements.",
    value: "Clear acceptance criteria before Pre-study.",
    urgency: "HIGH",
  });

  const preStudy = await upsertInitiative("INIT-M5CA-PRE", {
    title: "M5CA Pre-study Stage",
    currentStage: "PRE_STUDY",
    requesterName: "Requester Snapshot",
    businessOwnerName: "M5CA Owner Fixture",
    businessOwnerResourceId: ownerResource.id,
    problem: "Options not yet assessed.",
    reason: "Need pre-study before gate.",
    value: "Evidence-ready governance package.",
    urgency: "CRITICAL",
  });

  // Ensure demand rows exist for upserted initiatives
  for (const init of [demand, requirements, preStudy]) {
    const d = await db.demand.findUnique({ where: { initiativeId: init.id } });
    if (!d) {
      await db.demand.create({
        data: {
          initiativeId: init.id,
          problemOpportunity: "Seeded problem",
          reasonForRequest: "Seeded reason",
          expectedValue: "Seeded value",
          strategicAlignment: "Portfolio efficiency",
          urgency: "HIGH",
          affectedAreas: "Operations",
          initialImpact: "Medium",
        },
      });
    }
  }

  const projectInit = await db.initiative.findFirst({
    where: {
      organizationId: orgId,
      currentStage: "PROJECT",
      referenceKey: "INIT-PRJ-M2E-HEAVY",
    },
  });

  const seed = {
    generatedAt: new Date().toISOString(),
    organizationId: org.id,
    organizationName: org.name,
    departmentId: dept.id,
    ownerResourceId: ownerResource.id,
    initiatives: {
      demand: { id: demand.id, referenceKey: demand.referenceKey },
      requirements: {
        id: requirements.id,
        referenceKey: requirements.referenceKey,
      },
      preStudy: { id: preStudy.id, referenceKey: preStudy.referenceKey },
      project: projectInit
        ? {
            id: projectInit.id,
            referenceKey: projectInit.referenceKey,
          }
        : null,
    },
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(seed, null, 2));
  console.log(JSON.stringify(seed, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
