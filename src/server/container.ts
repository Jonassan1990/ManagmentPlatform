import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { IdentityService } from "@/modules/identity-access/application/identity-service";
import { GovernanceService } from "@/modules/governance/application/governance-service";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { PlanningService } from "@/modules/pi-planning/application/planning-service";
import { HomeDashboardQueryService } from "@/modules/portfolio/application/home-dashboard-query-service";
import { PortfolioPiCapacityQueryService } from "@/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { PortfolioQueryService } from "@/modules/portfolio/application/portfolio-query-service";
import { ProjectIssueService } from "@/modules/project/application/project-issue-service";
import { ProjectService } from "@/modules/project/application/project-service";
import { prisma } from "@/server/db";

export function createServices() {
  const authz = new AuthorizationService(prisma);
  const audit = new AuditService(prisma);
  const identity = new IdentityService(prisma, authz, audit);
  const governance = new GovernanceService(prisma, authz, audit);
  const project = new ProjectService(prisma, authz, audit);
  const projectIssues = new ProjectIssueService(prisma, authz, audit);
  const planning = new PlanningService(prisma, authz, audit);
  const portfolio = new PortfolioQueryService(prisma, authz, audit);
  const portfolioPiCapacity = new PortfolioPiCapacityQueryService(
    prisma,
    authz,
    audit,
    planning,
  );
  const organization = new OrganizationService(prisma, authz, audit);
  const initiative = new InitiativeService(prisma, authz, audit, governance);
  const homeDashboard = new HomeDashboardQueryService(
    prisma,
    authz,
    audit,
    organization,
    initiative,
    planning,
    portfolio,
    portfolioPiCapacity,
    governance,
  );
  return {
    authz,
    audit,
    identity,
    organization,
    initiative,
    governance,
    project,
    projectIssues,
    planning,
    portfolio,
    portfolioPiCapacity,
    homeDashboard,
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
