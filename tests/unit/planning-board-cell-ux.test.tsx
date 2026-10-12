/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningBoard } from "@/components/pi-planning/planning-board";
import { buildCalendarBuckets } from "@/components/pi-planning/pi-planning-calendar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/pi-planning", () => ({
  allocateWorkAction: vi.fn(),
  moveAllocationAction: vi.fn(),
}));

const PI_START = "2026-01-05T00:00:00.000Z";
const PI_END = "2026-03-27T00:00:00.000Z";

function baseIteration(overrides: Partial<{
  id: string;
  name: string;
  sequence: number;
  referenceKey: string;
  startDate: string;
  endDate: string;
}> = {}) {
  return {
    id: "it-1",
    name: "Sprint 1",
    sequence: 1,
    referenceKey: "IT-1",
    startDate: "2026-01-05T00:00:00.000Z",
    endDate: "2026-01-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("M4D-A PlanningBoard cell presentation", () => {
  it("renders empty board guidance and CapacityBar unavailable when no capacity", () => {
    render(
      <PlanningBoard
        piId="pi-1"
        revisionId="rev-1"
        departments={[]}
        iterations={[]}
        backlog={[]}
        capabilities={{ canAllocatePi: true }}
        initialViewMode="detail"
      />,
    );

    expect(
      screen.getByText(/Define iterations in Settings/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("board-keyboard-hint")).toHaveTextContent(
      /Details/i,
    );
    expect(screen.getByTestId("board-keyboard-hint")).toHaveTextContent(
      /Move/i,
    );
  });

  it("shows conflict chip and CapacityBar for a populated cell", () => {
    render(
      <PlanningBoard
        piId="pi-1"
        revisionId="rev-1"
        iterations={[baseIteration()]}
        backlog={[]}
        capabilities={{ canAllocatePi: true }}
        initialViewMode="detail"
        departments={[
          {
            departmentId: "d1",
            departmentName: "Engineering",
            teams: [
              {
                teamId: "t1",
                teamName: "Alpha",
                departmentId: "d1",
                iterations: [
                  {
                    iteration: baseIteration(),
                    utilizationBand: "overload",
                    hasOverload: true,
                    conflictCount: 2,
                    capacity: {
                      effectiveCapacityHours: 40,
                      plannedLoadHours: 55,
                      utilization: 55 / 40,
                      band: "overload",
                    },
                    cards: [],
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Overload").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 conflicts/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/overload/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Empty — Allocate from backlog/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not show allocate drag affordances when read-only scenario", () => {
    render(
      <PlanningBoard
        piId="pi-1"
        revisionId="rev-selected"
        readOnlyScenario
        iterations={[baseIteration()]}
        backlog={[
          {
            id: "wi-1",
            referenceKey: "WI-1",
            title: "Story",
            type: "STORY",
            status: "READY",
            priority: "MED",
            estimateHours: "8",
            project: {
              id: "p1",
              referenceKey: "PRJ-1",
              name: "Project",
            },
          },
        ]}
        capabilities={{ canAllocatePi: true }}
        initialViewMode="detail"
        departments={[
          {
            departmentId: "d1",
            departmentName: "Engineering",
            teams: [
              {
                teamId: "t1",
                teamName: "Alpha",
                departmentId: "d1",
                iterations: [
                  {
                    iteration: baseIteration(),
                    utilizationBand: "ok",
                    hasOverload: false,
                    conflictCount: 0,
                    capacity: {
                      effectiveCapacityHours: 40,
                      plannedLoadHours: 10,
                      utilization: 0.25,
                      band: "ok",
                    },
                    cards: [],
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.queryByText(/drag onto a cell/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Allocate…/)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/No allocations in this cell/i).length,
    ).toBeGreaterThan(0);
  });

  it("explains missing PI allocate permission near the board (M4F-D)", () => {
    render(
      <PlanningBoard
        piId="pi-1"
        revisionId="rev-1"
        departments={[]}
        iterations={[baseIteration()]}
        backlog={[]}
        capabilities={{ canAllocatePi: false }}
        initialViewMode="detail"
      />,
    );

    expect(screen.getByTestId("board-allocate-permission")).toHaveTextContent(
      /PI allocate permission is required/i,
    );
    expect(screen.queryByTestId("board-keyboard-hint")).not.toBeInTheDocument();
  });
});

describe("PI planning overview + filters", () => {
  const departments = [
    {
      departmentId: "d1",
      departmentName: "Engineering",
      teams: [
        {
          teamId: "t1",
          teamName: "Alpha",
          departmentId: "d1",
          iterations: [
            {
              iteration: baseIteration(),
              utilizationBand: "ok",
              hasOverload: false,
              conflictCount: 0,
              capacity: {
                effectiveCapacityHours: 40,
                plannedLoadHours: 8,
                utilization: 0.2,
                band: "ok",
              },
              cards: [
                {
                  allocationId: "alloc-1",
                  version: 1,
                  plannedHours: "8",
                  workItem: {
                    id: "wi-1",
                    referenceKey: "WI-1",
                    title: "Alpha story",
                    type: "STORY",
                    status: "IN_PROGRESS",
                    priority: "HIGH",
                    estimateHours: "8",
                    project: {
                      id: "p1",
                      referenceKey: "PRJ-1",
                      name: "Project One",
                      initiative: {
                        id: "init-1",
                        referenceKey: "INI-1",
                        name: "Initiative One",
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      departmentId: "d2",
      departmentName: "Operations",
      teams: [
        {
          teamId: "t2",
          teamName: "Ops",
          departmentId: "d2",
          iterations: [
            {
              iteration: baseIteration(),
              utilizationBand: "ok",
              hasOverload: false,
              conflictCount: 0,
              capacity: {
                effectiveCapacityHours: 40,
                plannedLoadHours: 5,
                utilization: 0.125,
                band: "ok",
              },
              cards: [
                {
                  allocationId: "alloc-2",
                  version: 1,
                  plannedHours: "5",
                  workItem: {
                    id: "wi-2",
                    referenceKey: "WI-2",
                    title: "Ops story",
                    type: "STORY",
                    status: "READY",
                    priority: "MED",
                    estimateHours: "5",
                    project: {
                      id: "p2",
                      referenceKey: "PRJ-2",
                      name: "Project Two",
                      initiative: {
                        id: "init-2",
                        referenceKey: "INI-2",
                        name: "Initiative Two",
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  it("defaults to week calendar overview and switches to detail board", async () => {
    const user = userEvent.setup();
    render(
      <PlanningBoard
        piId="pi-1"
        revisionId="rev-1"
        iterations={[baseIteration()]}
        backlog={[]}
        capabilities={{ canAllocatePi: true }}
        piStartDate={PI_START}
        piEndDate={PI_END}
        departments={departments}
      />,
    );

    expect(screen.getByTestId("pi-planning-calendar")).toHaveAttribute(
      "data-granularity",
      "week",
    );
    expect(screen.getByTestId("pi-calendar-item-alloc-1")).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by initiative/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by project/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByTestId("pi-planning-calendar")).toHaveAttribute(
      "data-granularity",
      "month",
    );

    await user.click(screen.getByRole("tab", { name: "Detail" }));
    expect(screen.getByTestId("board-keyboard-hint")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByTestId("pi-planning-calendar")).not.toBeInTheDocument();
  });

  it("filters overview by department, initiative, and project", async () => {
    const user = userEvent.setup();
    render(
      <PlanningBoard
        piId="pi-1"
        revisionId="rev-1"
        iterations={[baseIteration()]}
        backlog={[]}
        capabilities={{ canAllocatePi: true }}
        piStartDate={PI_START}
        piEndDate={PI_END}
        departments={departments}
      />,
    );

    expect(screen.getByTestId("pi-calendar-item-alloc-1")).toBeInTheDocument();
    expect(screen.getByTestId("pi-calendar-item-alloc-2")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/Filter by department/i),
      "d1",
    );
    expect(screen.getByTestId("pi-calendar-item-alloc-1")).toBeInTheDocument();
    expect(
      screen.queryByTestId("pi-calendar-item-alloc-2"),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/Filter by department/i),
      "",
    );
    await user.selectOptions(
      screen.getByLabelText(/Filter by initiative/i),
      "init-2",
    );
    expect(
      screen.queryByTestId("pi-calendar-item-alloc-1"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("pi-calendar-item-alloc-2")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/Filter by initiative/i),
      "",
    );
    await user.selectOptions(screen.getByLabelText(/Filter by project/i), "p1");
    expect(screen.getByTestId("pi-calendar-item-alloc-1")).toBeInTheDocument();
    expect(
      screen.queryByTestId("pi-calendar-item-alloc-2"),
    ).not.toBeInTheDocument();
  });

  it("buildCalendarBuckets covers PI weeks and months", () => {
    const weeks = buildCalendarBuckets(PI_START, PI_END, "week");
    const months = buildCalendarBuckets(PI_START, PI_END, "month");
    expect(weeks.length).toBeGreaterThan(8);
    expect(weeks[0]?.label).toMatch(/^W1$/);
    expect(months.length).toBe(3);
    expect(months[0]?.label).toMatch(/January/i);
  });
});
