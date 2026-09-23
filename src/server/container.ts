import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { prisma } from "@/server/db";

export function createServices() {
  const authz = new AuthorizationService(prisma);
  const audit = new AuditService(prisma);
  return {
    authz,
    audit,
    organization: new OrganizationService(prisma, authz, audit),
    initiative: new InitiativeService(prisma, authz, audit),
  };
}

/** @deprecated Prefer createServices() */
export function createOrganizationService() {
  const services = createServices();
  return {
    authz: services.authz,
    audit: services.audit,
    organization: services.organization,
  };
}
