import {
  OnboardingAuditAction,
  OnboardingChecklistStatus,
  PrismaClient,
} from "@prisma/client";
import type { AuditService } from "@/modules/audit/application/audit-service";
import type { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { DEFAULT_ONBOARDING_ITEMS } from "./default-items";
import { getOnboardingRoleTemplate } from "./role-templates";
import {
  cancelOnboardingChecklistSchema,
  createOnboardingChecklistSchema,
  toggleOnboardingItemSchema,
  updateOnboardingItemsSchema,
} from "./schemas";

function itemIsDualComplete(item: {
  employeeCheckedAt: Date | null;
  onboarderCheckedAt: Date | null;
}): boolean {
  return Boolean(item.employeeCheckedAt && item.onboarderCheckedAt);
}

export class OnboardingService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async createChecklist(principal: Principal, input: unknown) {
    await this.authz.ensureSystemRoles();
    const parsed = createOnboardingChecklistSchema.parse(input);
    await this.assertCanManage(principal, parsed.organizationId);

    if (parsed.employeePrincipalId === parsed.onboarderPrincipalId) {
      throw new AppError(
        "VALIDATION",
        "Employee and onboarder must be different people",
      );
    }

    const [employee, onboarder] = await Promise.all([
      this.db.principal.findUnique({ where: { id: parsed.employeePrincipalId } }),
      this.db.principal.findUnique({ where: { id: parsed.onboarderPrincipalId } }),
    ]);
    if (!employee) throw new AppError("NOT_FOUND", "Employee principal not found");
    if (!onboarder) throw new AppError("NOT_FOUND", "Onboarder principal not found");

    const template = getOnboardingRoleTemplate(parsed.roleTemplate);
    const sourceItems =
      parsed.items ??
      template?.items ??
      DEFAULT_ONBOARDING_ITEMS;
    const title =
      parsed.title?.trim() ||
      `Onboarding — ${employee.displayName ?? "new employee"}${
        template ? ` — ${template.label}` : ""
      }`;

    const created = await this.db.$transaction(async (tx) => {
      const checklist = await tx.onboardingChecklist.create({
        data: {
          organizationId: parsed.organizationId,
          title,
          employeePrincipalId: parsed.employeePrincipalId,
          onboarderPrincipalId: parsed.onboarderPrincipalId,
          notes: parsed.notes?.trim() || null,
          createdByPrincipalId: principal.id,
          status: OnboardingChecklistStatus.IN_PROGRESS,
          items: {
            create: sourceItems.map((item, index) => ({
              sortOrder: index + 1,
              title: item.title,
              description: item.description?.trim() || null,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });

      await tx.onboardingChecklistAudit.create({
        data: {
          checklistId: checklist.id,
          actorPrincipalId: principal.id,
          action: OnboardingAuditAction.CREATED,
          payload: {
            employeePrincipalId: checklist.employeePrincipalId,
            onboarderPrincipalId: checklist.onboarderPrincipalId,
            itemCount: checklist.items.length,
            roleTemplate: template?.key ?? null,
          },
        },
      });

      return checklist;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "onboarding.created",
      subjectType: "OnboardingChecklist",
      subjectId: created.id,
      organizationId: created.organizationId,
      payload: { title: created.title },
      result: "success",
    });

    return created;
  }

  async toggleItem(principal: Principal, input: unknown) {
    const parsed = toggleOnboardingItemSchema.parse(input);
    const checklist = await this.requireChecklist(parsed.checklistId);

    if (checklist.status !== OnboardingChecklistStatus.IN_PROGRESS) {
      throw new AppError("CONFLICT", "This onboarding checklist is closed");
    }
    if (checklist.version !== parsed.expectedVersion) {
      throw new AppError("STALE_VERSION", "Checklist was updated by someone else");
    }

    const item = checklist.items.find((row) => row.id === parsed.itemId);
    if (!item) throw new AppError("NOT_FOUND", "Checklist item not found");

    const isEmployee = principal.id === checklist.employeePrincipalId;
    const isOnboarder = principal.id === checklist.onboarderPrincipalId;
    const canManage = await this.canManage(
      principal,
      checklist.organizationId,
    );

    if (parsed.role === "EMPLOYEE") {
      if (!isEmployee && !canManage) {
        throw new AppError(
          "FORBIDDEN",
          "Only the new employee (or an onboarding manager) can check the employee side",
        );
      }
    } else if (!isOnboarder && !canManage) {
      throw new AppError(
        "FORBIDDEN",
        "Only the onboarder (or an onboarding manager) can check the onboarder side",
      );
    }

    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      const data =
        parsed.role === "EMPLOYEE"
          ? {
              employeeCheckedAt: parsed.checked ? now : null,
              employeeCheckedByPrincipalId: parsed.checked ? principal.id : null,
              version: { increment: 1 },
            }
          : {
              onboarderCheckedAt: parsed.checked ? now : null,
              onboarderCheckedByPrincipalId: parsed.checked
                ? principal.id
                : null,
              version: { increment: 1 },
            };

      const nextItem = await tx.onboardingChecklistItem.update({
        where: { id: item.id },
        data,
      });

      const action =
        parsed.role === "EMPLOYEE"
          ? parsed.checked
            ? OnboardingAuditAction.EMPLOYEE_CHECKED
            : OnboardingAuditAction.EMPLOYEE_UNCHECKED
          : parsed.checked
            ? OnboardingAuditAction.ONBOARDER_CHECKED
            : OnboardingAuditAction.ONBOARDER_UNCHECKED;

      await tx.onboardingChecklistAudit.create({
        data: {
          checklistId: checklist.id,
          itemId: item.id,
          actorPrincipalId: principal.id,
          action,
          payload: {
            title: item.title,
            checked: parsed.checked,
            dualComplete: itemIsDualComplete(nextItem),
          },
        },
      });

      await tx.onboardingChecklist.update({
        where: { id: checklist.id, version: checklist.version },
        data: { version: { increment: 1 } },
      });

      // Auto official pass when every item has both checks.
      const allItems = await tx.onboardingChecklistItem.findMany({
        where: { checklistId: checklist.id },
        orderBy: { sortOrder: "asc" },
      });
      const allDual = allItems.every(itemIsDualComplete);
      if (allDual) {
        await tx.onboardingChecklist.update({
          where: { id: checklist.id },
          data: {
            status: OnboardingChecklistStatus.PASSED,
            passedAt: now,
            version: { increment: 1 },
          },
        });
        await tx.onboardingChecklistAudit.create({
          data: {
            checklistId: checklist.id,
            actorPrincipalId: principal.id,
            action: OnboardingAuditAction.PASSED,
            comment: "All items checked by both employee and onboarder",
            payload: { itemCount: allItems.length },
          },
        });
      }

      return tx.onboardingChecklist.findUniqueOrThrow({
        where: { id: checklist.id },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: `onboarding.item.${parsed.role.toLowerCase()}.${parsed.checked ? "checked" : "unchecked"}`,
      subjectType: "OnboardingChecklist",
      subjectId: checklist.id,
      organizationId: checklist.organizationId,
      payload: { itemId: item.id, checked: parsed.checked },
      result: "success",
    });

    return updated;
  }

  async cancelChecklist(principal: Principal, input: unknown) {
    const parsed = cancelOnboardingChecklistSchema.parse(input);
    const checklist = await this.requireChecklist(parsed.checklistId);
    await this.assertCanManage(principal, checklist.organizationId);
    if (checklist.status !== OnboardingChecklistStatus.IN_PROGRESS) {
      throw new AppError("CONFLICT", "Only in-progress checklists can be cancelled");
    }
    if (checklist.version !== parsed.expectedVersion) {
      throw new AppError("STALE_VERSION", "Checklist was updated by someone else");
    }

    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.onboardingChecklist.update({
        where: { id: checklist.id, version: checklist.version },
        data: {
          status: OnboardingChecklistStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      await tx.onboardingChecklistAudit.create({
        data: {
          checklistId: row.id,
          actorPrincipalId: principal.id,
          action: OnboardingAuditAction.CANCELLED,
          comment: parsed.comment?.trim() || null,
          payload: {},
        },
      });
      return row;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "onboarding.cancelled",
      subjectType: "OnboardingChecklist",
      subjectId: updated.id,
      organizationId: updated.organizationId,
      payload: {},
      result: "success",
    });

    return updated;
  }

  async updateItems(principal: Principal, input: unknown) {
    const parsed = updateOnboardingItemsSchema.parse(input);
    const checklist = await this.requireChecklist(parsed.checklistId);
    await this.assertCanManage(principal, checklist.organizationId);
    if (checklist.status !== OnboardingChecklistStatus.IN_PROGRESS) {
      throw new AppError("CONFLICT", "Only in-progress checklists can be edited");
    }
    if (checklist.version !== parsed.expectedVersion) {
      throw new AppError("STALE_VERSION", "Checklist was updated by someone else");
    }

    const existingById = new Map(checklist.items.map((item) => [item.id, item]));
    for (const item of parsed.items) {
      if (item.id && !existingById.has(item.id)) {
        throw new AppError("VALIDATION", "That checklist step was not found");
      }
    }

    const keepIds = parsed.items
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));

    const updated = await this.db.$transaction(async (tx) => {
      if (keepIds.length === 0) {
        await tx.onboardingChecklistItem.deleteMany({
          where: { checklistId: checklist.id },
        });
      } else {
        await tx.onboardingChecklistItem.deleteMany({
          where: { checklistId: checklist.id, id: { notIn: keepIds } },
        });
      }

      for (const [index, item] of parsed.items.entries()) {
        const description = item.description?.trim() || null;
        if (item.id) {
          await tx.onboardingChecklistItem.update({
            where: { id: item.id },
            data: {
              title: item.title,
              description,
              sortOrder: index + 1,
            },
          });
        } else {
          await tx.onboardingChecklistItem.create({
            data: {
              checklistId: checklist.id,
              title: item.title,
              description,
              sortOrder: index + 1,
            },
          });
        }
      }

      await tx.onboardingChecklist.update({
        where: { id: checklist.id, version: checklist.version },
        data: { version: { increment: 1 } },
      });

      await tx.onboardingChecklistAudit.create({
        data: {
          checklistId: checklist.id,
          actorPrincipalId: principal.id,
          action: OnboardingAuditAction.ITEMS_EDITED,
          payload: {
            itemCount: parsed.items.length,
            titles: parsed.items.map((item) => item.title),
          },
        },
      });

      const allItems = await tx.onboardingChecklistItem.findMany({
        where: { checklistId: checklist.id },
      });
      if (allItems.length > 0 && allItems.every(itemIsDualComplete)) {
        await tx.onboardingChecklist.update({
          where: { id: checklist.id },
          data: {
            status: OnboardingChecklistStatus.PASSED,
            passedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.onboardingChecklistAudit.create({
          data: {
            checklistId: checklist.id,
            actorPrincipalId: principal.id,
            action: OnboardingAuditAction.PASSED,
            comment: "All remaining items checked by both employee and onboarder",
            payload: { itemCount: allItems.length },
          },
        });
      }

      return tx.onboardingChecklist.findUniqueOrThrow({
        where: { id: checklist.id },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "onboarding.items_edited",
      subjectType: "OnboardingChecklist",
      subjectId: checklist.id,
      organizationId: checklist.organizationId,
      payload: { itemCount: parsed.items.length },
      result: "success",
    });

    return updated;
  }

  async listForPrincipal(principal: Principal) {
    await this.authz.ensureSystemRoles();
    const rows = await this.db.onboardingChecklist.findMany({
      where: {
        OR: [
          { employeePrincipalId: principal.id },
          { onboarderPrincipalId: principal.id },
        ],
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map((row) => this.withProgress(row));
  }

  async listManaged(principal: Principal, organizationId: string) {
    const canView = await this.authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.ONBOARDING_VIEW,
      organizationId,
    );
    if (!canView) {
      throw new AppError("FORBIDDEN", "Not allowed to view onboarding checklists");
    }
    const rows = await this.db.onboardingChecklist.findMany({
      where: { organizationId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map((row) => this.withProgress(row));
  }

  /** People selectable as employee/onboarder — requires ONBOARDING_MANAGE, not ROLE_MANAGE. */
  async listAssignablePrincipals(principal: Principal, organizationId: string) {
    await this.assertCanManage(principal, organizationId);
    const bindings = await this.db.roleBinding.findMany({
      where: {
        organizationId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      select: { principalId: true },
      distinct: ["principalId"],
      take: 500,
    });
    const ids = bindings.map((b) => b.principalId);
    if (ids.length === 0) return [];
    return this.db.principal.findMany({
      where: { id: { in: ids } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    });
  }

  async getChecklist(principal: Principal, checklistId: string) {
    const checklist = await this.requireChecklist(checklistId);
    const isParticipant =
      principal.id === checklist.employeePrincipalId ||
      principal.id === checklist.onboarderPrincipalId;
    const canView = await this.authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.ONBOARDING_VIEW,
      checklist.organizationId,
    );
    const canManage = await this.canManage(
      principal,
      checklist.organizationId,
    );
    if (!isParticipant && !canView) {
      throw new AppError("FORBIDDEN", "Not allowed to view this onboarding checklist");
    }

    const audits = await this.db.onboardingChecklistAudit.findMany({
      where: { checklistId },
      orderBy: { createdAt: "asc" },
    });

    const principalIds = [
      checklist.employeePrincipalId,
      checklist.onboarderPrincipalId,
      ...audits.map((a) => a.actorPrincipalId),
    ].filter((id): id is string => Boolean(id));
    const principals = await this.db.principal.findMany({
      where: { id: { in: [...new Set(principalIds)] } },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(principals.map((p) => [p.id, p.displayName]));

    const progress = this.withProgress(checklist);

    return {
      checklist: {
        ...progress,
        employeeDisplayName:
          nameById.get(checklist.employeePrincipalId) ?? "Employee",
        onboarderDisplayName:
          nameById.get(checklist.onboarderPrincipalId) ?? "Onboarder",
      },
      audits: audits.map((a) => ({
        ...a,
        actorDisplayName: a.actorPrincipalId
          ? (nameById.get(a.actorPrincipalId) ?? "Unknown")
          : "System",
      })),
      capabilities: {
        isEmployee: principal.id === checklist.employeePrincipalId,
        isOnboarder: principal.id === checklist.onboarderPrincipalId,
        canManage,
        canToggleEmployee:
          checklist.status === OnboardingChecklistStatus.IN_PROGRESS &&
          (principal.id === checklist.employeePrincipalId || canManage),
        canToggleOnboarder:
          checklist.status === OnboardingChecklistStatus.IN_PROGRESS &&
          (principal.id === checklist.onboarderPrincipalId || canManage),
      },
    };
  }

  private withProgress<T extends { items: Array<Record<string, unknown> & {
    employeeCheckedAt: Date | null;
    onboarderCheckedAt: Date | null;
  }> }>(checklist: T) {
    const items = checklist.items;
    const total = items.length;
    const employeeDone = items.filter((i) => i.employeeCheckedAt).length;
    const onboarderDone = items.filter((i) => i.onboarderCheckedAt).length;
    const dualDone = items.filter(itemIsDualComplete).length;
    return {
      ...checklist,
      progress: {
        total,
        employeeDone,
        onboarderDone,
        dualDone,
        officiallyPassed: total > 0 && dualDone === total,
      },
      items: items.map((item) => ({
        ...item,
        dualComplete: itemIsDualComplete(item),
      })),
    } as Omit<T, "items"> & {
      progress: {
        total: number;
        employeeDone: number;
        onboarderDone: number;
        dualDone: number;
        officiallyPassed: boolean;
      };
      items: Array<T["items"][number] & { dualComplete: boolean }>;
    };
  }

  private async requireChecklist(id: string) {
    const row = await this.db.onboardingChecklist.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) throw new AppError("NOT_FOUND", "Onboarding checklist not found");
    return row;
  }

  private async canManage(principal: Principal, organizationId: string) {
    return this.authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.ONBOARDING_MANAGE,
      organizationId,
    );
  }

  private async assertCanManage(principal: Principal, organizationId: string) {
    if (await this.canManage(principal, organizationId)) return;
    throw new AppError(
      "FORBIDDEN",
      "You need onboarding manage permission in this organization",
    );
  }
}
