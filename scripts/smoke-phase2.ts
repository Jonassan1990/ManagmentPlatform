import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import { InitiativeService } from "../src/modules/initiative/application/initiative-service";
import { OrganizationService } from "../src/modules/organization/application/organization-service";
import { REQUIRED_ASSESSMENT_AREAS } from "../src/modules/initiative/application/readiness-policy";

async function main() {
  const db = new PrismaClient();
  const authz = new AuthorizationService(db);
  const audit = new AuditService(db);
  const organization = new OrganizationService(db, authz, audit);
  const initiativeSvc = new InitiativeService(db, authz, audit);

  const id = randomUUID();
  await db.principal.create({ data: { id, displayName: "Smoke P2" } });
  const actor = { id, displayName: "Smoke P2", source: "test" as const };

  const org = await organization.createOrganization(actor, {
    name: `Smoke Org ${id.slice(0, 8)}`,
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Smoke Section",
  });
  const department = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Smoke Dept",
  });
  await organization.createTeam(actor, {
    departmentId: department.id,
    name: "Smoke Team",
  });

  let initiative = await initiativeSvc.createInitiative(actor, {
    organizationId: org.id,
    departmentId: department.id,
    title: "Smoke Initiative",
    requesterName: "Requester",
    businessOwnerName: "Owner",
  });

  const demand = await db.demand.findUniqueOrThrow({
    where: { initiativeId: initiative.id },
  });
  await initiativeSvc.updateDemand(actor, {
    initiativeId: initiative.id,
    expectedVersion: demand.version,
    problemOpportunity: "Fragmented planning",
    reasonForRequest: "Need structured governance",
    expectedValue: "Faster decisions",
    affectedAreas: "All departments",
    urgency: "HIGH",
    strategicAlignment: "Portfolio clarity",
    initialImpact: "Medium operational change",
  });

  initiative = await db.initiative.findUniqueOrThrow({
    where: { id: initiative.id },
  });
  initiative = await initiativeSvc.advanceLifecycle(actor, {
    initiativeId: initiative.id,
    toStage: "REQUIREMENTS",
    expectedVersion: initiative.version,
  });

  const req1 = await initiativeSvc.createRequirement(actor, {
    initiativeId: initiative.id,
    title: "Capture demand",
    description: "System captures structured demand",
    category: "BUSINESS",
    status: "ACCEPTED",
    acceptanceCriteria: ["Demand form complete"],
  });
  const req2 = await initiativeSvc.createRequirement(actor, {
    initiativeId: initiative.id,
    title: "Traceability",
    description: "Requirements are linkable",
    category: "FUNCTIONAL",
    status: "ACCEPTED",
    acceptanceCriteria: [],
  });
  await initiativeSvc.createRequirementRelation(actor, {
    fromRequirementId: req1.id,
    toRequirementId: req2.id,
    relationType: "RELATED_TO",
  });

  initiative = await db.initiative.findUniqueOrThrow({
    where: { id: initiative.id },
  });
  initiative = await initiativeSvc.advanceLifecycle(actor, {
    initiativeId: initiative.id,
    toStage: "PRE_STUDY",
    expectedVersion: initiative.version,
  });

  let workspace = await initiativeSvc.getInitiativeWorkspace(
    actor,
    initiative.id,
  );
  console.log("blocked readiness", workspace.readiness?.ready);
  console.log(
    "attention",
    workspace.attention.map((a) => a.message),
  );

  for (const area of REQUIRED_ASSESSMENT_AREAS) {
    await initiativeSvc.upsertAssessment(actor, {
      initiativeId: initiative.id,
      area,
      status: "COMPLETE",
      summary: "Complete",
      findings: "Findings",
      conclusion: "Proceed",
      ownerName: "Analyst",
    });
  }
  await initiativeSvc.createAlternative(actor, {
    initiativeId: initiative.id,
    title: "Extend current tooling",
    description: "Improve existing process with platform",
    isRecommended: true,
  });
  await initiativeSvc.createRisk(actor, {
    initiativeId: initiative.id,
    title: "Change fatigue",
    description: "Teams may resist new process",
  });
  await initiativeSvc.createDocumentMetadata(actor, {
    initiativeId: initiative.id,
    title: "Pre-study summary",
    category: "Pre-study",
    stage: "PRE_STUDY",
  });

  workspace = await initiativeSvc.getInitiativeWorkspace(actor, initiative.id);
  console.log(
    JSON.stringify(
      {
        ok: true,
        reference: workspace.initiative.referenceKey,
        stage: workspace.initiative.currentStage,
        ready: workspace.readiness?.ready,
        blockers: workspace.attention.filter((a) => a.severity === "blocker")
          .length,
      },
      null,
      2,
    ),
  );

  if (!workspace.readiness?.ready) {
    throw new Error("Expected readiness to be true after completing policy");
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
