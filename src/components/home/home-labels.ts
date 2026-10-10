/**
 * M5B-B — presentation labels for Home dashboard (no AuthZ / KPI logic).
 */
import type {
  HomeDashboardMode,
  HomeMyWorkAttribution,
  HomeMyWorkItem,
  HomeAvailabilityState,
} from "@/modules/portfolio/domain/home-dashboard";

export function modeHeadline(mode: HomeDashboardMode): string {
  switch (mode) {
    case "manager":
      return "Management overview";
    case "employee":
      return "Your work";
    case "mixed":
      return "Your work & management overview";
  }
}

export function modeDescription(mode: HomeDashboardMode): string {
  switch (mode) {
    case "manager":
      return "See what needs attention, review portfolio health, and start the next planning or delivery action.";
    case "employee":
      return "Open the work you own, check relevant planning context, and jump to authorized destinations.";
    case "mixed":
      return "Track your owned work alongside management attention, portfolio signals, and Quick Start actions.";
  }
}

export function roleContextLabel(roleKeys: string[]): string | null {
  if (roleKeys.length === 0) return null;
  const labels = roleKeys.map(humanRoleKey);
  // Prefer the most specific non-viewer label first for the chip.
  const preferred =
    labels.find((l) => l !== "Viewer") ?? labels[0] ?? null;
  if (!preferred) return null;
  if (labels.length === 1) return preferred;
  return `${preferred} · +${labels.length - 1} more`;
}

export function humanRoleKey(key: string): string {
  const map: Record<string, string> = {
    "organization.admin": "Organization Admin",
    "portfolio.manager": "Portfolio Manager",
    "section.manager": "Section Manager",
    "department.manager": "Department Manager",
    "team.manager": "Team Manager",
    "project.manager": "Project Manager",
    "organization.viewer": "Viewer",
    "platform.bootstrap_admin": "Platform Admin",
  };
  return map[key] ?? key;
}

export function attributionLabel(attr: HomeMyWorkAttribution): string {
  if (attr.basis === "role_permission") {
    return attr.relationship === "PENDING_APPROVAL"
      ? "Pending approval"
      : "Pending decision";
  }
  const labels: Record<typeof attr.relationship, string> = {
    INITIATIVE_BUSINESS_OWNER: "Business owner",
    INITIATIVE_REQUESTER: "Requester",
    INITIATIVE_SPONSOR: "Sponsor",
    PROJECT_OWNER: "Project owner",
    WORK_ITEM_OWNER: "Work item owner",
    POC_OWNER: "PoC owner",
    PILOT_OWNER: "Pilot owner",
    RISK_OWNER: "Risk owner",
    MILESTONE_OWNER: "Milestone owner",
    PLANNING_DEPENDENCY_OWNER: "Dependency owner",
  };
  return labels[attr.relationship];
}

export function workKindLabel(kind: HomeMyWorkItem["kind"]): string {
  const map: Record<HomeMyWorkItem["kind"], string> = {
    initiative: "Initiative",
    project: "Project",
    work_item: "Work item",
    poc: "PoC",
    pilot: "Pilot",
    risk: "Risk",
    milestone: "Milestone",
    dependency: "Dependency",
    approval: "Approval",
    decision: "Decision",
  };
  return map[kind];
}

export function availabilityTitle(state: HomeAvailabilityState): string {
  switch (state) {
    case "empty":
      return "Nothing here yet";
    case "unavailable":
      return "Temporarily unavailable";
    case "forbidden":
    case "no_permission":
      return "Not available for your access";
    case "no_linked_resource":
      return "No linked work identity";
    case "no_organization":
      return "No organization yet";
    case "available":
      return "Available";
  }
}

/** Primary Quick Start action ids for manager first-screen emphasis. */
export const PRIMARY_QUICK_START_IDS = new Set([
  "create-initiative",
  "open-pi-planning",
  "review-governance",
  "manage-resources",
  "view-projects",
]);
