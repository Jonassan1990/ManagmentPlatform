import { cn } from "@/components/ui/cn";

/**
 * Presentation-only status keys. Map domain enums in adapters (M4B-C+).
 * Never put lifecycle transitions here.
 */
export type StatusBadgeVariant =
  | "draft"
  | "in-progress"
  | "pending"
  | "approved"
  | "completed"
  | "cancelled"
  | "blocked"
  | "at-risk"
  | "unavailable"
  | "archived";

export const STATUS_BADGE_LABELS: Record<StatusBadgeVariant, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  pending: "Pending review",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  blocked: "Blocked",
  "at-risk": "At risk",
  unavailable: "Unavailable",
  archived: "Archived",
};

const statusClass: Record<StatusBadgeVariant, string> = {
  draft: "ds-status--draft",
  "in-progress": "ds-status--in-progress",
  pending: "ds-status--pending",
  approved: "ds-status--approved",
  completed: "ds-status--completed",
  cancelled: "ds-status--cancelled",
  blocked: "ds-status--blocked",
  "at-risk": "ds-status--at-risk",
  unavailable: "ds-status--unavailable",
  archived: "ds-status--archived",
};

export type StatusBadgeProps = {
  status: StatusBadgeVariant;
  /** Override visible label (still required to be human-readable). */
  label?: string;
  size?: "compact" | "normal";
  className?: string;
};

export function StatusBadge({
  status,
  label,
  size = "normal",
  className,
}: StatusBadgeProps) {
  const text = label ?? STATUS_BADGE_LABELS[status];
  return (
    <span
      className={cn(
        "ds-status",
        statusClass[status],
        size === "compact" && "text-[0.6875rem] px-1.5",
        className,
      )}
      data-status={status}
    >
      <span aria-hidden="true" className="font-bold">
        ·
      </span>
      <span>{text}</span>
    </span>
  );
}
