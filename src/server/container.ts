import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { prisma } from "@/server/db";

export function createOrganizationService() {
  const authz = new AuthorizationService(prisma);
  const audit = new AuditService(prisma);
  return {
    authz,
    audit,
    organization: new OrganizationService(prisma, authz, audit),
  };
}
