"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  CapacityBar,
  ConfirmDialog,
  DataTable,
  Dialog,
  StatusBadge,
  type DataTableColumn,
  type DataTableSort,
  type StatusBadgeVariant,
} from "@/components/ui";
import { Panel } from "@/components/ui/page";

const STATUS_VARIANTS: StatusBadgeVariant[] = [
  "draft",
  "in-progress",
  "pending",
  "approved",
  "completed",
  "cancelled",
  "blocked",
  "at-risk",
  "unavailable",
  "archived",
];

type DemoRow = { id: string; name: string; hours: number };

const DEMO_ROWS: DemoRow[] = [
  { id: "1", name: "Alpha initiative", hours: 40 },
  { id: "2", name: "Beta delivery", hours: 24 },
  { id: "3", name: "Gamma platform", hours: 16 },
];

export function UiShowcaseClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [failNext, setFailNext] = useState(true);
  const [tableMode, setTableMode] = useState<
    "data" | "empty" | "loading" | "error"
  >("data");
  const [sort, setSort] = useState<DataTableSort | null>({
    columnId: "name",
    direction: "asc",
  });
  const [page, setPage] = useState(1);

  const columns = useMemo<DataTableColumn<DemoRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        cell: (row) => row.name,
      },
      {
        id: "hours",
        header: "Hours",
        sortable: true,
        align: "right",
        cell: (row) => `${row.hours}h`,
      },
    ],
    [],
  );

  const sortedRows = useMemo(() => {
    const rows = [...DEMO_ROWS];
    if (!sort) return rows;
    rows.sort((a, b) => {
      const av = sort.columnId === "hours" ? a.hours : a.name;
      const bv = sort.columnId === "hours" ? b.hours : b.name;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [sort]);

  return (
    <div className="space-y-8">
      <Panel>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Button
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Dialog & ConfirmDialog
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDialogOpen(true)}
          >
            Open dialog
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setConfirmError(null);
              setConfirmPending(false);
              setConfirmOpen(true);
            }}
          >
            Open confirm
          </Button>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={failNext}
              onChange={(e) => setFailNext(e.target.checked)}
            />
            Simulate confirm failure
          </label>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Sample dialog"
          description="Focus is trapped; Escape closes; focus returns to the trigger."
          footer={
            <Button type="button" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          }
        >
          <p className="text-sm text-[var(--color-text)]">
            Demonstration content for the design-system Dialog primitive.
          </p>
        </Dialog>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Confirm demonstration action"
          description="Failed actions must show an error and stay open."
          confirmLabel="Confirm action"
          variant="destructive"
          pending={confirmPending}
          error={confirmError}
          onConfirm={async () => {
            setConfirmPending(true);
            setConfirmError(null);
            await new Promise((r) => setTimeout(r, 400));
            setConfirmPending(false);
            if (failNext) {
              setConfirmError(
                "Demonstration failure: the action was rejected. Dialog stays open.",
              );
              return;
            }
            setConfirmOpen(false);
          }}
        />
      </Panel>

      <Panel>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          StatusBadge
        </h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_VARIANTS.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_VARIANTS.map((status) => (
            <StatusBadge key={`${status}-c`} status={status} size="compact" />
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          DataTable
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ["data", "Table: rows"],
              ["empty", "Table: empty"],
              ["loading", "Table: loading"],
              ["error", "Table: error"],
            ] as const
          ).map(([mode, label]) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={tableMode === mode ? "primary" : "secondary"}
              onClick={() => setTableMode(mode)}
            >
              {label}
            </Button>
          ))}
        </div>
        <DataTable
          columns={columns}
          rows={tableMode === "data" ? sortedRows : []}
          getRowId={(row) => row.id}
          loading={tableMode === "loading"}
          error={
            tableMode === "error" ? "Demonstration load failure." : null
          }
          emptyTitle="No demonstration rows"
          emptyDescription="Empty-state presentation for query results."
          sort={sort}
          onSortChange={setSort}
          pagination={
            tableMode === "data"
              ? {
                  page,
                  pageSize: 10,
                  total: DEMO_ROWS.length,
                  onPageChange: setPage,
                }
              : undefined
          }
          caption="Demonstration initiatives"
        />
      </Panel>

      <Panel>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          CapacityBar
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              Healthy
            </p>
            <CapacityBar available={100} committed={55} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              High utilization
            </p>
            <CapacityBar available={80} committed={72} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              Overload
            </p>
            <CapacityBar available={40} committed={58} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              Zero available
            </p>
            <CapacityBar available={0} committed={0} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              Unavailable
            </p>
            <CapacityBar available={0} committed={0} unavailable />
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Alert / InlineFeedback
        </h2>
        <div className="space-y-3">
          <Alert tone="info" title="Information">
            Demo info message for portfolio managers.
          </Alert>
          <Alert tone="success">Scenario comparison completed successfully.</Alert>
          <Alert tone="warning" action={{ href: "/portfolio", label: "Open portfolio" }}>
            Capacity is approaching the soft limit for this PI.
          </Alert>
          <Alert tone="error" dismissible>
            Demonstration error with dismiss control.
          </Alert>
        </div>
      </Panel>
    </div>
  );
}
