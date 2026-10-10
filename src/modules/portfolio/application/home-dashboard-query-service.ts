/**
 * M5B-A — Role-aware Home dashboard query composer.
 *
 * Reuses Portfolio / Initiative / PI / Governance / Organization services.
 * Does not invent KPI formulas, assignment tables, or schema changes.
 */

import type { PrismaClient } from "@prisma/client";
import type { AuditService } from "@/modules/audit/application/audit-service";
import type { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import type { GovernanceService } from "@/modules/governance/application/governance-service";
import type { InitiativeService } from "@/modules/initiative/application/initiative-service";
import {
  buildHomeQuickLinks,
  selectAuthorizedPiEntry,
  type AuthorizedPiEntry,
} from "@/modules/navigation/home-experience";
import { resolveShellNavContext } from "@/modules/navigation/resolve-shell-nav";
import type { ShellNavCapabilities } from "@/modules/navigation/types";
import type { OrganizationService } from "@/modules/organization/application/organization-service";
import type { PlanningService } from "@/modules/pi-planning/application/planning-service";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS, ROLE_KEYS } from "@/modules/shared/permissions";
import type {
  HomeActiveProjectsSection,
  HomeAttentionItem,
  HomeAuthorizedScope,
  HomeAvailableActions,
  HomeCurrentPiSection,
  HomeDashboardMode,
  HomeDashboardQueryInput,
  HomeDashboardResponse,
  HomeDashboardWarning,
  HomeMetricValue,
  HomeMyWorkAttribution,
  HomeMyWorkItem,
  HomeMyWorkSection,
  HomeNeedsAttentionSection,
  HomePortfolioSummarySection,
  HomeQuickAction,
  HomeResourceCapacitySection,
  HomeRoleBindingSummary,
  HomeSectionAvailability,
  HomeUserContext,
} from "../domain/home-dashboard";
import type { PortfolioQueryService } from "./portfolio-query-service";
import type { PortfolioPiCapacityQueryService } from "./portfolio-pi-capacity-query-service";

const DEFAULT_MY_WORK_LIMIT = 25;
const DEFAULT_ATTENTION_LIMIT = 5;
const MAX_MY_WORK_LIMIT = 50;
const MAX_ATTENTION_LIMIT = 20;

const MANAGER_ROLE_KEYS = new Set<string>([
  ROLE_KEYS.ORGANIZATION_ADMIN,
  ROLE_KEYS.PORTFOLIO_MANAGER,
  ROLE_KEYS.SECTION_MANAGER,
  ROLE_KEYS.DEPARTMENT_MANAGER,
  ROLE_KEYS.TEAM_MANAGER,
  ROLE_KEYS.PROJECT_MANAGER,
  ROLE_KEYS.PLATFORM_BOOTSTRAP_ADMIN,
]);

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function emptyCaps(): ShellNavCapabilities {
  return {
    canViewApprovals: false,
    canViewDecisions: false,
    canManageGovernancePolicy: false,
    canManageAccess: false,
    canViewPi: false,
    canCreatePi: false,
    canViewInitiatives: false,
    canCreateInitiative: false,
  };
}

function metaUnavailable(
  scope: HomeAuthorizedScope,
  sourceOfTruth: string,
  availability: HomeSectionAvailability,
  drillDown: HomeAvailableActions["drillDown"] = [],
  asOf: string | null = null,
) {
  return { authorizedScope: scope, sourceOfTruth, availability, drillDown, asOf };
}

function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export class HomeDashboardQueryService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly organization: OrganizationService,
    private readonly initiative: InitiativeService,
    private readonly planning: PlanningService,
    private readonly portfolio: PortfolioQueryService,
    private readonly portfolioPiCapacity: PortfolioPiCapacityQueryService,
    private readonly governance: GovernanceService,
  ) {}

  async getHomeDashboard(
    principal: Principal,
    input: HomeDashboardQueryInput = {},
  ): Promise<HomeDashboardResponse> {
    const asOf = new Date();
    const asOfIso = asOf.toISOString();
    const myWorkLimit = clamp(
      input.myWorkLimit ?? DEFAULT_MY_WORK_LIMIT,
      1,
      MAX_MY_WORK_LIMIT,
    );
    const attentionLimit = clamp(
      input.attentionLimit ?? DEFAULT_ATTENTION_LIMIT,
      1,
      MAX_ATTENTION_LIMIT,
    );
    const warnings: HomeDashboardWarning[] = [];

    await this.authz.ensureBootstrapBinding(principal.id);

    const orgs = await this.organization.listOrganizations(principal);
    const orgIds = orgs.map((o) => o.id);
    const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));

    // Optional preferred org must be listable (never leak foreign org data).
    if (input.organizationId) {
      if (!orgIds.includes(input.organizationId)) {
        throw new AppError(
          "FORBIDDEN",
          "Organization is outside the principal's authorized scope.",
          { details: { organizationId: input.organizationId } },
        );
      }
    }

    const navCtx = await resolveShellNavContext(this.authz, principal, orgIds);
    let preferredOrganizationId =
      input.organizationId ?? navCtx.organizationId;
    if (
      preferredOrganizationId &&
      !orgIds.includes(preferredOrganizationId)
    ) {
      preferredOrganizationId = orgIds[0] ?? null;
    }

    const capabilities = navCtx.capabilities;
    const roleBindings = await this.loadOwnRoleBindings(principal.id);
    const linkedResource = await this.findLinkedResource(principal.id);

    const orgContexts = orgs.map((o) => ({
      id: o.id,
      name: o.name,
      roleKeys: [
        ...new Set(
          roleBindings
            .filter((b) => b.organizationId === o.id)
            .map((b) => b.roleKey),
        ),
      ],
    }));

    const managerSignals = this.detectManagerSignals(
      capabilities,
      roleBindings,
    );
    const hasLinkedResource = linkedResource !== null;
    const mode = this.resolveMode(managerSignals, hasLinkedResource);

    if (orgs.length > 1) {
      warnings.push({
        code: "MULTI_ORG_SCOPE",
        message:
          "Multiple organizations are in scope. Manager sections use the preferred organization only; data is not combined across organizations.",
        organizationId: preferredOrganizationId,
      });
    }

    const multiOrgScope: HomeAuthorizedScope =
      orgs.length === 0
        ? { mode: "none", reason: "No accessible organizations." }
        : {
            mode: "organizations",
            organizations: orgs.map((o) => ({ id: o.id, name: o.name })),
            preferredOrganizationId,
          };

    const preferredScope: HomeAuthorizedScope = preferredOrganizationId
      ? {
          mode: "organization",
          organizationId: preferredOrganizationId,
          organizationName:
            orgNameById.get(preferredOrganizationId) ?? preferredOrganizationId,
        }
      : multiOrgScope;

    const userContext: HomeUserContext = {
      ...metaUnavailable(
        multiOrgScope,
        "Principal + RoleBinding + Resource.linkedPrincipalId",
        orgs.length === 0
          ? {
              state: "no_organization",
              reason: "Principal has no accessible organizations.",
            }
          : { state: "available" },
        [{ id: "organization", label: "Organization", href: "/organization" }],
        asOfIso,
      ),
      principalId: principal.id,
      displayName: principal.displayName,
      mode,
      capabilities,
      organizations: orgContexts,
      preferredOrganizationId,
      roleBindings,
      linkedResource,
      managerSignals,
      hasLinkedResource,
    };

    const piEntry = preferredOrganizationId
      ? await this.resolvePiEntry(
          principal,
          preferredOrganizationId,
          capabilities,
        )
      : null;

    const availableActions = this.buildAvailableActions({
      capabilities,
      preferredOrganizationId,
      preferredScope,
      piEntry,
      asOfIso,
      canManageResources: preferredOrganizationId
        ? await this.authz.hasPermissionInOrganization(
            principal,
            PERMISSIONS.ORG_STRUCTURE_MANAGE,
            preferredOrganizationId,
          )
        : false,
      canReadStructure: preferredOrganizationId
        ? await this.authz.hasPermissionInOrganization(
            principal,
            PERMISSIONS.ORG_STRUCTURE_READ,
            preferredOrganizationId,
          )
        : false,
    });

    // Parallel bounded composition for preferred org sections.
    const [
      myWork,
      needsAttention,
      portfolioSummary,
      activeProjects,
      currentPi,
      resourceCapacity,
    ] = await Promise.all([
      this.buildMyWork({
        principal,
        linkedResource,
        capabilities,
        preferredOrganizationId,
        preferredScope,
        myWorkLimit,
        asOfIso,
      }),
      this.buildNeedsAttention({
        principal,
        preferredOrganizationId,
        preferredScope,
        capabilities,
        attentionLimit,
        asOfIso,
        warnings,
      }),
      this.buildPortfolioSummary({
        principal,
        preferredOrganizationId,
        preferredScope,
        capabilities,
        asOfIso,
        warnings,
      }),
      this.buildActiveProjects({
        principal,
        preferredOrganizationId,
        preferredScope,
        attentionLimit,
        asOfIso,
        warnings,
      }),
      this.buildCurrentPi({
        principal,
        preferredOrganizationId,
        preferredScope,
        capabilities,
        piEntry,
        asOfIso,
        warnings,
      }),
      this.buildResourceCapacity({
        principal,
        preferredOrganizationId,
        preferredScope,
        capabilities,
        piEntry,
        asOfIso,
        warnings,
      }),
    ]);

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "home.query.dashboard",
      subjectType: "Principal",
      subjectId: principal.id,
      organizationId: preferredOrganizationId,
      payload: {
        mode,
        organizationCount: orgs.length,
        preferredOrganizationId,
        hasLinkedResource,
        managerSignals,
        actionCount: availableActions.actions.length,
        myWorkItemCount: myWork.items.length,
      },
      result: "success",
    });

    return {
      asOf: asOfIso,
      userContext,
      availableActions,
      myWork,
      needsAttention,
      portfolioSummary,
      activeProjects,
      currentPi,
      resourceCapacity,
      warnings,
    };
  }

  private async loadOwnRoleBindings(
    principalId: string,
  ): Promise<HomeRoleBindingSummary[]> {
    const rows = await this.db.roleBinding.findMany({
      where: { principalId, effectiveTo: null },
      include: {
        roleDefinition: { select: { key: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return rows.map((b) => ({
      roleKey: b.roleDefinition.key,
      roleName: b.roleDefinition.name,
      scopeType: b.scopeType,
      organizationId: b.organizationId,
      scopeId: b.scopeId,
    }));
  }

  private async findLinkedResource(principalId: string) {
    const resource = await this.db.resource.findFirst({
      where: {
        linkedPrincipalId: principalId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        type: true,
      },
    });
    if (!resource) return null;
    return {
      resourceId: resource.id,
      name: resource.name,
      organizationId: resource.organizationId,
      type: resource.type,
    };
  }

  private detectManagerSignals(
    capabilities: ShellNavCapabilities,
    roleBindings: HomeRoleBindingSummary[],
  ): boolean {
    if (
      capabilities.canCreateInitiative ||
      capabilities.canCreatePi ||
      capabilities.canViewApprovals ||
      capabilities.canViewDecisions ||
      capabilities.canManageAccess ||
      capabilities.canManageGovernancePolicy
    ) {
      return true;
    }
    return roleBindings.some((b) => MANAGER_ROLE_KEYS.has(b.roleKey));
  }

  private resolveMode(
    managerSignals: boolean,
    hasLinkedResource: boolean,
  ): HomeDashboardMode {
    if (managerSignals && hasLinkedResource) return "mixed";
    if (managerSignals) return "manager";
    return "employee";
  }

  private async resolvePiEntry(
    principal: Principal,
    organizationId: string,
    capabilities: ShellNavCapabilities,
  ): Promise<AuthorizedPiEntry | null> {
    if (!capabilities.canViewPi) return null;
    try {
      const pis = await this.planning.listProgramIncrements(
        principal,
        organizationId,
      );
      return selectAuthorizedPiEntry(
        pis.map((p) => ({
          id: p.id,
          status: p.status,
          startDate: p.startDate,
          referenceKey: p.referenceKey,
          name: p.name,
        })),
      );
    } catch (err) {
      if (isAppError(err) && (err.code === "FORBIDDEN" || err.code === "NOT_FOUND")) {
        return null;
      }
      return null;
    }
  }

  private buildAvailableActions(input: {
    capabilities: ShellNavCapabilities;
    preferredOrganizationId: string | null;
    preferredScope: HomeAuthorizedScope;
    piEntry: AuthorizedPiEntry | null;
    asOfIso: string;
    canManageResources: boolean;
    canReadStructure: boolean;
  }): HomeAvailableActions {
    const {
      capabilities,
      preferredOrganizationId,
      preferredScope,
      piEntry,
      asOfIso,
      canManageResources,
      canReadStructure,
    } = input;
    const orgQ = preferredOrganizationId
      ? `?organizationId=${preferredOrganizationId}`
      : "";
    const actions: HomeQuickAction[] = [];

    if (capabilities.canCreateInitiative) {
      actions.push({
        id: "create-initiative",
        label: "Create Initiative",
        href: "/initiatives/new",
        authorizationBasis: PERMISSIONS.INITIATIVE_CREATE,
        primary: true,
      });
    }
    if (capabilities.canViewInitiatives) {
      actions.push({
        id: "view-projects",
        label: "View Projects",
        href: preferredOrganizationId
          ? `/portfolio/explorer${orgQ}`
          : "/portfolio/explorer",
        authorizationBasis: PERMISSIONS.INITIATIVE_VIEW,
      });
    }
    if (capabilities.canViewPi) {
      actions.push({
        id: "open-pi-planning",
        label: "Open PI Planning",
        href: piEntry?.href ?? "/pi",
        authorizationBasis: PERMISSIONS.PI_VIEW,
        primary: !capabilities.canCreateInitiative,
      });
    }
    if (capabilities.canViewApprovals || capabilities.canViewDecisions) {
      actions.push({
        id: "review-governance",
        label: "Review Governance",
        href: capabilities.canViewApprovals ? "/approvals" : "/decisions",
        authorizationBasis: capabilities.canViewApprovals
          ? PERMISSIONS.APPROVAL_REVIEW
          : PERMISSIONS.DECISION_MAKE,
      });
    }
    actions.push({
      id: "open-portfolio",
      label: "Open Portfolio",
      href: preferredOrganizationId ? `/portfolio${orgQ}` : "/portfolio",
      authorizationBasis: "shell.portfolio",
    });
    if (canManageResources && preferredOrganizationId) {
      actions.push({
        id: "manage-resources",
        label: "Manage Resources",
        href: `/organization/${preferredOrganizationId}/resources`,
        authorizationBasis: PERMISSIONS.ORG_STRUCTURE_MANAGE,
      });
    } else if (canReadStructure && preferredOrganizationId) {
      actions.push({
        id: "view-resources",
        label: "View Resources",
        href: `/organization/${preferredOrganizationId}/resources`,
        authorizationBasis: PERMISSIONS.ORG_STRUCTURE_READ,
      });
    }

    // Also surface capability-aware shell quick links (deduped by id).
    const shellLinks = buildHomeQuickLinks({
      capabilities,
      organizationId: preferredOrganizationId,
      piEntry,
    });
    const seen = new Set(actions.map((a) => a.id));
    for (const link of shellLinks) {
      if (seen.has(link.id)) continue;
      // Skip generic duplicates already covered by explicit Quick Start ids.
      if (
        link.id === "initiatives" ||
        link.id === "initiative-new" ||
        link.id === "pi-list" ||
        link.id === "pi-entry" ||
        link.id === "approvals" ||
        link.id === "decisions" ||
        link.id === "portfolio"
      ) {
        continue;
      }
      actions.push({
        id: link.id,
        label: link.label,
        href: link.href,
        authorizationBasis: "shell.capability",
        primary: link.primary,
      });
      seen.add(link.id);
    }

    return {
      ...metaUnavailable(
        preferredScope,
        "ShellNavCapabilities + RoleBinding permissions (buildHomeQuickLinks)",
        actions.length === 0
          ? {
              state: "empty",
              reason: "No authorized Quick Start actions for this principal.",
            }
          : { state: "available" },
        actions.map((a) => ({
          id: a.id,
          label: a.label,
          href: a.href,
        })),
        asOfIso,
      ),
      actions,
    };
  }

  private async buildMyWork(input: {
    principal: Principal;
    linkedResource: HomeUserContext["linkedResource"];
    capabilities: ShellNavCapabilities;
    preferredOrganizationId: string | null;
    preferredScope: HomeAuthorizedScope;
    myWorkLimit: number;
    asOfIso: string;
  }): Promise<HomeMyWorkSection> {
    const {
      principal,
      linkedResource,
      capabilities,
      preferredScope,
      myWorkLimit,
      asOfIso,
    } = input;

    const items: HomeMyWorkItem[] = [];
    const totals = {
      initiatives: 0,
      projects: 0,
      workItems: 0,
      approvals: 0,
      decisions: 0,
      other: 0,
    };
    let truncated = false;
    const drillDown: HomeMyWorkSection["drillDown"] = [];

    if (!linkedResource) {
      // Still allow governance pending items via role permission.
      const govItems = await this.loadGovernanceMyWork(
        principal,
        capabilities,
        myWorkLimit,
      );
      for (const item of govItems.items) items.push(item);
      totals.approvals = govItems.approvalCount;
      totals.decisions = govItems.decisionCount;
      truncated = govItems.truncated;

      if (capabilities.canViewApprovals) {
        drillDown.push({
          id: "approvals",
          label: "Approvals",
          href: "/approvals",
        });
      }
      if (capabilities.canViewDecisions) {
        drillDown.push({
          id: "decisions",
          label: "Decisions",
          href: "/decisions",
        });
      }

      const availability: HomeSectionAvailability =
        items.length > 0
          ? { state: "available" }
          : {
              state: "no_linked_resource",
              reason:
                "No ACTIVE Resource is linked to this Principal via linkedPrincipalId. Ownership-based My Work cannot be attributed. Free-text owner names are never used as identity.",
            };

      return {
        ...metaUnavailable(
          preferredScope,
          "Resource.linkedPrincipalId + OrganizationService.getResourceOwnership + Governance listMy*",
          availability,
          drillDown,
          asOfIso,
        ),
        items,
        totals,
        truncated,
      };
    }

    let orgName = linkedResource.organizationId;
    try {
      // Self-link is proven identity (ADR-020/021). Query ownership rows directly
      // for the linked Resource so employees are not blocked solely by
      // ORG_STRUCTURE_READ on getResourceOwnership. Never use free-text owners.
      const o = await this.loadSelfLinkedOwnership(linkedResource.resourceId);
      const resourceId = linkedResource.resourceId;
      orgName =
        (
          await this.db.organization.findUnique({
            where: { id: linkedResource.organizationId },
            select: { name: true },
          })
        )?.name ?? linkedResource.organizationId;

      const push = (
        item: HomeMyWorkItem,
        bucket: keyof typeof totals,
      ) => {
        totals[bucket] += 1;
        if (items.length < myWorkLimit) {
          items.push(item);
        } else {
          truncated = true;
        }
      };

      const attr = (
        relationship: Extract<
          HomeMyWorkAttribution,
          { basis: "resource_link" }
        >["relationship"],
      ): HomeMyWorkAttribution => ({
        basis: "resource_link",
        resourceId,
        relationship,
      });

      for (const init of o.initiativesAsBusinessOwner) {
        push(
          {
            id: init.id,
            kind: "initiative",
            referenceKey: init.referenceKey,
            title: init.title,
            status: init.status,
            href: `/initiatives/${init.id}`,
            organizationId: linkedResource.organizationId,
            attribution: attr("INITIATIVE_BUSINESS_OWNER"),
          },
          "initiatives",
        );
      }
      for (const init of o.initiativesAsRequester) {
        push(
          {
            id: `req-${init.id}`,
            kind: "initiative",
            referenceKey: init.referenceKey,
            title: init.title,
            status: null,
            href: `/initiatives/${init.id}`,
            organizationId: linkedResource.organizationId,
            attribution: attr("INITIATIVE_REQUESTER"),
          },
          "initiatives",
        );
      }
      for (const init of o.initiativesAsSponsor) {
        push(
          {
            id: `spn-${init.id}`,
            kind: "initiative",
            referenceKey: init.referenceKey,
            title: init.title,
            status: null,
            href: `/initiatives/${init.id}`,
            organizationId: linkedResource.organizationId,
            attribution: attr("INITIATIVE_SPONSOR"),
          },
          "initiatives",
        );
      }
      for (const project of o.projects) {
        push(
          {
            id: project.id,
            kind: "project",
            referenceKey: project.referenceKey,
            title: project.name,
            status: project.status,
            href: `/initiatives/${project.initiativeId}?tab=project`,
            organizationId: linkedResource.organizationId,
            attribution: attr("PROJECT_OWNER"),
          },
          "projects",
        );
      }

      for (const wi of o.workItems) {
        push(
          {
            id: wi.id,
            kind: "work_item",
            referenceKey: wi.referenceKey,
            title: wi.title,
            status: wi.status,
            href: `/initiatives`, // project workspace via projectId
            organizationId: linkedResource.organizationId,
            attribution: attr("WORK_ITEM_OWNER"),
          },
          "workItems",
        );
      }
      // Enrich work item hrefs with project → initiative path.
      await this.enrichWorkItemHrefs(items);

      for (const poc of o.pocs) {
        push(
          {
            id: poc.id,
            kind: "poc",
            referenceKey: null,
            title: poc.title,
            status: poc.status,
            href: `/initiatives/${poc.initiativeId}`,
            organizationId: linkedResource.organizationId,
            attribution: attr("POC_OWNER"),
          },
          "other",
        );
      }
      for (const pilot of o.pilots) {
        push(
          {
            id: pilot.id,
            kind: "pilot",
            referenceKey: null,
            title: `Pilot (${pilot.status})`,
            status: pilot.status,
            href: `/initiatives/${pilot.initiativeId}`,
            organizationId: linkedResource.organizationId,
            attribution: attr("PILOT_OWNER"),
          },
          "other",
        );
      }
      for (const risk of o.risks) {
        push(
          {
            id: risk.id,
            kind: "risk",
            referenceKey: risk.referenceKey,
            title: risk.title,
            status: risk.status,
            href: `/initiatives/${risk.initiativeId}`,
            organizationId: linkedResource.organizationId,
            attribution: attr("RISK_OWNER"),
          },
          "other",
        );
      }
      for (const ms of o.milestones) {
        push(
          {
            id: ms.id,
            kind: "milestone",
            referenceKey: ms.referenceKey,
            title: ms.title,
            status: ms.status,
            href: `/initiatives`,
            organizationId: linkedResource.organizationId,
            attribution: attr("MILESTONE_OWNER"),
          },
          "other",
        );
      }
      await this.enrichMilestoneHrefs(items);

      for (const dep of o.dependencies) {
        push(
          {
            id: dep.id,
            kind: "dependency",
            referenceKey: null,
            title: `${dep.type} dependency`,
            status: dep.status,
            href: `/pi`,
            organizationId: linkedResource.organizationId,
            attribution: attr("PLANNING_DEPENDENCY_OWNER"),
          },
          "other",
        );
      }
    } catch (err) {
      if (isAppError(err) && err.code === "FORBIDDEN") {
        return {
          ...metaUnavailable(
            preferredScope,
            "OrganizationService.getResourceOwnership",
            {
              state: "forbidden",
              reason: "Missing permission to read linked Resource ownership.",
            },
            drillDown,
            asOfIso,
          ),
          items: [],
          totals,
          truncated: false,
        };
      }
      return {
        ...metaUnavailable(
          preferredScope,
          "OrganizationService.getResourceOwnership",
          {
            state: "unavailable",
            reason:
              err instanceof Error
                ? err.message
                : "My Work ownership data is unavailable.",
          },
          drillDown,
          asOfIso,
        ),
        items: [],
        totals,
        truncated: false,
      };
    }

    const remaining = Math.max(0, myWorkLimit - items.length);
    if (remaining > 0 || items.length < myWorkLimit) {
      const govItems = await this.loadGovernanceMyWork(
        principal,
        capabilities,
        Math.max(remaining, myWorkLimit),
      );
      for (const item of govItems.items) {
        if (items.length < myWorkLimit) {
          items.push(item);
        } else {
          truncated = true;
        }
      }
      totals.approvals += govItems.approvalCount;
      totals.decisions += govItems.decisionCount;
      truncated = truncated || govItems.truncated;
    }

    if (capabilities.canViewInitiatives) {
      drillDown.push({
        id: "initiatives",
        label: "Initiatives",
        href: "/initiatives",
      });
    }
    if (capabilities.canViewApprovals) {
      drillDown.push({
        id: "approvals",
        label: "Approvals",
        href: "/approvals",
      });
    }

    const empty =
      items.length === 0 &&
      totals.initiatives +
        totals.projects +
        totals.workItems +
        totals.approvals +
        totals.decisions +
        totals.other ===
        0;

    return {
      ...metaUnavailable(
        {
          mode: "organization",
          organizationId: linkedResource.organizationId,
          organizationName: orgName,
        },
        "Resource.linkedPrincipalId + ownership FKs + listMyApprovals/listMyDecisions",
        empty
          ? {
              state: "empty",
              reason:
                "Linked Resource has no proven ownership relationships and no pending governance actions.",
            }
          : { state: "available" },
        drillDown,
        asOfIso,
      ),
      items,
      totals,
      truncated,
    };
  }

  /**
   * Bounded ownership read for a Resource already proven linked to the
   * calling Principal. Mirrors OrganizationService.getResourceOwnership
   * selects without requiring ORG_STRUCTURE_READ on the caller.
   */
  private async loadSelfLinkedOwnership(resourceId: string) {
    const [
      initiativesAsBusinessOwner,
      initiativesAsRequester,
      initiativesAsSponsor,
      projects,
      pocs,
      pilots,
      risks,
      workItems,
      milestones,
      dependencies,
    ] = await Promise.all([
      this.db.initiative.findMany({
        where: { businessOwnerResourceId: resourceId },
        select: {
          id: true,
          referenceKey: true,
          title: true,
          currentStage: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.initiative.findMany({
        where: { requesterResourceId: resourceId },
        select: { id: true, referenceKey: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.initiative.findMany({
        where: { sponsorResourceId: resourceId },
        select: { id: true, referenceKey: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.project.findMany({
        where: { ownerResourceId: resourceId },
        select: {
          id: true,
          referenceKey: true,
          name: true,
          status: true,
          initiativeId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.poC.findMany({
        where: { ownerResourceId: resourceId },
        select: {
          id: true,
          title: true,
          status: true,
          initiativeId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.pilot.findMany({
        where: { ownerResourceId: resourceId },
        select: { id: true, status: true, initiativeId: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.risk.findMany({
        where: { ownerResourceId: resourceId },
        select: {
          id: true,
          referenceKey: true,
          title: true,
          status: true,
          initiativeId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.projectWorkItem.findMany({
        where: { ownerResourceId: resourceId },
        select: {
          id: true,
          referenceKey: true,
          title: true,
          status: true,
          projectId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.projectMilestone.findMany({
        where: { ownerResourceId: resourceId },
        select: {
          id: true,
          referenceKey: true,
          title: true,
          status: true,
          projectId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
      this.db.planningDependency.findMany({
        where: { ownerResourceId: resourceId },
        select: {
          id: true,
          type: true,
          status: true,
          sourceType: true,
          targetType: true,
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_MY_WORK_LIMIT,
      }),
    ]);

    return {
      initiativesAsBusinessOwner,
      initiativesAsRequester,
      initiativesAsSponsor,
      projects,
      pocs,
      pilots,
      risks,
      workItems,
      milestones,
      dependencies,
    };
  }

  private async enrichWorkItemHrefs(items: HomeMyWorkItem[]) {
    const wiItems = items.filter((i) => i.kind === "work_item");
    if (wiItems.length === 0) return;
    const rows = await this.db.projectWorkItem.findMany({
      where: { id: { in: wiItems.map((w) => w.id) } },
      select: {
        id: true,
        project: { select: { initiativeId: true } },
      },
      take: MAX_MY_WORK_LIMIT,
    });
    const map = new Map(
      rows.map((r) => [r.id, r.project.initiativeId] as const),
    );
    for (const item of wiItems) {
      const initiativeId = map.get(item.id);
      if (initiativeId) {
        item.href = `/initiatives/${initiativeId}?tab=project`;
      }
    }
  }

  private async enrichMilestoneHrefs(items: HomeMyWorkItem[]) {
    const msItems = items.filter((i) => i.kind === "milestone");
    if (msItems.length === 0) return;
    const rows = await this.db.projectMilestone.findMany({
      where: { id: { in: msItems.map((m) => m.id) } },
      select: {
        id: true,
        project: { select: { initiativeId: true } },
      },
      take: MAX_MY_WORK_LIMIT,
    });
    const map = new Map(
      rows.map((r) => [r.id, r.project.initiativeId] as const),
    );
    for (const item of msItems) {
      const initiativeId = map.get(item.id);
      if (initiativeId) {
        item.href = `/initiatives/${initiativeId}?tab=project`;
      }
    }
  }

  private async loadGovernanceMyWork(
    principal: Principal,
    capabilities: ShellNavCapabilities,
    limit: number,
  ): Promise<{
    items: HomeMyWorkItem[];
    approvalCount: number;
    decisionCount: number;
    truncated: boolean;
  }> {
    const items: HomeMyWorkItem[] = [];
    let approvalCount = 0;
    let decisionCount = 0;
    let truncated = false;

    if (capabilities.canViewApprovals) {
      try {
        const approvals = await this.governance.listMyApprovals(principal);
        approvalCount = approvals.length;
        for (const req of approvals) {
          if (items.length >= limit) {
            truncated = true;
            break;
          }
          items.push({
            id: req.id,
            kind: "approval",
            referenceKey: req.submission.initiative.referenceKey,
            title: `${req.label}: ${req.submission.initiative.title}`,
            status: req.status,
            href: `/initiatives/${req.submission.initiativeId}`,
            organizationId: req.submission.initiative.organizationId,
            attribution: {
              basis: "role_permission",
              permission: req.requiredPermission,
              relationship: "PENDING_APPROVAL",
            },
          });
        }
      } catch {
        // Leave approvals empty; surface via needsAttention/warnings elsewhere.
      }
    }

    if (capabilities.canViewDecisions) {
      try {
        const decisions = await this.governance.listMyDecisions(principal);
        decisionCount = decisions.length;
        for (const sub of decisions) {
          if (items.length >= limit) {
            truncated = true;
            break;
          }
          items.push({
            id: sub.id,
            kind: "decision",
            referenceKey: sub.initiative.referenceKey,
            title: `${sub.gate.gateType}: ${sub.initiative.title}`,
            status: sub.status,
            href: `/initiatives/${sub.initiativeId}`,
            organizationId: sub.initiative.organizationId,
            attribution: {
              basis: "role_permission",
              permission: PERMISSIONS.DECISION_MAKE,
              relationship: "PENDING_DECISION",
            },
          });
        }
      } catch {
        // ignore
      }
    }

    return { items, approvalCount, decisionCount, truncated };
  }

  private async buildNeedsAttention(input: {
    principal: Principal;
    preferredOrganizationId: string | null;
    preferredScope: HomeAuthorizedScope;
    capabilities: ShellNavCapabilities;
    attentionLimit: number;
    asOfIso: string;
    warnings: HomeDashboardWarning[];
  }): Promise<HomeNeedsAttentionSection> {
    const {
      principal,
      preferredOrganizationId,
      preferredScope,
      capabilities,
      attentionLimit,
      asOfIso,
      warnings,
    } = input;

    if (!preferredOrganizationId) {
      return {
        ...metaUnavailable(
          preferredScope,
          "PortfolioQueryService.getDeliveryHealthSummary + getOverviewMetrics",
          {
            state: "no_organization",
            reason: "No preferred organization to evaluate attention.",
          },
          [],
          asOfIso,
        ),
        items: [],
        counts: {
          blockedOrAtRiskProjects: null,
          initiativesNeedingAttention: null,
          waitingForApproval: null,
          pisNeedingAttention: null,
        },
      };
    }

    const orgQ = `?organizationId=${preferredOrganizationId}`;
    const items: HomeAttentionItem[] = [];
    let blockedOrAtRiskProjects: number | null = null;
    let initiativesNeedingAttention: number | null = null;
    let waitingForApproval: number | null = null;
    let pisNeedingAttention: number | null = null;
    let healthAsOf: string | null = null;
    let availability: HomeSectionAvailability = { state: "available" };
    let portfolioScope = preferredScope;

    const [overviewResult, piMetricsResult, healthResult, attentionResult] =
      await Promise.allSettled([
        this.initiative.getOverviewMetrics(principal),
        this.planning.getExecutivePiMetrics(principal),
        this.portfolio.getDeliveryHealthSummary(principal, {
          organizationId: preferredOrganizationId,
        }),
        this.portfolio.listDeliveryHealthAttention(principal, {
          organizationId: preferredOrganizationId,
          sortBy: "classification",
          sortDir: "asc",
          page: 1,
          pageSize: attentionLimit,
        }),
      ]);

    if (overviewResult.status === "fulfilled") {
      initiativesNeedingAttention = overviewResult.value.needsAttention;
      waitingForApproval = overviewResult.value.waitingForApproval;
      if (overviewResult.value.needsAttention > 0 && capabilities.canViewInitiatives) {
        items.push({
          id: "initiatives-attention",
          kind: "initiative",
          label: `${overviewResult.value.needsAttention} initiative(s) need attention`,
          detail: null,
          severity: "warning",
          href: "/initiatives",
          organizationId: preferredOrganizationId,
        });
      }
      if (
        overviewResult.value.waitingForApproval > 0 &&
        capabilities.canViewApprovals
      ) {
        items.push({
          id: "waiting-approval",
          kind: "governance",
          label: `${overviewResult.value.waitingForApproval} waiting for approval`,
          detail: null,
          severity: "warning",
          href: "/approvals",
          organizationId: preferredOrganizationId,
        });
      }
    } else {
      warnings.push({
        code: "OVERVIEW_METRICS_UNAVAILABLE",
        message: "Initiative overview metrics are unavailable for Home attention.",
        organizationId: preferredOrganizationId,
      });
    }

    if (piMetricsResult.status === "fulfilled") {
      pisNeedingAttention = piMetricsResult.value.piNeedsAttention;
      if (
        piMetricsResult.value.piNeedsAttention > 0 &&
        capabilities.canViewPi
      ) {
        items.push({
          id: "pi-attention",
          kind: "pi",
          label: `${piMetricsResult.value.piNeedsAttention} PI(s) need attention`,
          detail: null,
          severity: "warning",
          href: "/pi",
          organizationId: preferredOrganizationId,
        });
      }
    }

    if (healthResult.status === "fulfilled") {
      blockedOrAtRiskProjects = healthResult.value.attentionCount;
      healthAsOf = healthResult.value.asOf;
      portfolioScope = {
        mode: "portfolio",
        scope: healthResult.value.scope,
        organizationName:
          preferredScope.mode === "organization"
            ? preferredScope.organizationName
            : preferredOrganizationId,
      };
      if (healthResult.value.attentionCount > 0) {
        items.push({
          id: "delivery-health-attention",
          kind: "delivery_health",
          label: `${healthResult.value.attentionCount} project(s) blocked or at risk`,
          detail: null,
          severity: "blocker",
          href: `/portfolio/health${orgQ}&healthFocus=ATTENTION`,
          organizationId: preferredOrganizationId,
        });
      }
    } else if (
      healthResult.status === "rejected" &&
      isAppError(healthResult.reason) &&
      healthResult.reason.code === "FORBIDDEN"
    ) {
      availability = {
        state: "forbidden",
        reason: "No portfolio view permission for delivery health in this organization.",
      };
    } else if (healthResult.status === "rejected") {
      availability = {
        state: "unavailable",
        reason:
          healthResult.reason instanceof Error
            ? healthResult.reason.message
            : "Delivery health is unavailable.",
      };
      warnings.push({
        code: "DELIVERY_HEALTH_UNAVAILABLE",
        message: availability.reason!,
        organizationId: preferredOrganizationId,
      });
    }

    if (attentionResult.status === "fulfilled") {
      for (const row of attentionResult.value.rows) {
        items.push({
          id: `project-${row.projectId}`,
          kind: "delivery_health",
          label: `${row.referenceKey}: ${row.name}`,
          detail: row.classification,
          severity:
            row.classification === "BLOCKED" ? "blocker" : "warning",
          href: row.href,
          organizationId: preferredOrganizationId,
        });
      }
    }

    if (
      availability.state === "available" &&
      items.length === 0 &&
      blockedOrAtRiskProjects === 0 &&
      (initiativesNeedingAttention ?? 0) === 0 &&
      (waitingForApproval ?? 0) === 0 &&
      (pisNeedingAttention ?? 0) === 0
    ) {
      availability = {
        state: "empty",
        reason: "No items currently need attention in the preferred organization.",
      };
    }

    // If health was forbidden and we have no other signals, keep forbidden.
    if (
      availability.state === "forbidden" &&
      (initiativesNeedingAttention !== null ||
        waitingForApproval !== null ||
        pisNeedingAttention !== null)
    ) {
      // Partial: overview still available — demote to available with warning.
      availability = { state: "available" };
      warnings.push({
        code: "DELIVERY_HEALTH_FORBIDDEN",
        message:
          "Delivery health section is not authorized; other attention signals may still appear.",
        organizationId: preferredOrganizationId,
      });
    }

    return {
      ...metaUnavailable(
        portfolioScope,
        "getDeliveryHealthSummary + listDeliveryHealthAttention + getOverviewMetrics + getExecutivePiMetrics",
        availability,
        [
          {
            id: "health",
            label: "Delivery health",
            href: `/portfolio/health${orgQ}`,
          },
          ...(capabilities.canViewApprovals
            ? [{ id: "approvals", label: "Approvals", href: "/approvals" }]
            : []),
          ...(capabilities.canViewPi
            ? [{ id: "pi", label: "PI Planning", href: "/pi" }]
            : []),
        ],
        healthAsOf ?? asOfIso,
      ),
      items: items.slice(0, attentionLimit + 5),
      counts: {
        blockedOrAtRiskProjects,
        initiativesNeedingAttention,
        waitingForApproval,
        pisNeedingAttention,
      },
    };
  }

  private async buildPortfolioSummary(input: {
    principal: Principal;
    preferredOrganizationId: string | null;
    preferredScope: HomeAuthorizedScope;
    capabilities: ShellNavCapabilities;
    asOfIso: string;
    warnings: HomeDashboardWarning[];
  }): Promise<HomePortfolioSummarySection> {
    const {
      principal,
      preferredOrganizationId,
      preferredScope,
      capabilities,
      asOfIso,
      warnings,
    } = input;

    if (!preferredOrganizationId) {
      return {
        ...metaUnavailable(
          preferredScope,
          "PortfolioQueryService.getPortfolioSnapshot + getOverviewMetrics",
          {
            state: "no_organization",
            reason: "No preferred organization for portfolio summary.",
          },
          [],
          asOfIso,
        ),
        metrics: [],
      };
    }

    const orgQ = `?organizationId=${preferredOrganizationId}`;
    const metrics: HomeMetricValue[] = [];
    let scope = preferredScope;
    let availability: HomeSectionAvailability = { state: "available" };
    let snapAsOf: string | null = null;

    const [snapResult, overviewResult] = await Promise.allSettled([
      this.portfolio.getPortfolioSnapshot(principal, {
        organizationId: preferredOrganizationId,
      }),
      this.initiative.getOverviewMetrics(principal),
    ]);

    if (snapResult.status === "fulfilled") {
      const snap = snapResult.value;
      snapAsOf = snap.asOf;
      scope = {
        mode: "portfolio",
        scope: snap.scope,
        organizationName:
          preferredScope.mode === "organization"
            ? preferredScope.organizationName
            : preferredOrganizationId,
      };

      const addMetric = (
        key: string,
        label: string,
        metric: { available: boolean; value?: { [k: string]: unknown } | number },
        pick: () => number | null,
        href: string | null,
        source: string,
        unavailableReason?: string,
      ) => {
        if (!metric.available) {
          metrics.push({
            key,
            label,
            value: null,
            available: false,
            unavailableReason:
              unavailableReason ??
              ("reason" in metric
                ? String((metric as { reason?: string }).reason)
                : "Unavailable"),
            href,
            source,
          });
          return;
        }
        metrics.push({
          key,
          label,
          value: pick(),
          available: true,
          href,
          source,
        });
      };

      if (snap.initiatives.available) {
        metrics.push({
          key: "active-initiatives",
          label: "Active Initiatives",
          value: snap.initiatives.value.total,
          available: true,
          href: capabilities.canViewInitiatives ? "/initiatives" : null,
          source: "getPortfolioSnapshot.initiatives",
        });
      } else {
        metrics.push({
          key: "active-initiatives",
          label: "Active Initiatives",
          value: null,
          available: false,
          unavailableReason: snap.initiatives.reason,
          href: null,
          source: "getPortfolioSnapshot.initiatives",
        });
      }

      if (snap.projects.available) {
        metrics.push({
          key: "active-projects",
          label: "Active Projects",
          value: snap.projects.value.active,
          available: true,
          href: `/portfolio/explorer${orgQ}`,
          source: "getPortfolioSnapshot.projects",
        });
      } else {
        addMetric(
          "active-projects",
          "Active Projects",
          snap.projects,
          () => null,
          null,
          "getPortfolioSnapshot.projects",
          snap.projects.available ? undefined : snap.projects.reason,
        );
      }

      if (snap.governance.available) {
        metrics.push({
          key: "pending-governance",
          label: "Pending Governance",
          value:
            snap.governance.value.waitingForApproval +
            snap.governance.value.waitingForDecision,
          available: true,
          href: capabilities.canViewApprovals ? "/approvals" : "/decisions",
          source: "getPortfolioSnapshot.governance",
        });
      } else {
        metrics.push({
          key: "pending-governance",
          label: "Pending Governance",
          value: null,
          available: false,
          unavailableReason: snap.governance.reason,
          href: null,
          source: "getPortfolioSnapshot.governance",
        });
      }

      if (snap.delayedProjects.available) {
        metrics.push({
          key: "delayed-projects",
          label: "Delayed Projects",
          value: snap.delayedProjects.value.delayedProjects,
          available: true,
          href: `/portfolio/health${orgQ}`,
          source: "getPortfolioSnapshot.delayedProjects",
        });
      } else {
        metrics.push({
          key: "delayed-projects",
          label: "Delayed Projects",
          value: null,
          available: false,
          unavailableReason: snap.delayedProjects.reason,
          href: null,
          source: "getPortfolioSnapshot.delayedProjects",
        });
      }

      if (snap.piCapacity.available) {
        metrics.push({
          key: "overloaded-teams",
          label: "Overloaded Teams",
          value: snap.piCapacity.value.overloadedTeamIterations,
          available: true,
          href: `/portfolio/capacity${orgQ}`,
          source: "getPortfolioSnapshot.piCapacity",
        });
        metrics.push({
          key: "pi-capacity-utilization-rows",
          label: "PI Capacity Team Rows",
          value: snap.piCapacity.value.teamIterationRows,
          available: true,
          href: `/portfolio/capacity${orgQ}`,
          source: "getPortfolioSnapshot.piCapacity",
        });
      } else {
        metrics.push({
          key: "overloaded-teams",
          label: "Overloaded Teams",
          value: null,
          available: false,
          unavailableReason: snap.piCapacity.reason,
          href: `/portfolio/capacity${orgQ}`,
          source: "getPortfolioSnapshot.piCapacity",
        });
      }
    } else if (
      snapResult.status === "rejected" &&
      isAppError(snapResult.reason) &&
      snapResult.reason.code === "FORBIDDEN"
    ) {
      availability = {
        state: "forbidden",
        reason: "Missing portfolio view permission for this organization.",
      };
    } else if (snapResult.status === "rejected") {
      availability = {
        state: "unavailable",
        reason:
          snapResult.reason instanceof Error
            ? snapResult.reason.message
            : "Portfolio snapshot unavailable.",
      };
      warnings.push({
        code: "PORTFOLIO_SNAPSHOT_UNAVAILABLE",
        message: availability.reason!,
        organizationId: preferredOrganizationId,
      });
    }

    // Supplement at-risk from overview when snapshot succeeded or partially.
    if (overviewResult.status === "fulfilled") {
      metrics.push({
        key: "projects-at-risk-overview",
        label: "Projects At Risk (overview)",
        value: overviewResult.value.projectsAtRisk,
        available: true,
        href: `/portfolio/health${orgQ}&healthFocus=ATTENTION`,
        source: "getOverviewMetrics.projectsAtRisk",
      });
    }

    if (
      availability.state === "available" &&
      metrics.every((m) => m.available && m.value === 0)
    ) {
      availability = {
        state: "empty",
        reason: "Portfolio exists but currently has zero countable activity.",
      };
    }

    return {
      ...metaUnavailable(
        scope,
        "PortfolioQueryService.getPortfolioSnapshot (+ overview supplement)",
        availability,
        [
          {
            id: "portfolio",
            label: "Portfolio",
            href: `/portfolio${orgQ}`,
          },
          {
            id: "explorer",
            label: "Explorer",
            href: `/portfolio/explorer${orgQ}`,
          },
        ],
        snapAsOf ?? asOfIso,
      ),
      metrics,
    };
  }

  private async buildActiveProjects(input: {
    principal: Principal;
    preferredOrganizationId: string | null;
    preferredScope: HomeAuthorizedScope;
    attentionLimit: number;
    asOfIso: string;
    warnings: HomeDashboardWarning[];
  }): Promise<HomeActiveProjectsSection> {
    const {
      principal,
      preferredOrganizationId,
      preferredScope,
      attentionLimit,
      asOfIso,
      warnings,
    } = input;

    if (!preferredOrganizationId) {
      return {
        ...metaUnavailable(
          preferredScope,
          "listDeliveryHealthAttention + getPortfolioSnapshot.projects",
          {
            state: "no_organization",
            reason: "No preferred organization for active projects.",
          },
          [],
          asOfIso,
        ),
        rows: [],
        activeProjectCount: null,
        blockedOrAtRiskCount: null,
      };
    }

    const orgQ = `?organizationId=${preferredOrganizationId}`;
    try {
      const [attention, snap] = await Promise.all([
        this.portfolio.listDeliveryHealthAttention(principal, {
          organizationId: preferredOrganizationId,
          sortBy: "classification",
          sortDir: "asc",
          page: 1,
          pageSize: attentionLimit,
        }),
        this.portfolio.getPortfolioSnapshot(principal, {
          organizationId: preferredOrganizationId,
        }),
      ]);

      const activeProjectCount = snap.projects.available
        ? snap.projects.value.active
        : null;
      const blockedOrAtRiskCount = attention.attentionCount;

      const rows = attention.rows.map((r) => ({
        projectId: r.projectId,
        initiativeId: r.initiativeId,
        referenceKey: r.referenceKey,
        name: r.name,
        href: r.href,
        classification: r.classification,
        departmentName: r.departmentName,
      }));

      let availability: HomeSectionAvailability = { state: "available" };
      if (
        (activeProjectCount === 0 || activeProjectCount === null) &&
        rows.length === 0
      ) {
        availability = {
          state: "empty",
          reason: "No active or attention-ranked projects in preferred organization.",
        };
      }

      return {
        ...metaUnavailable(
          {
            mode: "portfolio",
            scope: attention.scope,
            organizationName:
              preferredScope.mode === "organization"
                ? preferredScope.organizationName
                : preferredOrganizationId,
          },
          "listDeliveryHealthAttention + getPortfolioSnapshot.projects",
          availability,
          [
            {
              id: "explorer",
              label: "Explorer",
              href: `/portfolio/explorer${orgQ}`,
            },
            {
              id: "health",
              label: "Delivery health",
              href: `/portfolio/health${orgQ}`,
            },
          ],
          attention.asOf,
        ),
        rows,
        activeProjectCount,
        blockedOrAtRiskCount,
      };
    } catch (err) {
      if (isAppError(err) && err.code === "FORBIDDEN") {
        return {
          ...metaUnavailable(
            preferredScope,
            "listDeliveryHealthAttention + getPortfolioSnapshot.projects",
            {
              state: "forbidden",
              reason: "Missing portfolio view permission for projects.",
            },
            [],
            asOfIso,
          ),
          rows: [],
          activeProjectCount: null,
          blockedOrAtRiskCount: null,
        };
      }
      const reason =
        err instanceof Error ? err.message : "Active projects unavailable.";
      warnings.push({
        code: "ACTIVE_PROJECTS_UNAVAILABLE",
        message: reason,
        organizationId: preferredOrganizationId,
      });
      return {
        ...metaUnavailable(
          preferredScope,
          "listDeliveryHealthAttention + getPortfolioSnapshot.projects",
          { state: "unavailable", reason },
          [],
          asOfIso,
        ),
        rows: [],
        activeProjectCount: null,
        blockedOrAtRiskCount: null,
      };
    }
  }

  private async buildCurrentPi(input: {
    principal: Principal;
    preferredOrganizationId: string | null;
    preferredScope: HomeAuthorizedScope;
    capabilities: ShellNavCapabilities;
    piEntry: AuthorizedPiEntry | null;
    asOfIso: string;
    warnings: HomeDashboardWarning[];
  }): Promise<HomeCurrentPiSection> {
    const {
      principal,
      preferredOrganizationId,
      preferredScope,
      capabilities,
      piEntry,
      asOfIso,
      warnings,
    } = input;

    if (!capabilities.canViewPi) {
      return {
        ...metaUnavailable(
          preferredScope,
          "PlanningService.listProgramIncrements + getExecutivePiMetrics",
          {
            state: "no_permission",
            reason: "Principal lacks PI_VIEW in accessible organizations.",
          },
          [],
          asOfIso,
        ),
        pi: null,
        metrics: [],
      };
    }

    if (!preferredOrganizationId) {
      return {
        ...metaUnavailable(
          preferredScope,
          "PlanningService.listProgramIncrements + getExecutivePiMetrics",
          {
            state: "no_organization",
            reason: "No preferred organization for Current PI.",
          },
          [],
          asOfIso,
        ),
        pi: null,
        metrics: [],
      };
    }

    const metrics: HomeMetricValue[] = [];
    try {
      const piMetrics = await this.planning.getExecutivePiMetrics(principal);
      metrics.push(
        {
          key: "program-increments",
          label: "Program Increments",
          value: piMetrics.programIncrements,
          available: true,
          href: "/pi",
          source: "getExecutivePiMetrics",
        },
        {
          key: "pi-active",
          label: "PIs Active",
          value: piMetrics.piActive,
          available: true,
          href: "/pi",
          source: "getExecutivePiMetrics",
        },
        {
          key: "pi-in-review",
          label: "PIs In Review",
          value: piMetrics.piInReview,
          available: true,
          href: "/pi",
          source: "getExecutivePiMetrics",
        },
        {
          key: "pi-needs-attention",
          label: "PIs Needing Attention",
          value: piMetrics.piNeedsAttention,
          available: true,
          href: "/pi",
          source: "getExecutivePiMetrics",
        },
      );
    } catch (err) {
      warnings.push({
        code: "PI_METRICS_UNAVAILABLE",
        message:
          err instanceof Error
            ? err.message
            : "Executive PI metrics unavailable.",
        organizationId: preferredOrganizationId,
      });
    }

    if (!piEntry) {
      return {
        ...metaUnavailable(
          preferredScope,
          "selectAuthorizedPiEntry + getExecutivePiMetrics",
          {
            state: "empty",
            reason:
              "No ACTIVE/REVIEW/BASELINED Program Increment is available in the preferred organization.",
          },
          [{ id: "pi-list", label: "PI Planning", href: "/pi" }],
          asOfIso,
        ),
        pi: null,
        metrics,
      };
    }

    return {
      ...metaUnavailable(
        preferredScope,
        "selectAuthorizedPiEntry + getExecutivePiMetrics",
        { state: "available" },
        [
          { id: "pi-entry", label: `Open ${piEntry.referenceKey}`, href: piEntry.href },
          { id: "pi-list", label: "PI Planning", href: "/pi" },
        ],
        asOfIso,
      ),
      pi: {
        id: piEntry.id,
        referenceKey: piEntry.referenceKey,
        name: piEntry.name,
        status: piEntry.status,
        href: piEntry.href,
      },
      metrics,
    };
  }

  private async buildResourceCapacity(input: {
    principal: Principal;
    preferredOrganizationId: string | null;
    preferredScope: HomeAuthorizedScope;
    capabilities: ShellNavCapabilities;
    piEntry: AuthorizedPiEntry | null;
    asOfIso: string;
    warnings: HomeDashboardWarning[];
  }): Promise<HomeResourceCapacitySection> {
    const {
      principal,
      preferredOrganizationId,
      preferredScope,
      capabilities,
      piEntry,
      asOfIso,
      warnings,
    } = input;

    const empty = (
      availability: HomeSectionAvailability,
      piId: string | null = null,
      piReferenceKey: string | null = null,
    ): HomeResourceCapacitySection => ({
      ...metaUnavailable(
        preferredScope,
        "PortfolioPiCapacityQueryService.getPiCapacityOverview (CURRENT revision only)",
        availability,
        preferredOrganizationId
          ? [
              {
                id: "capacity",
                label: "Resource Planning",
                href: `/portfolio/capacity?organizationId=${preferredOrganizationId}${
                  piId ? `&piId=${piId}` : ""
                }`,
              },
            ]
          : [],
        asOfIso,
      ),
      piId,
      piReferenceKey,
      overloadedTeamCount: null,
      underutilizedTeamCount: null,
      conflictCount: null,
      totals: null,
    });

    if (!preferredOrganizationId) {
      return empty({
        state: "no_organization",
        reason: "No preferred organization for capacity.",
      });
    }

    if (!capabilities.canViewPi) {
      return empty({
        state: "no_permission",
        reason: "Principal lacks PI_VIEW required for capacity overview.",
      });
    }

    if (!piEntry) {
      return empty({
        state: "empty",
        reason:
          "No entry-worthy Program Increment selected; capacity is not computed as zero.",
      });
    }

    try {
      const result = await this.portfolioPiCapacity.getPiCapacityOverview(
        principal,
        {
          organizationId: preferredOrganizationId,
          piId: piEntry.id,
        },
      );

      if (result.capacity.state === "no_pi_selected") {
        return empty(
          { state: "empty", reason: result.capacity.reason },
          piEntry.id,
          piEntry.referenceKey,
        );
      }
      if (result.capacity.state === "unavailable") {
        return empty(
          { state: "unavailable", reason: result.capacity.reason },
          piEntry.id,
          piEntry.referenceKey,
        );
      }

      const cap = result.capacity;

      return {
        ...metaUnavailable(
          {
            mode: "portfolio",
            scope: result.scope,
            organizationName:
              preferredScope.mode === "organization"
                ? preferredScope.organizationName
                : preferredOrganizationId,
          },
          "PortfolioPiCapacityQueryService.getPiCapacityOverview",
          { state: "available" },
          [
            {
              id: "capacity",
              label: "Resource Planning",
              href: `/portfolio/capacity?organizationId=${preferredOrganizationId}&piId=${piEntry.id}`,
            },
            {
              id: "pi-board",
              label: `Open ${piEntry.referenceKey}`,
              href: piEntry.href,
            },
          ],
          result.asOf,
        ),
        piId: piEntry.id,
        piReferenceKey: piEntry.referenceKey,
        overloadedTeamCount: cap.overloadedTeams.length,
        underutilizedTeamCount: cap.underutilizedTeams.length,
        conflictCount: cap.conflicts.length,
        totals: {
          effectiveCapacityHours: cap.totals.availableHours,
          plannedLoadHours: cap.totals.committedHours,
          utilization: cap.totals.utilization,
        },
      };
    } catch (err) {
      if (isAppError(err) && err.code === "FORBIDDEN") {
        return empty(
          {
            state: "forbidden",
            reason: "Missing permission to view PI capacity for this organization.",
          },
          piEntry.id,
          piEntry.referenceKey,
        );
      }
      const reason =
        err instanceof Error ? err.message : "Capacity overview unavailable.";
      warnings.push({
        code: "CAPACITY_UNAVAILABLE",
        message: reason,
        organizationId: preferredOrganizationId,
      });
      return empty(
        { state: "unavailable", reason },
        piEntry.id,
        piEntry.referenceKey,
      );
    }
  }
}

/** @internal exported for unit-style tests of mode resolution without DB. */
export function resolveHomeDashboardModeForTests(
  managerSignals: boolean,
  hasLinkedResource: boolean,
): HomeDashboardMode {
  if (managerSignals && hasLinkedResource) return "mixed";
  if (managerSignals) return "manager";
  return "employee";
}

export function emptyShellCapabilitiesForTests(): ShellNavCapabilities {
  return emptyCaps();
}
