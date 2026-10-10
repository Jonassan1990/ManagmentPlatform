/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/ui/data-table";

const columns = [
  {
    id: "name",
    header: "Name",
    sortable: true,
    cell: (row: { id: string; name: string }) => row.name,
  },
];

describe("DataTable accessibility", () => {
  it("exposes sort state in column header button aria-label", async () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[{ id: "1", name: "Alpha" }]}
        getRowId={(r) => r.id}
        sort={{ columnId: "name", direction: "asc" }}
        onSortChange={onSortChange}
        caption="Items"
      />,
    );
    const sortBtn = screen.getByRole("button", { name: /Name, sorted ascending/i });
    expect(sortBtn).toBeInTheDocument();
    await userEvent.click(sortBtn);
    expect(onSortChange).toHaveBeenCalledWith({
      columnId: "name",
      direction: "desc",
    });
  });
});
