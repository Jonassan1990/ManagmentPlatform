"use client";

import { useMemo, useState } from "react";
import { fieldClassName } from "@/components/ui/forms";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import { AllocateWorkForm } from "./move-work-form";
import { BacklogCard, type BacklogItemData } from "./work-card";

type Caps = Partial<PrincipalCapabilities>;

export type BoardFilterState = {
  departmentId: string;
  projectId: string;
  initiativeId: string;
  type: string;
  priority: string;
};

export function BacklogPanel({
  piId,
  revisionId,
  items,
  iterations,
  teams,
  canAllocate,
  capabilities,
  filters,
}: {
  piId: string;
  revisionId?: string;
  items: BacklogItemData[];
  iterations: { id: string; name: string; sequence: number }[];
  teams: {
    id: string;
    name: string;
    departmentId: string;
    departmentName: string;
  }[];
  canAllocate: boolean;
  capabilities?: Caps;
  filters: BoardFilterState;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filters.projectId && item.project.id !== filters.projectId) return false;
      if (
        filters.initiativeId &&
        item.project.initiative?.id !== filters.initiativeId
      )
        return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.priority && item.priority !== filters.priority) return false;
      return true;
    });
  }, [items, filters]);

  return (
    <aside className="pi-backlog">
      <div className="pi-backlog-head">
        <h2>
          Unallocated backlog
          <span className="pi-backlog-count">{filtered.length}</span>
        </h2>
        <p>
          {filtered.length} item{filtered.length === 1 ? "" : "s"}
          {canAllocate ? " · drag onto a cell or use Allocate" : ""}
        </p>
      </div>
      <div className="pi-backlog-list">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No unallocated work matches the current filters.
          </p>
        ) : (
          filtered.map((item) => (
            <div key={item.id}>
              <BacklogCard
                item={item}
                draggable={canAllocate}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-pi-backlog",
                    JSON.stringify({ workItemId: item.id }),
                  );
                  e.dataTransfer.effectAllowed = "copyMove";
                }}
                allocateSlot={
                  canAllocate ? (
                    <button
                      type="button"
                      className="text-[11px] font-bold text-[var(--accent)]"
                      onClick={() =>
                        setOpenId((id) => (id === item.id ? null : item.id))
                      }
                    >
                      {openId === item.id ? "Hide allocate" : "Allocate…"}
                    </button>
                  ) : null
                }
              />
              {openId === item.id && canAllocate ? (
                <div className="mt-2 rounded-[4px] border border-[var(--line)] bg-white p-2">
                  <AllocateWorkForm
                    piId={piId}
                    revisionId={revisionId}
                    workItemId={item.id}
                    iterations={iterations}
                    teams={teams}
                    estimateHours={
                      item.estimateHours != null
                        ? String(item.estimateHours)
                        : null
                    }
                    capabilities={capabilities}
                    onDone={() => setOpenId(null)}
                  />
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export function BoardFilters({
  departments,
  projects,
  initiatives,
  types,
  priorities,
  value,
  onChange,
}: {
  departments: { id: string; name: string }[];
  projects: { id: string; referenceKey: string; name: string }[];
  initiatives: { id: string; referenceKey: string; name: string }[];
  types: string[];
  priorities: string[];
  value: BoardFilterState;
  onChange: (next: BoardFilterState) => void;
}) {
  const hasActive =
    Boolean(value.departmentId) ||
    Boolean(value.initiativeId) ||
    Boolean(value.projectId) ||
    Boolean(value.type) ||
    Boolean(value.priority);

  return (
    <div
      className="pi-filters"
      data-testid="pi-board-filters"
      aria-label="Plan filters"
    >
      <select
        aria-label="Filter by department"
        className={`${fieldClassName} w-auto min-w-[10rem]`}
        value={value.departmentId}
        onChange={(e) => onChange({ ...value, departmentId: e.target.value })}
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by initiative"
        className={`${fieldClassName} w-auto min-w-[10rem]`}
        value={value.initiativeId}
        onChange={(e) =>
          onChange({ ...value, initiativeId: e.target.value, projectId: "" })
        }
      >
        <option value="">All initiatives</option>
        {initiatives.map((i) => (
          <option key={i.id} value={i.id}>
            {i.referenceKey} · {i.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by project"
        className={`${fieldClassName} w-auto min-w-[10rem]`}
        value={value.projectId}
        onChange={(e) => onChange({ ...value, projectId: e.target.value })}
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.referenceKey}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by type"
        className={`${fieldClassName} w-auto min-w-[8rem]`}
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value })}
      >
        <option value="">All types</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by priority"
        className={`${fieldClassName} w-auto min-w-[8rem]`}
        value={value.priority}
        onChange={(e) => onChange({ ...value, priority: e.target.value })}
      >
        <option value="">All priorities</option>
        {priorities.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {hasActive ? (
        <button
          type="button"
          className="pi-filter-clear"
          onClick={() =>
            onChange({
              departmentId: "",
              projectId: "",
              initiativeId: "",
              type: "",
              priority: "",
            })
          }
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
