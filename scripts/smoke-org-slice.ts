import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import { OrganizationService } from "../src/modules/organization/application/organization-service";

async function main() {
  const db = new PrismaClient();
  const authz = new AuthorizationService(db);
  const audit = new AuditService(db);
  const orgSvc = new OrganizationService(db, authz, audit);
  const id = randomUUID();
  await db.principal.create({ data: { id, displayName: "Smoke" } });
  const actor = { id, displayName: "Smoke", source: "test" as const };
  const org = await orgSvc.createOrganization(actor, { name: `Smoke Org ${id.slice(0, 8)}` });
  const section = await orgSvc.createSection(actor, {
    organizationId: org.id,
    name: "Smoke Section",
  });
  const dept = await orgSvc.createDepartment(actor, {
    sectionId: section.id,
    name: "Smoke Dept",
  });
  const team = await orgSvc.createTeam(actor, {
    departmentId: dept.id,
    name: "Smoke Team",
  });
  const res = await orgSvc.createResource(actor, {
    organizationId: org.id,
    name: "Smoke Resource",
    type: "PERSON",
    skills: ["planning"],
    primaryTeamId: team.id,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        org: org.id,
        section: section.id,
        dept: dept.id,
        team: team.id,
        resource: res.id,
      },
      null,
      2,
    ),
  );
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
