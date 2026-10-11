/**
 * Manager Resource Management KPI helpers.
 * Pure transforms over existing Portfolio PI capacity + dependency views.
 * Hours-based only (ADR-012) — no invented FTE.
 */

import type { AggregatedResourceRow, DepartmentCardModel } from "./portfolio-capacity-model";
import { formatCapacityHours, formatUtilizationPct } from "./portfolio-capacity-model";
import type { CapacityDependenciesView } from "./portfolio-capacity-coordination";

export type ManagerResourceKpis = {
  capacityAllocatedPctLabel: string;
  capacityAllocatedUtil: number | null;
  capacityAllocatedNote: string;
  overloadedResources: number;
  overloadedNote: string;
  crossFunctionalAssignments: number;
  crossFunctionalPeople: number;
  crossFunctionalNote: string;
  externalDependencies: number;
  externalDependenciesAttention: number;
  externalDependenciesNote: string;
};

/**
 * Count distinct resources that appear on more than one team in the hierarchy.
 * Each multi-team resource contributes (teamCount) assignment rows.
 */
export function summarizeCrossFunctional(
  resources: AggregatedResourceRow[],
): { people: number; assignments: number } {
  const byResource = new Map<string, Set<string>>();
  for (const r of resources) {
    const set = byResource.get(r.resourceId) ?? new Set<string>();
    set.add(r.teamId);
    byResource.set(r.resourceId, set);
  }
  let people = 0;
  let assignments = 0;
  for (const teams of byResource.values()) {
    if (teams.size > 1) {
      people += 1;
      assignments += teams.size;
    }
  }
  return { people, assignments };
}

export function summarizeOverloadedResources(
  cards: DepartmentCardModel[],
): number {
  const overloaded = new Set<string>();
  for (const card of cards) {
    for (const team of card.teams) {
      for (const r of team.resources) {
        if (r.band === "overload") overloaded.add(r.resourceId);
      }
    }
  }
  return overloaded.size;
}

export function summarizeManagerResourceKpis(input: {
  availableHours: number;
  committedHours: number;
  utilization: number | null;
  cards: DepartmentCardModel[];
  aggregatedResources: AggregatedResourceRow[];
  dependencies: CapacityDependenciesView;
}): ManagerResourceKpis {
  const overloadedResources = summarizeOverloadedResources(input.cards);
  const cf = summarizeCrossFunctional(input.aggregatedResources);
  const externalDependencies =
    input.dependencies.state === "ready"
      ? input.dependencies.rows.length
      : (input.dependencies.openCount ?? 0) +
        (input.dependencies.criticalCount ?? 0);
  const attention =
    input.dependencies.state === "ready"
      ? input.dependencies.rows.filter(
          (d) =>
            d.status === "OPEN" &&
            (d.criticality === "HIGH" || d.criticality === "CRITICAL"),
        ).length
      : (input.dependencies.criticalCount ?? 0);

  return {
    capacityAllocatedPctLabel: formatUtilizationPct(input.utilization),
    capacityAllocatedUtil: input.utilization,
    capacityAllocatedNote: `${formatCapacityHours(input.committedHours)} of ${formatCapacityHours(input.availableHours)} h planned`,
    overloadedResources,
    overloadedNote: "Planned above 100% capacity",
    crossFunctionalAssignments: cf.assignments,
    crossFunctionalPeople: cf.people,
    crossFunctionalNote:
      cf.people === 0
        ? "No multi-team shared people in scope"
        : `${cf.people} people shared across workstreams`,
    externalDependencies,
    externalDependenciesAttention: attention,
    externalDependenciesNote:
      attention === 0
        ? "No partner actions flagged"
        : `${attention} partner-team actions need attention`,
  };
}

export type ResourceWorkspaceView =
  | "overview"
  | "allocation"
  | "cross-functional"
  | "dependencies"
  | "capacity-demand"
  | "reports";

export const RESOURCE_WORKSPACE_NAV: Array<{
  id: ResourceWorkspaceView;
  label: string;
  group: "workspace" | "management";
  icon: string;
}> = [
  { id: "overview", label: "Resource overview", group: "workspace", icon: "▦" },
  { id: "allocation", label: "Allocation plan", group: "workspace", icon: "◫" },
  {
    id: "cross-functional",
    label: "Cross-functional work",
    group: "workspace",
    icon: "⇄",
  },
  {
    id: "dependencies",
    label: "Department dependencies",
    group: "workspace",
    icon: "⌘",
  },
  {
    id: "capacity-demand",
    label: "Capacity & demand",
    group: "management",
    icon: "▤",
  },
  { id: "reports", label: "Reports", group: "management", icon: "↗" },
];
