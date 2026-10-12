"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  allocateWorkAction,
  moveAllocationAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/alert";
import { buttonClassName } from "@/components/ui/button";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { fieldClassName } from "@/components/ui/forms";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import {
  BoardFilters,
  BacklogPanel,
  type BoardFilterState,
} from "./backlog-panel";
import { MoveWorkForm } from "./move-work-form";
import {
  PiPlanningCalendar,
  type CalendarAllocation,
  type CalendarGranularity,
  type CalendarIteration,
} from "./pi-planning-calendar";
import { WorkCard, type WorkCardData, type BacklogItemData } from "./work-card";

type Caps = Partial<PrincipalCapabilities>;

type Iteration = {
  id: string;
  name: string;
  sequence: number;
  referenceKey: string;
  startDate?: string;
  endDate?: string;
};

type BoardViewMode = "overview" | "detail";

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

const EMPTY_FILTERS: BoardFilterState = {
  departmentId: "",
  projectId: "",
  initiativeId: "",
  type: "",
  priority: "",
};

export function PlanningBoard({
  piId,
  revisionId,
  departments,
  iterations,
  backlog,
  capabilities,
  readOnlyScenario,
  piStartDate,
  piEndDate,
  initialViewMode = "overview",
}: {
  piId: string;
  /** Active revision (CURRENT or scenario). Passed to allocate mutations. */
  revisionId?: string;
  departments: BoardDepartment[];
  iterations: Iteration[];
  backlog: BacklogItemData[];
  capabilities?: Caps;
  /** When true, scenario is not DRAFT — block allocate UI. */
  readOnlyScenario?: boolean;
  piStartDate?: string;
  piEndDate?: string;
  /** Test / deep-link override. Defaults to calendar overview. */
  initialViewMode?: BoardViewMode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<BoardViewMode>(initialViewMode);
  const [granularity, setGranularity] = useState<CalendarGranularity>("week");
  const [filters, setFilters] = useState<BoardFilterState>(EMPTY_FILTERS);
  const [mobileIterationId, setMobileIterationId] = useState(
    iterations[0]?.id ?? "",
  );
  const [mobileTeamId, setMobileTeamId] = useState(
    departments[0]?.teams[0]?.teamId ?? "",
  );

  const canAllocate =
    capabilities?.canAllocatePi !== false && !readOnlyScenario;

  const allTeams = departments.flatMap((d) =>
    d.teams.map((t) => ({
      id: t.teamId,
      name: t.teamName,
      departmentId: t.departmentId,
      departmentName: d.departmentName,
    })),
  );

  const projectOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        referenceKey: string;
        name: string;
        initiativeId?: string | null;
      }
    >();
    for (const item of backlog) {
      map.set(item.project.id, {
        ...item.project,
        initiativeId: item.project.initiative?.id ?? null,
      });
    }
    for (const d of departments) {
      for (const t of d.teams) {
        for (const cell of t.iterations) {
          for (const card of cell.cards) {
            map.set(card.workItem.project.id, {
              ...card.workItem.project,
              initiativeId: card.workItem.project.initiative?.id ?? null,
            });
          }
        }
      }
    }
    let list = [...map.values()];
    if (filters.initiativeId) {
      list = list.filter((p) => p.initiativeId === filters.initiativeId);
    }
    return list.sort((a, b) => a.referenceKey.localeCompare(b.referenceKey));
  }, [backlog, departments, filters.initiativeId]);

  const initiativeOptions = useMemo(() => {
    const map = new Map<
      string,
      { id: string; referenceKey: string; name: string }
    >();
    for (const item of backlog) {
      const init = item.project.initiative;
      if (init) map.set(init.id, init);
    }
    for (const d of departments) {
      for (const t of d.teams) {
        for (const cell of t.iterations) {
          for (const card of cell.cards) {
            const init = card.workItem.project.initiative;
            if (init) map.set(init.id, init);
          }
        }
      }
    }
    return [...map.values()].sort((a, b) =>
      a.referenceKey.localeCompare(b.referenceKey),
    );
  }, [backlog, departments]);

  const typeOptions = useMemo(() => {
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
  }, [backlog, departments]);

  const priorityOptions = useMemo(() => {
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
  }, [backlog, departments]);

  function cardMatchesFilters(card: WorkCardData): boolean {
    if (
      filters.projectId &&
      card.workItem.project.id !== filters.projectId
    ) {
      return false;
    }
    if (
      filters.initiativeId &&
      card.workItem.project.initiative?.id !== filters.initiativeId
    ) {
      return false;
    }
    if (filters.type && card.workItem.type !== filters.type) return false;
    if (filters.priority && card.workItem.priority !== filters.priority) {
      return false;
    }
    return true;
  }

  const filteredDepartments = useMemo(
    () =>
      departments
        .filter(
          (d) =>
            !filters.departmentId || d.departmentId === filters.departmentId,
        )
        .map((d) => ({
          ...d,
          teams: d.teams.map((t) => ({
            ...t,
            iterations: t.iterations.map((cell) => ({
              ...cell,
              cards: cell.cards.filter(cardMatchesFilters),
            })),
          })),
        })),
    // cardMatchesFilters closes over filters; deps are explicit below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [departments, filters],
  );

  const calendarIterations: CalendarIteration[] = useMemo(
    () =>
      iterations
        .filter((it) => it.startDate && it.endDate)
        .map((it) => ({
          id: it.id,
          name: it.name,
          sequence: it.sequence,
          referenceKey: it.referenceKey,
          startDate: it.startDate!,
          endDate: it.endDate!,
        })),
    [iterations],
  );

  const calendarAllocations: CalendarAllocation[] = useMemo(() => {
    const out: CalendarAllocation[] = [];
    for (const d of filteredDepartments) {
      for (const t of d.teams) {
        for (const cell of t.iterations) {
          for (const card of cell.cards) {
            out.push({
              allocationId: card.allocationId,
              teamId: t.teamId,
              teamName: t.teamName,
              departmentId: d.departmentId,
              departmentName: d.departmentName,
              iterationId: cell.iteration.id,
              plannedHours: card.plannedHours,
              card,
            });
          }
        }
      }
    }
    return out;
  }, [filteredDepartments]);

  const resolvedPiStart =
    piStartDate ??
    calendarIterations
      .map((it) => it.startDate)
      .sort()[0] ??
    "";
  const resolvedPiEnd =
    piEndDate ??
    calendarIterations
      .map((it) => it.endDate)
      .sort()
      .at(-1) ??
    "";

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
          ...(revisionId ? { revisionId } : {}),
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

  function focusAllocation(allocationId: string) {
    setViewMode("detail");
    setExpandedId(allocationId);
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

  const filterAnnounce = [
    filters.departmentId ? "department filter on" : null,
    filters.initiativeId ? "initiative filter on" : null,
    filters.projectId ? "project filter on" : null,
    filters.type ? "type filter on" : null,
    filters.priority ? "priority filter on" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const boardStats = useMemo(() => {
    let allocated = 0;
    let overloadCells = 0;
    let conflictCells = 0;
    let teamsVisible = 0;
    for (const d of filteredDepartments) {
      teamsVisible += d.teams.length;
      for (const t of d.teams) {
        for (const cell of t.iterations) {
          allocated += cell.cards.length;
          if (cell.hasOverload || cell.utilizationBand === "overload") {
            overloadCells += 1;
          }
          if (cell.conflictCount > 0) conflictCells += 1;
        }
      }
    }
    const backlogVisible = backlog.filter((item) => {
      if (filters.projectId && item.project.id !== filters.projectId)
        return false;
      if (
        filters.initiativeId &&
        item.project.initiative?.id !== filters.initiativeId
      )
        return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.priority && item.priority !== filters.priority) return false;
      return true;
    }).length;
    return {
      allocated,
      backlogVisible,
      overloadCells,
      conflictCells,
      teamsVisible,
    };
  }, [filteredDepartments, backlog, filters]);

  return (
    <div className="pi-plan" data-testid="pi-planning-workspace">
      <div className="pi-shell">
        <div className="pi-toolbar">
          <div className="pi-toolbar-top">
            <div className="pi-toolbar-copy">
              <p className="pi-toolbar-eyebrow">Program increment plan</p>
              <h2 className="pi-toolbar-title">
                {viewMode === "overview"
                  ? "Calendar overview"
                  : "Iteration detail board"}
              </h2>
              <p className="pi-toolbar-hint">
                {viewMode === "overview"
                  ? "See allocated work across the PI by week or month. Click a bar to open Detail and adjust."
                  : "Allocate and move work across teams and iterations. Drag from backlog or use Details / Move."}
              </p>
            </div>
            <div className="pi-toolbar-controls">
              <div
                className="pi-segment"
                role="tablist"
                aria-label="Plan view"
                data-testid="pi-board-view-mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "overview"}
                  className={buttonClassName({
                    variant: viewMode === "overview" ? "primary" : "ghost",
                    size: "sm",
                    className: "min-w-[5.5rem]",
                  })}
                  onClick={() => setViewMode("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "detail"}
                  className={buttonClassName({
                    variant: viewMode === "detail" ? "primary" : "ghost",
                    size: "sm",
                    className: "min-w-[5.5rem]",
                  })}
                  onClick={() => setViewMode("detail")}
                >
                  Detail
                </button>
              </div>
              {viewMode === "overview" ? (
                <div
                  className="pi-segment"
                  role="group"
                  aria-label="Calendar granularity"
                  data-testid="pi-calendar-granularity"
                >
                  <button
                    type="button"
                    aria-pressed={granularity === "week"}
                    className={buttonClassName({
                      variant: granularity === "week" ? "secondary" : "ghost",
                      size: "sm",
                    })}
                    onClick={() => setGranularity("week")}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    aria-pressed={granularity === "month"}
                    className={buttonClassName({
                      variant: granularity === "month" ? "secondary" : "ghost",
                      size: "sm",
                    })}
                    onClick={() => setGranularity("month")}
                  >
                    Month
                  </button>
                </div>
              ) : null}
              {pending ? (
                <p
                  className="text-xs text-[var(--muted)]"
                  role="status"
                  aria-live="polite"
                >
                  Refreshing…
                </p>
              ) : null}
            </div>
          </div>

          <div className="pi-stats" aria-label="Plan snapshot">
            <div className="pi-stat">
              <p className="pi-stat-label">Allocated</p>
              <p className="pi-stat-value">{boardStats.allocated}</p>
            </div>
            <div className="pi-stat">
              <p className="pi-stat-label">Backlog</p>
              <p className="pi-stat-value">{boardStats.backlogVisible}</p>
            </div>
            <div className="pi-stat">
              <p className="pi-stat-label">Teams</p>
              <p className="pi-stat-value">{boardStats.teamsVisible}</p>
            </div>
            <div className="pi-stat">
              <p className="pi-stat-label">Overload cells</p>
              <p
                className="pi-stat-value"
                data-tone={
                  boardStats.overloadCells > 0
                    ? "danger"
                    : boardStats.conflictCells > 0
                      ? "warn"
                      : undefined
                }
              >
                {boardStats.overloadCells}
              </p>
            </div>
          </div>

          <BoardFilters
            departments={departments.map((d) => ({
              id: d.departmentId,
              name: d.departmentName,
            }))}
            projects={projectOptions}
            initiatives={initiativeOptions}
            types={typeOptions}
            priorities={priorityOptions}
            value={filters}
            onChange={setFilters}
          />
        </div>

        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {filterAnnounce
            ? `Board filters active: ${filterAnnounce}.`
            : "Board filters cleared."}
        </p>
        {canAllocate && viewMode === "detail" ? (
          <p
            className="text-sm text-[var(--muted)]"
            data-testid="board-keyboard-hint"
          >
            Keyboard: open{" "}
            <span className="font-medium text-[var(--ink)]">Details</span> on a
            card to <span className="font-medium text-[var(--ink)]">Move</span>{" "}
            allocations, or use{" "}
            <span className="font-medium text-[var(--ink)]">Allocate</span> on
            backlog items. Drag-and-drop is optional.
          </p>
        ) : null}

        {capabilities?.canAllocatePi === false && !readOnlyScenario ? (
          <div data-testid="board-allocate-permission">
            <Alert tone="info" live="polite">
              PI allocate permission is required to move or allocate work on
              this board. You can still inspect cards and capacity.
            </Alert>
          </div>
        ) : null}

        {error ? <Alert>{error}</Alert> : null}

        {viewMode === "overview" ? (
          <PiPlanningCalendar
            granularity={granularity}
            piStartDate={resolvedPiStart}
            piEndDate={resolvedPiEnd}
            iterations={calendarIterations}
            allocations={calendarAllocations}
            onSelectAllocation={focusAllocation}
          />
        ) : (
          <>
            <div className="pi-mobile">
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
                  Select an iteration and team, or add participation in
                  Settings.
                </p>
              )}
              <div className="pi-mobile-backlog">
                <BacklogPanel
                  piId={piId}
                  revisionId={revisionId}
                  items={backlog}
                  iterations={iterations}
                  teams={allTeams}
                  canAllocate={canAllocate}
                  capabilities={capabilities}
                  filters={filters}
                />
              </div>
            </div>

            <div className="pi-detail-layout">
              <div
                className="pi-matrix-scroll"
                role="region"
                aria-label="PI planning board matrix. Scroll horizontally to see all iterations."
                tabIndex={0}
              >
                {filteredDepartments.length === 0 ||
                iterations.length === 0 ? (
                  <div className="pi-empty" role="status">
                    {iterations.length === 0
                      ? "Define iterations in Settings before planning on the board."
                      : filteredDepartments.every((d) => d.teams.length === 0)
                        ? "Add participating teams in Settings to populate the board."
                        : "No departments match the current filters."}
                  </div>
                ) : (
                  <table className="pi-matrix">
                    <caption className="sr-only">
                      PI planning board by team and iteration. Use Details then
                      Move for keyboard allocation changes.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Team</th>
                        {iterations.map((it) => (
                          <th key={it.id} scope="col">
                            <span className="block">{it.name}</span>
                            <span className="pi-matrix-iter-key">
                              {it.referenceKey}
                              {it.startDate && it.endDate
                                ? ` · ${new Date(it.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}–${new Date(it.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}`
                                : ""}
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
                              className="pi-matrix-dept"
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
                              <tr key={team.teamId}>
                                <th scope="row">{team.teamName}</th>
                                {team.iterations.map((cell) => (
                                  <td
                                    key={`${team.teamId}-${cell.iteration.id}`}
                                    data-droppable={
                                      canAllocate ? "true" : "false"
                                    }
                                    onDragOver={(e) => {
                                      if (canAllocate) e.preventDefault();
                                    }}
                                    onDrop={(e) =>
                                      handleDrop(
                                        cell.iteration.id,
                                        team.teamId,
                                        e,
                                      )
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
                revisionId={revisionId}
                items={backlog}
                iterations={iterations}
                teams={allTeams}
                canAllocate={canAllocate}
                capabilities={capabilities}
                filters={filters}
              />
            </div>
          </>
        )}
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
  const capacityUnavailable = cell.capacity == null;

  return (
    <div className="pi-cell">
      <div className="pi-cell-flags">
        {cell.hasOverload || cell.utilizationBand === "overload" ? (
          <span className="pi-chip" data-tone="danger">
            Overload
          </span>
        ) : cell.utilizationBand === "near" ? (
          <span className="pi-chip" data-tone="warn">
            Near capacity
          </span>
        ) : cell.capacity ? (
          <span className="pi-chip" data-tone="ok">
            On track
          </span>
        ) : null}
        {cell.conflictCount > 0 ? (
          <span
            className="pi-chip"
            data-tone="warn"
            title={`${cell.conflictCount} conflict(s) touching this cell`}
          >
            {cell.conflictCount} conflict{cell.conflictCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <CapacityBar
        available={cell.capacity?.effectiveCapacityHours ?? 0}
        committed={cell.capacity?.plannedLoadHours ?? 0}
        unavailable={capacityUnavailable}
        showPercent={!capacityUnavailable}
        className="[&_p]:text-[10px] [&_div.text-xs]:text-[10px]"
      />
      {cell.cards.length === 0 ? (
        <p className="pi-cell-empty">
          {canAllocate
            ? "Empty — Allocate from backlog, or drop work here."
            : "No allocations in this cell."}
        </p>
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
                onDone={() => setExpandedId(null)}
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
      className="pi-mobile-panel"
      onDragOver={(e) => {
        if (canAllocate) e.preventDefault();
      }}
      onDrop={(e) => onDrop(cell.iteration.id, team.teamId, e)}
    >
      <h3 className="font-bold text-[var(--scania-blue-900,#001533)]">
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
