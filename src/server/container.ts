import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { GovernanceService } from "@/modules/governance/application/governance-service";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { ProjectService } from "@/modules/project/application/project-service";
import { prisma } from "@/server/db";

export function createServices() {
  const authz = new AuthorizationService(prisma);
  const audit = new AuditService(prisma);
  const governance = new GovernanceService(prisma, authz, audit);
  const project = new ProjectService(prisma, authz, audit);
  return {
    authz,
    audit,
    organization: new OrganizationService(prisma, authz, audit),
    initiative: new InitiativeService(prisma, authz, audit, governance),
    governance,
    project,
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
