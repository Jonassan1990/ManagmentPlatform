import type { StatusBadgeMapping } from "@/components/ui/status-adapters";

export function mapVacationStatusBadge(status: string): StatusBadgeMapping {
  switch (status) {
    case "SUBMITTED":
      return { status: "pending", label: "Submitted" };
    case "CHANGES_REQUESTED":
      return { status: "at-risk", label: "Changes requested" };
    case "APPROVED":
      return { status: "approved", label: "Approved" };
    case "REJECTED":
      return { status: "blocked", label: "Rejected" };
    case "CANCELLED":
      return { status: "cancelled", label: "Cancelled" };
    default:
      return { status: "unavailable", label: status || "Unknown" };
  }
}

export function mapVacationAuditLabel(action: string): string {
  switch (action) {
    case "CREATED":
      return "Created";
    case "UPDATED":
      return "Updated";
    case "RESUBMITTED":
      return "Resubmitted";
    case "CHANGES_REQUESTED":
      return "Asked for changes";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return action;
  }
}
