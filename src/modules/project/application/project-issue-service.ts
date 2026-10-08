/**
 * Project Issue application service (Phase 1C).
 * Issues belong to Project. No Blocker entity — use isBlocker + non-terminal status.
 */

import { Prisma, PrismaClient, type IssueStatus } from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { resolveOptionalBusinessOwner } from "@/modules/organization/application/ownership-policy";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  isActiveBlockerIssue,
  isAllowedIssueStatusTransition,
  isTerminalIssueStatus,
  summarizeProjectIssues,
} from "./issue-policy";
import {
  changeIssueStatusInputSchema,
  createIssueInputSchema,
  listProjectIssuesInputSchema,
  resolveIssueInputSchema,
  updateIssueInputSchema,
} from "./schemas";

function fromZod(error: ZodError): AppError {
  return new AppError("VALIDATION", "Validation failed", {
    details: error.flatten(),
  });
}

function parse<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) throw fromZod(error);
    throw error;
  }
}

type ProjectRow = {
  id: string;
  organizationId: string;
  departmentId: string;
  initiativeId: string;
  status: string;
};

export class ProjectIssueService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async createIssue(principal: Principal, raw: unknown) {
    const input = parse(createIssueInputSchema, raw);
    const project = await this.requireProject(input.projectId);
    await this.assertCanEdit(principal, project);

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: project.organizationId,
      roleLabel: "issue owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    if (input.relatedRiskId) {
      await this.assertRelatedRisk(input.relatedRiskId, project.initiativeId);
    }

    const referenceKey = await this.allocateIssueReference(project.id);
    const created = await this.db.projectIssue.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        referenceKey,
        title: input.title,
        description: input.description ?? null,
        severity: input.severity,
        status: "OPEN",
        isBlocker: input.isBlocker,
        ownerName,
        ownerResourceId: owner?.id ?? null,
        relatedRiskId: input.relatedRiskId ?? null,
        reportedAt: new Date(),
      },
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "project.issue.created",
      subjectType: "ProjectIssue",
      subjectId: created.id,
      organizationId: project.organizationId,
      payload: {
        projectId: project.id,
        referenceKey: created.referenceKey,
        severity: created.severity,
        isBlocker: created.isBlocker,
        ownerResourceId: created.ownerResourceId,
      },
      result: "success",
    });

    return created;
  }

  async updateIssue(principal: Principal, raw: unknown) {
    const input = parse(updateIssueInputSchema, raw);
    const issue = await this.requireIssue(input.issueId);
    await this.assertCanEdit(principal, issue.project);
    this.assertVersion(issue.version, input.expectedVersion, "issue");

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: issue.organizationId,
      roleLabel: "issue owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    if (input.relatedRiskId) {
      await this.assertRelatedRisk(
        input.relatedRiskId,
        issue.project.initiativeId,
      );
    }

    try {
      const updated = await this.db.projectIssue.update({
        where: { id: issue.id, version: input.expectedVersion },
        data: {
          title: input.title,
          description: input.description ?? null,
          severity: input.severity,
          isBlocker: input.isBlocker,
          ownerName,
          ownerResourceId: owner?.id ?? null,
          relatedRiskId: input.relatedRiskId ?? null,
          version: { increment: 1 },
        },
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "project.issue.updated",
        subjectType: "ProjectIssue",
        subjectId: updated.id,
        organizationId: issue.organizationId,
        payload: {
          projectId: issue.projectId,
          old: {
            title: issue.title,
            severity: issue.severity,
            isBlocker: issue.isBlocker,
            ownerResourceId: issue.ownerResourceId,
          },
          new: {
            title: updated.title,
            severity: updated.severity,
            isBlocker: updated.isBlocker,
            ownerResourceId: updated.ownerResourceId,
          },
          version: updated.version,
        },
        result: "success",
      });

      return updated;
    } catch (error) {
      this.rethrowStale(error, "issue");
    }
  }

  async changeIssueStatus(principal: Principal, raw: unknown) {
    const input = parse(changeIssueStatusInputSchema, raw);
    const issue = await this.requireIssue(input.issueId);
    await this.assertCanEdit(principal, issue.project);
    this.assertVersion(issue.version, input.expectedVersion, "issue");

    if (!isAllowedIssueStatusTransition(issue.status, input.toStatus)) {
      throw new AppError(
        "VALIDATION",
        `Cannot transition issue from ${issue.status} to ${input.toStatus}.`,
        { details: { from: issue.status, to: input.toStatus } },
      );
    }

    const enteringTerminal =
      isTerminalIssueStatus(input.toStatus) &&
      !isTerminalIssueStatus(issue.status);
    const leavingTerminal =
      !isTerminalIssueStatus(input.toStatus) &&
      isTerminalIssueStatus(issue.status);

    if (enteringTerminal && input.toStatus === "RESOLVED") {
      const text = input.resolution?.trim();
      if (!text) {
        throw new AppError(
          "VALIDATION",
          "Resolution text is required when resolving an issue.",
        );
      }
    }

    try {
      const updated = await this.db.projectIssue.update({
        where: { id: issue.id, version: input.expectedVersion },
        data: {
          status: input.toStatus,
          ...(enteringTerminal
            ? {
                resolvedAt: issue.resolvedAt ?? new Date(),
                resolution:
                  input.resolution?.trim() || issue.resolution || null,
              }
            : {}),
          ...(leavingTerminal
            ? {
                resolvedAt: null,
                resolution: null,
              }
            : {}),
          version: { increment: 1 },
        },
      });

      const actionType =
        input.toStatus === "RESOLVED" ||
        (input.toStatus === "CLOSED" && enteringTerminal)
          ? "project.issue.resolved"
          : "project.issue.status_changed";

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType,
        subjectType: "ProjectIssue",
        subjectId: updated.id,
        organizationId: issue.organizationId,
        payload: {
          projectId: issue.projectId,
          from: issue.status,
          to: updated.status,
          resolution: updated.resolution,
          version: updated.version,
        },
        result: "success",
      });

      return updated;
    } catch (error) {
      this.rethrowStale(error, "issue");
    }
  }

  /**
   * Convenience: OPEN/IN_PROGRESS → RESOLVED (or CLOSED when close=true).
   * Requires non-empty resolution text.
   */
  async resolveIssue(principal: Principal, raw: unknown) {
    const input = parse(resolveIssueInputSchema, raw);
    const toStatus: IssueStatus = input.close ? "CLOSED" : "RESOLVED";
    return this.changeIssueStatus(principal, {
      issueId: input.issueId,
      toStatus,
      resolution: input.resolution,
      expectedVersion: input.expectedVersion,
    });
  }

  async getIssue(principal: Principal, issueId: string) {
    const issue = await this.requireIssue(issueId);
    await this.assertCanView(principal, issue.project);
    return issue;
  }

  async listProjectIssues(principal: Principal, raw: unknown) {
    const input = parse(listProjectIssuesInputSchema, raw);
    const project = await this.requireProject(input.projectId);
    await this.assertCanView(principal, project);

    const where: Prisma.ProjectIssueWhereInput = {
      projectId: project.id,
    };
    if (input.status) where.status = input.status;
    if (input.severity) where.severity = input.severity;
    if (input.isBlocker != null) where.isBlocker = input.isBlocker;
    if (input.activeBlockersOnly) {
      where.isBlocker = true;
      where.status = { in: ["OPEN", "IN_PROGRESS"] };
    }

    const issues = await this.db.projectIssue.findMany({
      where,
      include: {
        ownerResource: { select: { id: true, name: true } },
        relatedRisk: {
          select: { id: true, referenceKey: true, title: true },
        },
      },
      orderBy: [
        { isBlocker: "desc" },
        { severity: "desc" },
        { reportedAt: "desc" },
      ],
    });

    return {
      issues,
      summary: summarizeProjectIssues(issues),
    };
  }

  async getProjectIssueSummary(principal: Principal, projectId: string) {
    const project = await this.requireProject(projectId);
    await this.assertCanView(principal, project);
    const issues = await this.db.projectIssue.findMany({
      where: { projectId },
      select: { status: true, severity: true, isBlocker: true },
    });
    return summarizeProjectIssues(issues);
  }

  static isActiveBlocker = isActiveBlockerIssue;

  private async requireProject(projectId: string): Promise<ProjectRow> {
    const project = await this.db.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Project not found.");
    }
    return project;
  }

  private async requireIssue(issueId: string) {
    const issue = await this.db.projectIssue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });
    if (!issue || issue.project.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Issue not found.");
    }
    if (issue.organizationId !== issue.project.organizationId) {
      throw new AppError(
        "VALIDATION",
        "Issue organization is inconsistent with its Project.",
      );
    }
    return issue;
  }

  private async assertRelatedRisk(riskId: string, initiativeId: string) {
    const risk = await this.db.risk.findUnique({ where: { id: riskId } });
    if (!risk) {
      throw new AppError("NOT_FOUND", "Related risk not found.");
    }
    if (risk.initiativeId !== initiativeId) {
      throw new AppError(
        "VALIDATION",
        "Related risk must belong to the same Initiative as the Project.",
      );
    }
  }

  private async assertCanView(principal: Principal, project: ProjectRow) {
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PROJECT_VIEW,
      {
        type: "DEPARTMENT",
        organizationId: project.organizationId,
        departmentId: project.departmentId,
      },
      { kind: "PROJECT_OWNER", projectId: project.id },
    );
  }

  private async assertCanEdit(principal: Principal, project: ProjectRow) {
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PROJECT_EDIT,
      {
        type: "DEPARTMENT",
        organizationId: project.organizationId,
        departmentId: project.departmentId,
      },
      { kind: "PROJECT_OWNER", projectId: project.id },
    );
  }

  private async allocateIssueReference(projectId: string): Promise<string> {
    const existing = await this.db.projectIssue.findMany({
      where: { projectId },
      select: { referenceKey: true },
    });
    let max = 0;
    for (const row of existing) {
      const match = /^ISS-(\d+)$/.exec(row.referenceKey);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `ISS-${String(max + 1).padStart(3, "0")}`;
  }

  private assertVersion(
    current: number,
    expected: number,
    entity: string,
  ): void {
    if (current !== expected) {
      throw new AppError(
        "STALE_VERSION",
        `This ${entity} was changed by someone else. Refresh and try again.`,
        { details: { currentVersion: current } },
      );
    }
  }

  private rethrowStale(error: unknown, entity: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new AppError(
        "STALE_VERSION",
        `This ${entity} was changed by someone else. Refresh and try again.`,
      );
    }
    throw error;
  }
}
