/**
 * M5C-C — Project / Delivery workspace presentation helpers.
 * Pure display mapping over existing project/issue/milestone/closure data.
 * No new delivery formulas — reuses evaluateDeliveryHealth + issue-policy counts.
 */
import type { StatusBadgeMapping } from "@/components/ui/status-adapters";
import {
  mapDeliveryHealthBadge,
  mapProjectStatusBadge,
} from "@/components/ui/status-adapters";
import {
  evaluateDeliveryHealth,
  type HealthProjectInput,
} from "@/modules/portfolio/application/delivery-health";
import type { DeliveryHealthEvaluation } from "@/modules/portfolio/domain/types";
import {
  isActiveBlockerIssue,
  isTerminalIssueStatus,
} from "@/modules/project/application/issue-policy";
import { isProjectClosedStatus } from "@/modules/project/application/closure-policy";

export function humanizeProjectToken(value: string): string {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export type ProjectOwnerDisplay = {
  name: string | null;
  basis: "resource_link" | "name_snapshot" | "missing";
};

export function resolveProjectOwnerDisplay(input: {
  ownerResource?: { id: string; name: string } | null;
  ownerResourceId?: string | null;
  ownerName?: string | null;
}): ProjectOwnerDisplay {
  if (input.ownerResource?.name?.trim()) {
    return { name: input.ownerResource.name.trim(), basis: "resource_link" };
  }
  if (input.ownerName?.trim()) {
    return { name: input.ownerName.trim(), basis: "name_snapshot" };
  }
  return { name: null, basis: "missing" };
}

export function ownershipBasisLabel(
  basis: ProjectOwnerDisplay["basis"],
): string {
  switch (basis) {
    case "resource_link":
      return "Linked Resource";
    case "name_snapshot":
      return "Name snapshot";
    default:
      return "Not set";
  }
}

export type DeliveryCounts = {
  milestonesTotal: number;
  milestonesComplete: number;
  milestonesMissed: number;
  milestonesOpen: number;
  workTotal: number;
  workDone: number;
  workOpen: number;
  issuesOpen: number;
  activeBlockers: number;
  criticalOpen: number;
};

export function summarizeDeliveryProgress(input: {
  milestones: { status: string; plannedDate?: Date | string | null }[];
  workItems: { status: string }[];
  issueSummary?: {
    openCount: number;
    activeBlockerCount: number;
    criticalOpenCount: number;
  } | null;
  asOf?: Date;
}): DeliveryCounts {
  const asOf = input.asOf ?? new Date();
  const milestonesTotal = input.milestones.length;
  const milestonesComplete = input.milestones.filter(
    (m) => m.status === "COMPLETED",
  ).length;
  const milestonesMissed = input.milestones.filter((m) => {
    if (m.status === "MISSED") return true;
    if (m.status !== "PLANNED" && m.status !== "IN_PROGRESS") return false;
    if (!m.plannedDate) return false;
    const d =
      m.plannedDate instanceof Date
        ? m.plannedDate
        : new Date(m.plannedDate);
    return !Number.isNaN(d.getTime()) && d < asOf;
  }).length;
  const milestonesOpen = input.milestones.filter(
    (m) =>
      m.status === "PLANNED" ||
      m.status === "IN_PROGRESS" ||
      m.status === "MISSED",
  ).length;
  const workTotal = input.workItems.length;
  const workDone = input.workItems.filter(
    (w) => w.status === "DONE" || w.status === "CANCELLED",
  ).length;
  const workOpen = input.workItems.filter(
    (w) =>
      w.status === "BACKLOG" ||
      w.status === "READY" ||
      w.status === "IN_PROGRESS",
  ).length;

  return {
    milestonesTotal,
    milestonesComplete,
    milestonesMissed,
    milestonesOpen,
    workTotal,
    workDone,
    workOpen,
    issuesOpen: input.issueSummary?.openCount ?? 0,
    activeBlockers: input.issueSummary?.activeBlockerCount ?? 0,
    criticalOpen: input.issueSummary?.criticalOpenCount ?? 0,
  };
}

export type AttentionItem = {
  id: string;
  kind: "blocker" | "critical_issue" | "delayed_milestone" | "pending_work";
  label: string;
  detail: string;
  hrefAnchor: string;
};

export function buildManagementAttention(input: {
  issues: Array<{
    id: string;
    referenceKey: string;
    title: string;
    status: string;
    severity: string;
    isBlocker: boolean;
  }>;
  milestones: Array<{
    id: string;
    referenceKey: string;
    title: string;
    status: string;
    plannedDate: Date | string | null;
    criticality: boolean;
  }>;
  workItems: Array<{
    id: string;
    referenceKey: string;
    title: string;
    status: string;
  }>;
  asOf?: Date;
}): AttentionItem[] {
  const asOf = input.asOf ?? new Date();
  const items: AttentionItem[] = [];

  for (const issue of input.issues) {
    if (
      isActiveBlockerIssue({
        isBlocker: issue.isBlocker,
        status: issue.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
      })
    ) {
      items.push({
        id: `blocker-${issue.id}`,
        kind: "blocker",
        label: `${issue.referenceKey} · ${issue.title}`,
        detail: "Active delivery blocker",
        hrefAnchor: "issues",
      });
    } else if (
      !isTerminalIssueStatus(
        issue.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
      ) &&
      issue.severity === "CRITICAL"
    ) {
      items.push({
        id: `critical-${issue.id}`,
        kind: "critical_issue",
        label: `${issue.referenceKey} · ${issue.title}`,
        detail: "Open CRITICAL issue",
        hrefAnchor: "issues",
      });
    }
  }

  for (const ms of input.milestones) {
    const planned =
      ms.plannedDate instanceof Date
        ? ms.plannedDate
        : ms.plannedDate
          ? new Date(ms.plannedDate)
          : null;
    const delayed =
      ms.status === "MISSED" ||
      ((ms.status === "PLANNED" || ms.status === "IN_PROGRESS") &&
        planned != null &&
        !Number.isNaN(planned.getTime()) &&
        planned < asOf);
    if (delayed) {
      items.push({
        id: `milestone-${ms.id}`,
        kind: "delayed_milestone",
        label: `${ms.referenceKey} · ${ms.title}`,
        detail: ms.criticality
          ? "Delayed / missed critical milestone"
          : "Delayed / missed milestone",
        hrefAnchor: "milestones",
      });
    }
  }

  const pendingWork = input.workItems.filter(
    (w) =>
      w.status === "BACKLOG" ||
      w.status === "READY" ||
      w.status === "IN_PROGRESS",
  );
  if (pendingWork.length > 0 && items.length < 8) {
    items.push({
      id: "pending-work",
      kind: "pending_work",
      label: `${pendingWork.length} open work item(s)`,
      detail: "Backlog / ready / in progress work remains",
      hrefAnchor: "work",
    });
  }

  return items.slice(0, 12);
}

export type ProjectNextActionView = {
  kind:
    | "resolve_blockers"
    | "update_milestones"
    | "plan_work"
    | "close_project"
    | "view_closure"
    | "create_from_pilot"
    | "idle";
  label: string;
  detail: string;
  blocked: boolean;
  href?: string | null;
  ctaLabel?: string | null;
  unavailableReason?: string | null;
};

export function describeProjectNextAction(input: {
  hasProject: boolean;
  projectClosed: boolean;
  initiativeId: string;
  activeBlockers: number;
  delayedMilestones: number;
  openWork: number;
  closureCanClose?: boolean | null;
  canEditProject?: boolean;
  canCloseProject?: boolean;
}): ProjectNextActionView {
  if (!input.hasProject) {
    return {
      kind: "create_from_pilot",
      label: "Convert from Pilot when authorized",
      detail:
        "A Project is created explicitly after Scale / Conditional scale. Open the Pilot workspace to convert.",
      blocked: false,
      href: `/initiatives/${input.initiativeId}/pilot`,
      ctaLabel: "Open Pilot workspace",
    };
  }
  if (input.projectClosed) {
    return {
      kind: "view_closure",
      label: "Project is closed — read-only",
      detail:
        "Review closure outcome and historical delivery data. Delivery mutations are disabled.",
      blocked: false,
      href: "#closure",
      ctaLabel: "View closure record",
    };
  }
  if (input.activeBlockers > 0) {
    return {
      kind: "resolve_blockers",
      label: "Resolve active blockers",
      detail: `${input.activeBlockers} active blocker issue(s) prevent reliable delivery progress and block delivered closure.`,
      blocked: true,
      href: "#issues",
      ctaLabel: "Open issues & blockers",
      unavailableReason:
        input.canEditProject === false
          ? "You can inspect blockers but lack permission to edit issues."
          : null,
    };
  }
  if (input.delayedMilestones > 0) {
    return {
      kind: "update_milestones",
      label: "Address delayed milestones",
      detail: `${input.delayedMilestones} milestone(s) are missed or past planned date.`,
      blocked: false,
      href: "#milestones",
      ctaLabel: "Open milestones",
      unavailableReason:
        input.canEditProject === false
          ? "Milestone updates require project edit permission."
          : null,
    };
  }
  if (input.closureCanClose && input.canCloseProject) {
    return {
      kind: "close_project",
      label: "Close project when ready",
      detail:
        "Closure readiness allows an authorized close. Closure is explicit and does not rewrite open work.",
      blocked: false,
      href: "#closure",
      ctaLabel: "Review closure",
    };
  }
  if (input.closureCanClose && input.canCloseProject === false) {
    return {
      kind: "close_project",
      label: "Closure readiness met",
      detail: "Hard blockers are clear, but you do not have close permission.",
      blocked: true,
      href: "#closure",
      ctaLabel: "View closure readiness",
      unavailableReason: "Closing requires project close permission.",
    };
  }
  if (input.openWork > 0) {
    return {
      kind: "plan_work",
      label: "Advance open work",
      detail: `${input.openWork} work item(s) remain open. Plan sequencing in PI Planning when needed.`,
      blocked: false,
      href: "#work",
      ctaLabel: "Open work items",
    };
  }
  return {
    kind: "idle",
    label: "No urgent delivery action",
    detail:
      "No active blockers or delayed milestones. Review closure readiness when delivery is complete.",
    blocked: false,
    href: "#closure",
    ctaLabel: "Check closure readiness",
  };
}

export function evaluateProjectDeliveryHealth(input: {
  id: string;
  initiativeId: string;
  status: string;
  plannedEnd: Date | null;
  plannedStart: Date | null;
  closureOutcome: string | null;
  issues: Array<{
    id: string;
    status: string;
    severity: string;
    isBlocker: boolean;
  }>;
  milestones: Array<{
    id: string;
    status: string;
    criticality: boolean;
    plannedDate: Date | null;
  }>;
  asOf?: Date;
}): DeliveryHealthEvaluation {
  const healthInput: HealthProjectInput = {
    id: input.id,
    initiativeId: input.initiativeId,
    status: input.status,
    plannedEnd: input.plannedEnd,
    plannedStart: input.plannedStart,
    closureOutcome: input.closureOutcome as HealthProjectInput["closureOutcome"],
    issues: input.issues,
    milestones: input.milestones,
    criticalOpenDependencies: [],
  };
  return evaluateDeliveryHealth(healthInput, input.asOf ?? new Date());
}

export function mapHealthBadge(
  classification: string,
): StatusBadgeMapping {
  return mapDeliveryHealthBadge(classification);
}

export function mapStatusBadge(status: string): StatusBadgeMapping {
  return mapProjectStatusBadge(status);
}

export function isClosedProject(status: string, hasClosure: boolean): boolean {
  if (hasClosure) return true;
  return isProjectClosedStatus(status as "COMPLETED" | "CANCELLED" | "ACTIVE");
}

export function completionIndicatorLabel(counts: DeliveryCounts): string {
  if (counts.milestonesTotal === 0 && counts.workTotal === 0) {
    return "No milestones or work items yet";
  }
  const ms =
    counts.milestonesTotal === 0
      ? "Milestones n/a"
      : `${counts.milestonesComplete}/${counts.milestonesTotal} milestones complete`;
  const work =
    counts.workTotal === 0
      ? "Work n/a"
      : `${counts.workDone}/${counts.workTotal} work done`;
  return `${ms} · ${work}`;
}
