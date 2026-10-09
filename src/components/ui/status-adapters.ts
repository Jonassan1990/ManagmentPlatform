/**
 * Presentation-only status mapping for M4B-C.
 * Does not change domain enums or lifecycle transitions.
 */
import {
  STATUS_BADGE_LABELS,
  type StatusBadgeVariant,
} from "@/components/ui/status-badge";

export type StatusBadgeMapping = {
  status: StatusBadgeVariant;
  label: string;
};

/** Delivery Health → StatusBadge */
export function mapDeliveryHealthBadge(
  classification: string,
): StatusBadgeMapping {
  switch (classification) {
    case "BLOCKED":
      return { status: "blocked", label: "Blocked" };
    case "AT_RISK":
      return { status: "at-risk", label: "At risk" };
    case "ON_TRACK":
      return { status: "in-progress", label: "On track" };
    case "COMPLETED":
      return { status: "completed", label: "Completed" };
    case "CANCELLED":
      return { status: "cancelled", label: "Cancelled" };
    case "UNKNOWN":
      return { status: "unavailable", label: "Unknown / insufficient data" };
    default:
      return { status: "unavailable", label: classification || "Unknown" };
  }
}

/** PlanningRevisionStatus → StatusBadge */
export function mapScenarioStatusBadge(status: string): StatusBadgeMapping {
  switch (status) {
    case "DRAFT":
      return { status: "draft", label: "Draft" };
    case "READY_FOR_REVIEW":
      return { status: "pending", label: "Ready for review" };
    case "SELECTED":
      return { status: "pending", label: "Selected for review" };
    case "PROMOTED":
      return { status: "approved", label: "Promoted" };
    case "ACTIVE_PLAN":
      return { status: "in-progress", label: "CURRENT plan" };
    case "ARCHIVED":
      return { status: "archived", label: "Archived" };
    default:
      return { status: "draft", label: status || "Draft" };
  }
}

/** PiStatus → StatusBadge */
export function mapPiStatusBadge(status: string): StatusBadgeMapping {
  switch (status) {
    case "DRAFT":
      return { status: "draft", label: "Draft" };
    case "PLANNING":
      return { status: "in-progress", label: "Planning" };
    case "REVIEW":
      return { status: "pending", label: "In review" };
    case "BASELINED":
      return { status: "approved", label: "Baselined" };
    case "ACTIVE":
      return { status: "in-progress", label: "Active" };
    case "CLOSED":
      return { status: "completed", label: "Closed" };
    default:
      return { status: "draft", label: status || "Draft" };
  }
}

/** Initiative stage / explorer statusLabel for initiatives */
export function mapInitiativeStageBadge(stage: string): StatusBadgeMapping {
  switch (stage) {
    case "DEMAND":
      return { status: "draft", label: "Demand" };
    case "REQUIREMENTS":
      return { status: "in-progress", label: "Requirements" };
    case "PRE_STUDY":
      return { status: "in-progress", label: "Pre-study" };
    case "POC":
      return { status: "pending", label: "PoC" };
    case "PILOT":
      return { status: "pending", label: "Pilot" };
    case "PROJECT":
      return { status: "approved", label: "Project" };
    default:
      return { status: "draft", label: stage || "Demand" };
  }
}

/** Project status strings commonly used in explorer */
export function mapProjectStatusBadge(status: string): StatusBadgeMapping {
  switch (status) {
    case "ACTIVE":
    case "IN_PROGRESS":
      return { status: "in-progress", label: humanizeToken(status) };
    case "ON_HOLD":
      return { status: "pending", label: "On hold" };
    case "BLOCKED":
      return { status: "blocked", label: "Blocked" };
    case "AT_RISK":
      return { status: "at-risk", label: "At risk" };
    case "COMPLETED":
    case "DONE":
    case "CLOSED":
      return { status: "completed", label: humanizeToken(status) };
    case "CANCELLED":
      return { status: "cancelled", label: "Cancelled" };
    case "ARCHIVED":
      return { status: "archived", label: "Archived" };
    case "DRAFT":
      return { status: "draft", label: "Draft" };
    default:
      return { status: "in-progress", label: humanizeToken(status) };
  }
}

/** Explorer row: initiative stage vs project status */
export function mapExplorerStatusBadge(
  kind: "INITIATIVE" | "PROJECT" | string,
  statusLabel: string,
): StatusBadgeMapping {
  if (kind === "INITIATIVE") {
    return mapInitiativeStageBadge(statusLabel);
  }
  return mapProjectStatusBadge(statusLabel);
}

/** Plan approval / baseline presentation (not domain transitions). */
export function mapApprovalStateBadge(input: {
  hasValidApproval: boolean;
  hasBaseline?: boolean;
  invalidated?: boolean;
}): StatusBadgeMapping {
  if (input.hasBaseline) {
    return { status: "approved", label: "Baselined" };
  }
  if (input.hasValidApproval) {
    return { status: "approved", label: "Approved" };
  }
  if (input.invalidated) {
    return { status: "at-risk", label: "Approval invalidated" };
  }
  return { status: "pending", label: "Not approved" };
}

function humanizeToken(value: string): string {
  if (!value) return STATUS_BADGE_LABELS.draft;
  return value
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
