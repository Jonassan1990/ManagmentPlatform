"use client";

import { humanize } from "@/components/governance/governance-panels";
import { formatHours } from "./pi-nav";

export type WorkCardData = {
  allocationId: string;
  version: number;
  plannedHours: string;
  hasDependencyConflict?: boolean;
  workItem: {
    id: string;
    referenceKey: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    estimateHours: string | null;
    project: {
      id: string;
      referenceKey: string;
      name: string;
    };
  };
};

export type BacklogItemData = {
  id: string;
  referenceKey: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  estimateHours: string | number | null;
  project: {
    id: string;
    referenceKey: string;
    name: string;
  };
};

export function WorkCard({
  card,
  draggable,
  onDragStart,
  expanded,
  onToggleExpand,
  moveSlot,
  overloaded,
}: {
  card: WorkCardData;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  moveSlot?: React.ReactNode;
  overloaded?: boolean;
}) {
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      className={`rounded-md border px-2.5 py-2 text-left text-sm ${
        overloaded
          ? "border-[var(--danger)]/40 bg-[var(--danger)]/5"
          : "border-[var(--line)] bg-white"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium" title={card.workItem.title}>
            {card.workItem.referenceKey}
          </p>
          <p className="truncate text-xs text-[var(--muted)]">
            {card.workItem.project.referenceKey}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {card.hasDependencyConflict ? (
            <span
              className="text-[10px] font-medium uppercase tracking-wide text-[var(--warning)]"
              title="Dependency timing conflict"
            >
              Dep
            </span>
          ) : null}
          <span className="text-[10px] text-[var(--muted)]">
            {humanize(card.workItem.priority)}
          </span>
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-xs">{card.workItem.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
        <span>{humanize(card.workItem.type)}</span>
        <span>{formatHours(card.plannedHours || card.workItem.estimateHours)}</span>
      </div>
      {onToggleExpand ? (
        <button
          type="button"
          className="mt-2 text-[11px] text-[var(--accent)]"
          onClick={onToggleExpand}
        >
          {expanded ? "Hide details" : "Details"}
        </button>
      ) : null}
      {expanded ? (
        <div className="mt-2 space-y-2 border-t border-[var(--line)] pt-2">
          <p className="text-xs text-[var(--muted)]">
            Project: {card.workItem.project.name} · Status:{" "}
            {humanize(card.workItem.status)}
          </p>
          {moveSlot}
        </div>
      ) : null}
    </article>
  );
}

export function BacklogCard({
  item,
  draggable,
  onDragStart,
  allocateSlot,
}: {
  item: BacklogItemData;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  allocateSlot?: React.ReactNode;
}) {
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      className={`rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-sm ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <p className="font-medium">{item.referenceKey}</p>
      <p className="truncate text-xs text-[var(--muted)]">
        {item.project.referenceKey} · {humanize(item.priority)}
      </p>
      <p className="mt-1 line-clamp-2 text-xs">{item.title}</p>
      <div className="mt-1 text-[11px] text-[var(--muted)]">
        {humanize(item.type)} · {formatHours(item.estimateHours?.toString() ?? null)}
      </div>
      {allocateSlot ? <div className="mt-2">{allocateSlot}</div> : null}
    </article>
  );
}
