"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  /** Cell renderer — keep domain formatting outside when possible. */
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
};

export type DataTableSort = {
  columnId: string;
  direction: "asc" | "desc";
};

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Empty / loading / error are presentation only — no fetching. */
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  error?: string | null;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort) => void;
  pagination?: DataTablePagination;
  caption?: string;
  className?: string;
};

/**
 * Presentational data table. Callers own query contracts and server pagination.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  emptyTitle = "No rows",
  emptyDescription = "There is nothing to show yet.",
  loading = false,
  error = null,
  sort = null,
  onSortChange,
  pagination,
  caption,
  className,
}: DataTableProps<T>) {
  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          "rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        className={cn(
          "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]",
          className,
        )}
      >
        Loading…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-8 text-center",
          className,
        )}
      >
        <p className="font-medium text-[var(--color-text)]">{emptyTitle}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {emptyDescription}
        </p>
      </div>
    );
  }

  const pageCount = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left">
              {columns.map((col) => {
                const align =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left";
                const active = sort?.columnId === col.id;
                const nextDir =
                  active && sort?.direction === "asc" ? "desc" : "asc";
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={cn(
                      "px-[var(--table-cell-x)] py-[var(--table-cell-y)] font-semibold text-[var(--color-text)]",
                      align,
                      col.className,
                    )}
                    aria-sort={
                      active
                        ? sort!.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : col.sortable
                          ? "none"
                          : undefined
                    }
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-1 rounded-sm px-1 hover:text-[var(--color-primary)]"
                        aria-label={
                          active
                            ? `${col.header}, sorted ${
                                sort!.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                              }. Activate to sort ${
                                nextDir === "asc" ? "ascending" : "descending"
                              }.`
                            : `${col.header}, not sorted. Activate to sort ascending.`
                        }
                        onClick={() =>
                          onSortChange({
                            columnId: col.id,
                            direction: nextDir,
                          })
                        }
                      >
                        {col.header}
                        <span aria-hidden="true" className="text-xs">
                          {active
                            ? sort!.direction === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowId(row)}
                className="border-b border-[var(--color-border)] last:border-b-0"
              >
                {columns.map((col) => {
                  const align =
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left";
                  return (
                    <td
                      key={col.id}
                      className={cn(
                        "px-[var(--table-cell-x)] py-[var(--table-cell-y)] text-[var(--color-text)]",
                        align,
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-text-secondary)]">
          <span>
            Page {pagination.page} of {pageCount} · {pagination.total} rows
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pageCount}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
