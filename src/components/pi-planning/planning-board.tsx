"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  allocateWorkAction,
  moveAllocationAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/page";
import { fieldClassName } from "@/components/ui/forms";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import { BoardFilters, BacklogPanel } from "./backlog-panel";
import { MoveWorkForm } from "./move-work-form";
import { WorkCard, type WorkCardData, type BacklogItemData } from "./work-card";
import { formatHours, utilizationBarClass } from "./pi-nav";

type Caps = Partial<PrincipalCapabilities>;

type Iteration = {
  id: string;
  name: string;
  sequence: number;
  referenceKey: string;
};

type BoardTeam = {
  teamId: string;
  teamName: string;
  departmentId: string;
  iterations: {
    iteration: Iteration;
    utilizationBand: string;
    hasOverload: boolean;
    conflictCount: number;
    capacity: {
      effectiveCapacityHours: number;
      plannedLoadHours: number;
      utilization: number | null;
      band: string;
    } | null;
    cards: WorkCardData[];
  }[];
};

type BoardDepartment = {
  departmentId: string;
  departmentName: string;
  teams: BoardTeam[];
};

export function PlanningBoard({
  piId,
  departments,
  iterations,
  backlog,
  capabilities,
}: {
  piId: string;
  departments: BoardDepartment[];
  iterations: Iteration[];
  backlog: BacklogItemData[];
  capabilities?: Caps;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    departmentId: "",
    projectId: "",
    type: "",
    priority: "",
  });
  const [mobileIterationId, setMobileIterationId] = useState(
    iterations[0]?.id ?? "",
  );
  const [mobileTeamId, setMobileTeamId] = useState(
    departments[0]?.teams[0]?.teamId ?? "",
  );

  const canAllocate = capabilities?.canAllocatePi !== false;

  const allTeams = departments.flatMap((d) =>
    d.teams.map((t) => ({
      id: t.teamId,
      name: t.teamName,
      departmentId: t.departmentId,
      departmentName: d.departmentName,
    })),
  );

  const projectOptions = (() => {
    const map = new Map<
      string,
      { id: string; referenceKey: string; name: string }
    >();
    for (const item of backlog) {
      map.set(item.project.id, item.project);
    }
    for (const d of departments) {
      for (const t of d.teams) {
        for (const cell of t.iterations) {
          for (const card of cell.cards) {
            map.set(card.workItem.project.id, card.workItem.project);
          }
        }
      }
    }
    return [...map.values()];
  })();

  const typeOptions = (() => {
    const set = new Set<string>();
    for (const item of backlog) set.add(item.type);
    for (const d of departments) {
      for (const t of d.teams) {
        for (const cell of t.iterations) {
          for (const card of cell.cards) set.add(card.workItem.type);
        }
      }
    }
    return [...set].sort();
  })();

  const priorityOptions = (() => {
    const set = new Set<string>();
    for (const item of backlog) set.add(item.priority);
    for (const d of departments) {
      for (const t of d.teams) {
        for (const cell of t.iterations) {
          for (const card of cell.cards) set.add(card.workItem.priority);
        }
      }
    }
    return [...set].sort();
  })();

  const filteredDepartments = departments
    .filter(
      (d) => !filters.departmentId || d.departmentId === filters.departmentId,
    )
    .map((d) => ({
      ...d,
      teams: d.teams.map((t) => ({
        ...t,
        iterations: t.iterations.map((cell) => ({
          ...cell,
          cards: cell.cards.filter((card) => {
            if (
              filters.projectId &&
              card.workItem.project.id !== filters.projectId
            )
              return false;
            if (filters.type && card.workItem.type !== filters.type)
              return false;
            if (
              filters.priority &&
              card.workItem.priority !== filters.priority
            )
              return false;
            return true;
          }),
        })),
      })),
    }));

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDrop(
    iterationId: string,
    teamId: string,
    e: React.DragEvent,
  ) {
    e.preventDefault();
    if (!canAllocate) return;
    setError(null);

    const allocRaw = e.dataTransfer.getData("application/x-pi-allocation");
    const backlogRaw = e.dataTransfer.getData("application/x-pi-backlog");

    if (allocRaw) {
      try {
        const { allocationId, version } = JSON.parse(allocRaw) as {
          allocationId: string;
          version: number;
        };
        const result = await moveAllocationAction({
          piId,
          allocationId,
          iterationId,
          teamId,
          expectedVersion: version,
        });
        if (!result.ok) {
          setError(
            result.error.code === "STALE_VERSION"
              ? `${result.error.message} Refresh the board and try again.`
              : result.error.message,
          );
          return;
        }
        refresh();
      } catch {
        setError("Could not move allocation.");
      }
      return;
    }

    if (backlogRaw) {
      try {
        const { workItemId } = JSON.parse(backlogRaw) as { workItemId: string };
        const result = await allocateWorkAction({
          piId,
          workItemId,
          iterationId,
          teamId,
        });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        refresh();
      } catch {
        setError("Could not allocate work item.");
      }
    }
  }

  let mobileCell: {
    department: (typeof filteredDepartments)[number];
    team: BoardTeam;
    cell: BoardTeam["iterations"][number];
  } | null = null;
  for (const d of filteredDepartments) {
    for (const t of d.teams) {
      if (t.teamId !== mobileTeamId) continue;
      const cell = t.iterations.find(
        (c) => c.iteration.id === mobileIterationId,
      );
      if (cell) {
        mobileCell = { department: d, team: t, cell };
        break;
      }
    }
    if (mobileCell) break;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <BoardFilters
          departments={departments.map((d) => ({
            id: d.departmentId,
            name: d.departmentName,
          }))}
          projects={projectOptions}
          types={typeOptions}
          priorities={priorityOptions}
          value={filters}
          onChange={setFilters}
        />
        {pending ? (
          <p className="text-xs text-[var(--muted)]">Refreshing…</p>
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {/* Mobile: list / drill-down */}
      <div className="space-y-3 md:hidden">
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            aria-label="Iteration"
            className={fieldClassName}
            value={mobileIterationId}
            onChange={(e) => setMobileIterationId(e.target.value)}
          >
            {iterations.map((it) => (
              <option key={it.id} value={it.id}>
                {it.sequence}. {it.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Team"
            className={fieldClassName}
            value={mobileTeamId}
            onChange={(e) => setMobileTeamId(e.target.value)}
          >
            {allTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.departmentName} / {t.name}
              </option>
            ))}
          </select>
        </div>
        {mobileCell ? (
          <CellPanel
            piId={piId}
            cell={mobileCell.cell}
            team={mobileCell.team}
            departmentName={mobileCell.department.departmentName}
            iterations={iterations}
            teams={allTeams}
            canAllocate={canAllocate}
            capabilities={capabilities}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onDrop={handleDrop}
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Select an iteration and team, or add participation in Settings.
          </p>
        )}
        <div className="rounded-lg border border-[var(--line)]">
          <BacklogPanel
            piId={piId}
            items={backlog}
            iterations={iterations}
            teams={allTeams}
            canAllocate={canAllocate}
            capabilities={capabilities}
            filters={filters}
          />
        </div>
      </div>

      {/* Desktop matrix */}
      <div className="hidden md:grid md:grid-cols-[1fr_280px] md:gap-0 md:overflow-hidden md:rounded-lg md:border md:border-[var(--line)]">
        <div className="min-w-0 overflow-x-auto">
          {filteredDepartments.length === 0 || iterations.length === 0 ? (
            <div className="p-6 text-sm text-[var(--muted)]">
              {iterations.length === 0
                ? "Define iterations in Settings before planning on the board."
                : filteredDepartments.every((d) => d.teams.length === 0)
                  ? "Add participating teams in Settings to populate the board."
                  : "No departments match the current filters."}
            </div>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 min-w-[10rem] border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left font-medium">
                    Team
                  </th>
                  {iterations.map((it) => (
                    <th
                      key={it.id}
                      className="sticky top-0 z-10 min-w-[12rem] border-b border-l border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left font-medium"
                    >
                      <span className="block">{it.name}</span>
                      <span className="text-xs font-normal text-[var(--muted)]">
                        {it.referenceKey}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDepartments.map((dept) => (
                  <Fragment key={dept.departmentId}>
                    <tr>
                      <td
                        colSpan={iterations.length + 1}
                        className="bg-[var(--accent-soft)]/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]"
                      >
                        {dept.departmentName}
                      </td>
                    </tr>
                    {dept.teams.length === 0 ? (
                      <tr>
                        <td
                          colSpan={iterations.length + 1}
                          className="px-3 py-3 text-sm text-[var(--muted)]"
                        >
                          No participating teams in this department.
                        </td>
                      </tr>
                    ) : (
                      dept.teams.map((team) => (
                        <tr key={team.teamId} className="align-top">
                          <th className="sticky left-0 z-10 border-t border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left font-medium">
                            {team.teamName}
                          </th>
                          {team.iterations.map((cell) => (
                            <td
                              key={`${team.teamId}-${cell.iteration.id}`}
                              className="border-l border-t border-[var(--line)] p-2"
                              onDragOver={(e) => {
                                if (canAllocate) e.preventDefault();
                              }}
                              onDrop={(e) =>
                                handleDrop(cell.iteration.id, team.teamId, e)
                              }
                            >
                              <CellBody
                                piId={piId}
                                cell={cell}
                                teamId={team.teamId}
                                iterations={iterations}
                                teams={allTeams}
                                canAllocate={canAllocate}
                                capabilities={capabilities}
                                expandedId={expandedId}
                                setExpandedId={setExpandedId}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <BacklogPanel
          piId={piId}
          items={backlog}
          iterations={iterations}
          teams={allTeams}
          canAllocate={canAllocate}
          capabilities={capabilities}
          filters={filters}
        />
      </div>
    </div>
  );
}

function CellBody({
  piId,
  cell,
  teamId,
  iterations,
  teams,
  canAllocate,
  capabilities,
  expandedId,
  setExpandedId,
}: {
  piId: string;
  cell: BoardTeam["iterations"][number];
  teamId: string;
  iterations: Iteration[];
  teams: {
    id: string;
    name: string;
    departmentId: string;
    departmentName: string;
  }[];
  canAllocate: boolean;
  capabilities?: Caps;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const utilPct =
    cell.capacity?.utilization != null
      ? Math.round(cell.capacity.utilization * 100)
      : null;

  return (
    <div className="min-h-[5rem] space-y-2">
      <div className="flex items-center justify-between gap-1 text-[10px]">
        {cell.hasOverload || cell.utilizationBand === "overload" ? (
          <span className="rounded bg-[var(--danger)]/10 px-1.5 py-0.5 font-medium text-[var(--danger)]">
            Overload
          </span>
        ) : cell.utilizationBand === "near" ? (
          <span className="rounded bg-[var(--warning)]/15 px-1.5 py-0.5 text-[var(--warning)]">
            Near capacity
          </span>
        ) : (
          <span className="text-[var(--muted)]">
            {cell.capacity
              ? `${formatHours(cell.capacity.plannedLoadHours)} / ${formatHours(cell.capacity.effectiveCapacityHours)}`
              : "No capacity"}
          </span>
        )}
        {utilPct != null ? (
          <span className="text-[var(--muted)]">{utilPct}%</span>
        ) : null}
      </div>
      {cell.capacity ? (
        <div className="h-1 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className={`h-full ${utilizationBarClass(cell.capacity.band)}`}
            style={{
              width: `${Math.min(100, (cell.capacity.utilization ?? 0) * 100)}%`,
            }}
          />
        </div>
      ) : null}
      {cell.cards.map((card) => (
        <WorkCard
          key={card.allocationId}
          card={card}
          overloaded={cell.hasOverload}
          draggable={canAllocate}
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/x-pi-allocation",
              JSON.stringify({
                allocationId: card.allocationId,
                version: card.version,
              }),
            );
            e.dataTransfer.effectAllowed = "move";
          }}
          expanded={expandedId === card.allocationId}
          onToggleExpand={() =>
            setExpandedId(
              expandedId === card.allocationId ? null : card.allocationId,
            )
          }
          moveSlot={
            canAllocate ? (
              <MoveWorkForm
                piId={piId}
                allocationId={card.allocationId}
                expectedVersion={card.version}
                iterations={iterations}
                teams={teams}
                defaultIterationId={cell.iteration.id}
                defaultTeamId={teamId}
                capabilities={capabilities}
              />
            ) : null
          }
        />
      ))}
    </div>
  );
}

function CellPanel({
  piId,
  cell,
  team,
  departmentName,
  iterations,
  teams,
  canAllocate,
  capabilities,
  expandedId,
  setExpandedId,
  onDrop,
}: {
  piId: string;
  cell: BoardTeam["iterations"][number];
  team: BoardTeam;
  departmentName: string;
  iterations: Iteration[];
  teams: {
    id: string;
    name: string;
    departmentId: string;
    departmentName: string;
  }[];
  canAllocate: boolean;
  capabilities?: Caps;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onDrop: (iterationId: string, teamId: string, e: React.DragEvent) => void;
}) {
  return (
    <section
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
      onDragOver={(e) => {
        if (canAllocate) e.preventDefault();
      }}
      onDrop={(e) => onDrop(cell.iteration.id, team.teamId, e)}
    >
      <h3 className="font-medium">
        {departmentName} / {team.teamName}
      </h3>
      <p className="text-xs text-[var(--muted)]">{cell.iteration.name}</p>
      <div className="mt-3">
        <CellBody
          piId={piId}
          cell={cell}
          teamId={team.teamId}
          iterations={iterations}
          teams={teams}
          canAllocate={canAllocate}
          capabilities={capabilities}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        />
      </div>
      {canAllocate && cell.cards.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Drop backlog items here, or use Allocate on a backlog card.
        </p>
      ) : null}
    </section>
  );
}
