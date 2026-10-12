"use client";

import { humanize } from "@/components/governance/governance-panels";
import { buttonClassName } from "@/components/ui/button";
import { formatHours } from "./pi-nav";

export type InitiativeRef = {
  id: string;
  referenceKey: string;
  name: string;
};

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
      initiative?: InitiativeRef | null;
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
    initiative?: InitiativeRef | null;
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
  const initiative = card.workItem.project.initiative;

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      className="pi-card"
      data-priority={card.workItem.priority}
      data-overloaded={overloaded ? "true" : "false"}
      data-draggable={draggable ? "true" : "false"}
    >
      <div className="pi-card-top">
        <div className="min-w-0">
          <p className="pi-card-key" title={card.workItem.title}>
            {card.workItem.referenceKey}
          </p>
          <p className="pi-card-project">
            {card.workItem.project.referenceKey}
            {initiative ? ` · ${initiative.referenceKey}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {card.hasDependencyConflict ? (
            <span
              className="pi-chip"
              data-tone="warn"
              title="Dependency timing conflict"
            >
              <span aria-hidden="true">Dep</span>
              <span className="sr-only">Dependency timing conflict</span>
            </span>
          ) : null}
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {humanize(card.workItem.priority)}
          </span>
        </div>
      </div>
      <p className="pi-card-title">{card.workItem.title}</p>
      <div className="pi-card-meta">
        <span>{humanize(card.workItem.type)}</span>
        <span>
          {formatHours(card.plannedHours || card.workItem.estimateHours)}
        </span>
        <span>{humanize(card.workItem.status)}</span>
      </div>
      {onToggleExpand ? (
        <div className="pi-card-actions">
          <button
            type="button"
            className={buttonClassName({
              variant: "ghost",
              size: "sm",
              className: "px-0",
            })}
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Hide details for ${card.workItem.referenceKey}`
                : `Show details and move options for ${card.workItem.referenceKey}`
            }
          >
            {expanded ? "Hide details" : "Details / Move"}
          </button>
        </div>
      ) : null}
      {expanded ? (
        <div className="pi-card-details space-y-2">
          <p className="text-xs text-[var(--muted)]">
            Project: {card.workItem.project.name}
            {initiative ? ` · Initiative: ${initiative.name}` : ""} · Status:{" "}
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
  const initiative = item.project.initiative;

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      className="pi-card pi-card-dashed"
      data-priority={item.priority}
      data-draggable={draggable ? "true" : "false"}
    >
      <p className="pi-card-key">{item.referenceKey}</p>
      <p className="pi-card-project">
        {item.project.referenceKey}
        {initiative ? ` · ${initiative.referenceKey}` : ""} ·{" "}
        {humanize(item.priority)}
      </p>
      <p className="pi-card-title">{item.title}</p>
      <div className="pi-card-meta">
        <span>{humanize(item.type)}</span>
        <span>{formatHours(item.estimateHours?.toString() ?? null)}</span>
      </div>
      {allocateSlot ? <div className="pi-card-actions">{allocateSlot}</div> : null}
    </article>
  );
}
