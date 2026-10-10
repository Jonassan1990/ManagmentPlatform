/**
 * M5E-B — Management reports composed from existing portfolio / PI / governance
 * read models. No new business calculations.
 */
import type { PrismaClient } from "@prisma/client";
import type { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import type { GovernanceService } from "@/modules/governance/application/governance-service";
import type { PortfolioQueryService } from "@/modules/portfolio/application/portfolio-query-service";
import type { PortfolioPiCapacityQueryService } from "@/modules/portfolio/application/portfolio-pi-capacity-query-service";
import {
  CSV_MAX_ROWS,
  truncateRows,
} from "@/modules/portfolio/application/report-csv";
import type {
  ManagementReportFilterInput,
  ManagementReportPreview,
  ReportPreviewRow,
} from "@/modules/portfolio/domain/management-reports";

export class ManagementReportService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly portfolio: PortfolioQueryService,
    private readonly piCapacity: PortfolioPiCapacityQueryService,
    private readonly governance: GovernanceService,
  ) {}

  async getReportPreview(
    principal: Principal,
    input: ManagementReportFilterInput,
  ): Promise<ManagementReportPreview> {
    switch (input.reportType) {
      case "portfolio_summary":
        return this.portfolioSummary(principal, input);
      case "project_status":
        return this.projectStatus(principal, input);
      case "pi_capacity":
        return this.piCapacityReport(principal, input);
      case "resource_allocation":
        return this.resourceAllocation(principal, input);
      case "risks_blockers":
        return this.risksBlockers(principal, input);
      case "governance_decisions":
        return this.governanceDecisions(principal, input);
      default: {
        const _exhaustive: never = input.reportType;
        throw new Error(`Unknown report type: ${_exhaustive}`);
      }
    }
  }

  private async scopeLabel(
    organizationId: string,
    departmentId?: string,
  ): Promise<string> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    if (!departmentId) return org?.name ?? organizationId;
    const dept = await this.db.department.findUnique({
      where: { id: departmentId },
      select: { name: true },
    });
    return `${org?.name ?? organizationId} · ${dept?.name ?? departmentId}`;
  }

  private async portfolioSummary(
    principal: Principal,
    input: ManagementReportFilterInput,
  ): Promise<ManagementReportPreview> {
    const snapshot = await this.portfolio.getPortfolioSnapshot(principal, {
      organizationId: input.organizationId,
      departmentId: input.departmentId,
    });
    const attention = await this.portfolio.listDeliveryHealthAttention(
      principal,
      {
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        pageSize: CSV_MAX_ROWS,
      },
    );
    const scopeLabel = await this.scopeLabel(
      input.organizationId,
      input.departmentId,
    );

    const kpis = [
      {
        key: "active-initiatives",
        label: "Active initiatives",
        value: snapshot.initiatives.available
          ? snapshot.initiatives.value.total
          : null,
        unavailableReason: snapshot.initiatives.available
          ? undefined
          : snapshot.initiatives.reason,
      },
      {
        key: "active-projects",
        label: "Active projects",
        value: snapshot.projects.available
          ? snapshot.projects.value.active
          : null,
        unavailableReason: snapshot.projects.available
          ? undefined
          : snapshot.projects.reason,
      },
      {
        key: "delayed-projects",
        label: "Delayed projects",
        value: snapshot.delayedProjects.available
          ? snapshot.delayedProjects.value.delayedProjects
          : null,
        unavailableReason: snapshot.delayedProjects.available
          ? undefined
          : snapshot.delayedProjects.reason,
      },
      {
        key: "pending-governance",
        label: "Pending governance",
        value: snapshot.governance.available
          ? snapshot.governance.value.waitingForApproval +
            snapshot.governance.value.waitingForDecision
          : null,
        unavailableReason: snapshot.governance.available
          ? undefined
          : snapshot.governance.reason,
      },
      {
        key: "overloaded-teams",
        label: "Overloaded team iterations",
        value: snapshot.piCapacity.available
          ? snapshot.piCapacity.value.overloadedTeamIterations
          : null,
        unavailableReason: snapshot.piCapacity.available
          ? undefined
          : snapshot.piCapacity.reason,
      },
      {
        key: "attention",
        label: "Delivery attention",
        value: attention.attentionCount,
      },
    ];

    const mapped: ReportPreviewRow[] = attention.rows.map((r) => ({
      referenceKey: r.referenceKey,
      title: r.name,
      health: r.classification,
      department: r.departmentName,
      owner: r.owner.displayName ?? "",
      href: r.href,
    }));
    const { rows, truncated, total } = truncateRows(mapped);

    return {
      reportType: "portfolio_summary",
      title: "Portfolio Summary",
      description:
        "Executive KPIs from PortfolioSnapshot plus delivery-health attention rows.",
      asOf: snapshot.asOf,
      scopeLabel,
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      sourceOfTruth:
        "PortfolioQueryService.getPortfolioSnapshot + listDeliveryHealthAttention",
      columns: [
        { key: "referenceKey", label: "Reference" },
        { key: "title", label: "Title" },
        { key: "health", label: "Health" },
        { key: "department", label: "Department" },
        { key: "owner", label: "Owner" },
        { key: "href", label: "Link" },
      ],
      rows,
      totalRows: total,
      truncated,
      kpis,
      limitations: [
        "Attention list is paginated/bounded (max 500 export rows).",
        "No trend forecasts or composite health scores.",
      ],
      availability:
        rows.length === 0 && attention.attentionCount === 0
          ? { state: "empty", reason: "No attention rows in scope." }
          : { state: "ready" },
    };
  }

  private async projectStatus(
    principal: Principal,
    input: ManagementReportFilterInput,
  ): Promise<ManagementReportPreview> {
    const attention = await this.portfolio.listDeliveryHealthAttention(
      principal,
      {
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        pageSize: CSV_MAX_ROWS,
      },
    );
    const explorer = await this.portfolio.explorePortfolio(principal, {
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      entityKinds: ["PROJECT"],
      pageSize: CSV_MAX_ROWS,
    });
    const scopeLabel = await this.scopeLabel(
      input.organizationId,
      input.departmentId,
    );

    const mapped: ReportPreviewRow[] = explorer.rows.map((r) => ({
      referenceKey: r.referenceKey,
      title: r.title,
      status: r.statusLabel,
      health: r.delivery.health,
      delayed:
        r.delivery.delayed == null
          ? "UNAVAILABLE"
          : r.delivery.delayed
            ? "yes"
            : "no",
      activeBlocker:
        r.delivery.activeBlocker == null
          ? "UNAVAILABLE"
          : r.delivery.activeBlocker
            ? "yes"
            : "no",
      department: r.departmentName,
      owner: r.owner.displayName,
      href: r.href,
    }));
    const { rows, truncated, total } = truncateRows(mapped);

    return {
      reportType: "project_status",
      title: "Project Status",
      description:
        "Project explorer rows with server-side delivery health signals.",
      asOf: explorer.asOf,
      scopeLabel,
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      sourceOfTruth:
        "PortfolioQueryService.explorePortfolio (PROJECT) + delivery signals",
      columns: [
        { key: "referenceKey", label: "Reference" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "health", label: "Health" },
        { key: "delayed", label: "Delayed" },
        { key: "activeBlocker", label: "Active blocker" },
        { key: "department", label: "Department" },
        { key: "owner", label: "Owner" },
        { key: "href", label: "Link" },
      ],
      rows,
      totalRows: total,
      truncated,
      kpis: [
        {
          key: "projects",
          label: "Projects in export page",
          value: total,
        },
        {
          key: "attention",
          label: "Attention total",
          value: attention.total,
        },
      ],
      limitations: [
        "Explorer page is bounded (≤500). Not a warehouse dump.",
        "Per-project milestone detail requires Project workspace — not bulk-exported here.",
      ],
      availability:
        rows.length === 0
          ? { state: "empty", reason: "No projects visible in scope." }
          : { state: "ready" },
    };
  }

  private async piCapacityReport(
    principal: Principal,
    input: ManagementReportFilterInput,
  ): Promise<ManagementReportPreview> {
    const scopeLabel = await this.scopeLabel(
      input.organizationId,
      input.departmentId,
    );
    if (!input.piId) {
      return {
        reportType: "pi_capacity",
        title: "PI Capacity",
        description: "CURRENT revision capacity by team from Portfolio PI capacity.",
        asOf: new Date().toISOString(),
        scopeLabel,
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        sourceOfTruth: "PortfolioPiCapacityQueryService.getPiCapacityOverview",
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
        kpis: [],
        limitations: ["Select a Program Increment to load capacity."],
        availability: {
          state: "unavailable",
          reason: "Select a Program Increment to load live capacity metrics.",
        },
      };
    }

    const result = await this.piCapacity.getPiCapacityOverview(principal, {
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      piId: input.piId,
      includeResources: false,
      includeProjectCommitments: true,
      includeConflicts: true,
    });

    if (result.capacity.state !== "ready") {
      return {
        reportType: "pi_capacity",
        title: "PI Capacity",
        description: "CURRENT revision capacity by team from Portfolio PI capacity.",
        asOf: result.asOf,
        scopeLabel,
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        piId: input.piId,
        sourceOfTruth: "PortfolioPiCapacityQueryService.getPiCapacityOverview",
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
        kpis: [],
        limitations: [
          "CURRENT revision only — draft scenarios are never authoritative.",
        ],
        availability: {
          state: "unavailable",
          reason: result.capacity.reason,
        },
      };
    }

    const cap = result.capacity;
    const mapped: ReportPreviewRow[] = cap.teams.map((t) => ({
      team: t.teamName,
      departmentId: t.departmentId,
      iteration: t.iterationName,
      availableHours: t.availableHours,
      committedHours: t.committedHours,
      remainingHours: t.remainingHours,
      utilization:
        t.utilization == null ? "UNAVAILABLE" : Number(t.utilization.toFixed(4)),
      band: t.band,
    }));
    const { rows, truncated, total } = truncateRows(mapped);

    return {
      reportType: "pi_capacity",
      title: "PI Capacity",
      description: `Team capacity for ${cap.meta.referenceKey} on the CURRENT plan.`,
      asOf: result.asOf,
      scopeLabel,
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      piId: input.piId,
      sourceOfTruth:
        "PortfolioPiCapacityQueryService → CapacityService / capacity-policy (CURRENT)",
      columns: [
        { key: "team", label: "Team" },
        { key: "iteration", label: "Iteration" },
        { key: "availableHours", label: "Available h" },
        { key: "committedHours", label: "Committed h" },
        { key: "remainingHours", label: "Remaining h" },
        { key: "utilization", label: "Utilization" },
        { key: "band", label: "Band" },
      ],
      rows,
      totalRows: total,
      truncated,
      kpis: [
        {
          key: "available",
          label: "Available hours",
          value: cap.totals.availableHours,
        },
        {
          key: "committed",
          label: "Committed hours",
          value: cap.totals.committedHours,
        },
        {
          key: "remaining",
          label: "Remaining hours",
          value: cap.totals.remainingHours,
        },
        {
          key: "overloaded",
          label: "Overloaded teams",
          value: cap.overloadedTeams.length,
        },
        {
          key: "conflicts",
          label: "Conflicts",
          value: cap.conflicts.length,
        },
      ],
      limitations: [
        "CURRENT revision only.",
        "Shared Resources use membership % from capacity-policy — not double-counted as 100% per team.",
        "No invented FTE or workstream percentages.",
      ],
      availability:
        rows.length === 0
          ? { state: "empty", reason: "No team capacity rows in scope." }
          : { state: "ready" },
    };
  }

  private async resourceAllocation(
    principal: Principal,
    input: ManagementReportFilterInput,
  ): Promise<ManagementReportPreview> {
    const scopeLabel = await this.scopeLabel(
      input.organizationId,
      input.departmentId,
    );
    if (!input.piId) {
      return {
        reportType: "resource_allocation",
        title: "Resource Allocation",
        description:
          "Resource×team×iteration hours and project segments on CURRENT plan.",
        asOf: new Date().toISOString(),
        scopeLabel,
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        sourceOfTruth: "PortfolioPiCapacityQueryService (includeResources)",
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
        kpis: [],
        limitations: ["Select a Program Increment."],
        availability: {
          state: "unavailable",
          reason: "Select a Program Increment to load resource allocation.",
        },
      };
    }

    const result = await this.piCapacity.getPiCapacityOverview(principal, {
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      piId: input.piId,
      includeResources: true,
      includeProjectCommitments: true,
      resourcePageSize: CSV_MAX_ROWS,
    });

    if (result.capacity.state !== "ready") {
      return {
        reportType: "resource_allocation",
        title: "Resource Allocation",
        description:
          "Resource×team×iteration hours and project segments on CURRENT plan.",
        asOf: result.asOf,
        scopeLabel,
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        piId: input.piId,
        sourceOfTruth: "PortfolioPiCapacityQueryService (includeResources)",
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
        kpis: [],
        limitations: [],
        availability: {
          state: "unavailable",
          reason: result.capacity.reason,
        },
      };
    }

    const cap = result.capacity;
    const mapped: ReportPreviewRow[] = cap.resources.rows.map((r) => ({
      resource: r.resourceName,
      teamId: r.teamId,
      iterationId: r.iterationId,
      membershipPercent: r.membershipAllocationPercent,
      availableHours: r.availableHours,
      committedHours: r.committedHours,
      remainingHours: r.remainingHours,
      band: r.band,
      projects:
        r.projectSegments.length === 0
          ? ""
          : r.projectSegments
              .map((s) => `${s.referenceKey}:${s.committedHours}`)
              .join("; "),
    }));
    const { rows, truncated, total } = truncateRows(mapped);

    return {
      reportType: "resource_allocation",
      title: "Resource Allocation",
      description:
        "Per-resource CURRENT hours. Shared membership % from capacity-policy.",
      asOf: result.asOf,
      scopeLabel,
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      piId: input.piId,
      sourceOfTruth:
        "PortfolioPiCapacityQueryService resource rows + projectSegments",
      columns: [
        { key: "resource", label: "Resource" },
        { key: "teamId", label: "Team id" },
        { key: "iterationId", label: "Iteration id" },
        { key: "membershipPercent", label: "Membership %" },
        { key: "availableHours", label: "Available h" },
        { key: "committedHours", label: "Committed h" },
        { key: "remainingHours", label: "Remaining h" },
        { key: "band", label: "Band" },
        { key: "projects", label: "Project segments" },
      ],
      rows,
      totalRows: total,
      truncated: truncated || cap.resources.total > cap.resources.rows.length,
      kpis: [
        {
          key: "resource-rows",
          label: "Resource rows (page)",
          value: cap.resources.rows.length,
        },
        {
          key: "resource-total",
          label: "Resource rows (total)",
          value: cap.resources.total,
        },
        {
          key: "project-commitments",
          label: "Project commitments",
          value: cap.projectCommitments.length,
        },
      ],
      limitations: [
        "Resource page bounded by M2E-A pageSize.",
        "Shared Resources: membership % prevents double-counting full capacity per team.",
        "Not a duplicate Resource ledger — planning hours only.",
      ],
      availability:
        rows.length === 0
          ? { state: "empty", reason: "No resource rows in scope." }
          : { state: "ready" },
    };
  }

  private async risksBlockers(
    principal: Principal,
    input: ManagementReportFilterInput,
  ): Promise<ManagementReportPreview> {
    const attention = await this.portfolio.listDeliveryHealthAttention(
      principal,
      {
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        pageSize: CSV_MAX_ROWS,
      },
    );
    const scopeLabel = await this.scopeLabel(
      input.organizationId,
      input.departmentId,
    );
    const filtered = attention.rows.filter(
      (r) =>
        r.classification === "BLOCKED" || r.classification === "AT_RISK",
    );
    const mapped: ReportPreviewRow[] = filtered.map((r) => ({
      referenceKey: r.referenceKey,
      title: r.name,
      health: r.classification,
      department: r.departmentName,
      owner: r.owner.displayName ?? "",
      reasons: r.reasons.map((x) => x.code).join("; "),
      href: r.href,
    }));
    const { rows, truncated, total } = truncateRows(mapped);

    return {
      reportType: "risks_blockers",
      title: "Risks & Blockers",
      description:
        "Delivery-health attention rows classified BLOCKED or AT_RISK.",
      asOf: attention.asOf,
      scopeLabel,
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      sourceOfTruth: "PortfolioQueryService.listDeliveryHealthAttention",
      columns: [
        { key: "referenceKey", label: "Reference" },
        { key: "title", label: "Title" },
        { key: "health", label: "Health" },
        { key: "department", label: "Department" },
        { key: "owner", label: "Owner" },
        { key: "reasons", label: "Reason codes" },
        { key: "href", label: "Link" },
      ],
      rows,
      totalRows: total,
      truncated,
      kpis: [
        { key: "blocked-at-risk", label: "Blocked / at-risk rows", value: total },
        {
          key: "attention-total",
          label: "All attention rows",
          value: attention.total,
        },
      ],
      limitations: [
        "Uses delivery-health classifications only — not a separate risk register dump.",
      ],
      availability:
        rows.length === 0
          ? {
              state: "empty",
              reason: "No blocked or at-risk projects in scope.",
            }
          : { state: "ready" },
    };
  }

  private async governanceDecisions(
    principal: Principal,
    input: ManagementReportFilterInput,
  ): Promise<ManagementReportPreview> {
    const approvals = await this.governance.listMyApprovals(principal);
    const decisions = await this.governance.listMyDecisions(principal);
    const scopeLabel = await this.scopeLabel(
      input.organizationId,
      input.departmentId,
    );

    const approvalRows: ReportPreviewRow[] = approvals
      .filter(
        (a) => a.submission.initiative.organizationId === input.organizationId,
      )
      .map((a) => ({
        kind: "APPROVAL",
        referenceKey: a.submission.initiative.referenceKey,
        title: a.submission.initiative.title,
        status: a.status,
        authority: a.label || a.authorityKey,
        href: `/initiatives/${a.submission.initiativeId}/governance`,
      }));

    const decisionRows: ReportPreviewRow[] = decisions
      .filter((d) => d.initiative.organizationId === input.organizationId)
      .map((d) => ({
        kind: "DECISION",
        referenceKey: d.initiative.referenceKey,
        title: d.initiative.title,
        status: d.status,
        authority: String(d.gate.gateType),
        href: `/initiatives/${d.initiativeId}/governance`,
      }));

    const mapped = [...approvalRows, ...decisionRows];
    const { rows, truncated, total } = truncateRows(mapped);

    return {
      reportType: "governance_decisions",
      title: "Governance Decision Summary",
      description:
        "Approvals and decisions in your personal governance queue for this organization.",
      asOf: new Date().toISOString(),
      scopeLabel,
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      sourceOfTruth:
        "GovernanceService.listMyApprovals + listMyDecisions (principal-scoped)",
      columns: [
        { key: "kind", label: "Kind" },
        { key: "referenceKey", label: "Reference" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status / outcome" },
        { key: "authority", label: "Authority / type" },
        { key: "href", label: "Link" },
      ],
      rows,
      totalRows: total,
      truncated,
      kpis: [
        { key: "approvals", label: "My approvals (org filter)", value: approvalRows.length },
        { key: "decisions", label: "My decisions (org filter)", value: decisionRows.length },
      ],
      limitations: [
        "Principal queue only — not an organization-wide approval dump.",
        "Department filter does not further narrow governance queues (service is principal-scoped).",
      ],
      availability:
        rows.length === 0
          ? {
              state: "empty",
              reason: "No approvals or decisions waiting for you in this organization.",
            }
          : { state: "ready" },
    };
  }
}
