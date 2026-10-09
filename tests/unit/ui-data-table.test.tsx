/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "@/components/ui/data-table";

const columns = [
  {
    id: "name",
    header: "Name",
    cell: (row: { id: string; name: string }) => row.name,
  },
];

describe("DataTable", () => {
  it("renders empty state", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        emptyTitle="No initiatives"
        emptyDescription="Create one to begin."
      />,
    );
    expect(screen.getByText("No initiatives")).toBeInTheDocument();
    expect(screen.getByText("Create one to begin.")).toBeInTheDocument();
  });

  it("renders loading state with status", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        loading
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("renders error state as alert", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        error="Failed to load"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");
  });

  it("renders accessible column headers for rows", () => {
    render(
      <DataTable
        columns={columns}
        rows={[{ id: "1", name: "Alpha" }]}
        getRowId={(r) => r.id}
        caption="Initiatives"
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Initiatives")).toBeInTheDocument();
  });
});
