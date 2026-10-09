/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanningBoard } from "@/components/pi-planning/planning-board";

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
      />,
    );

    expect(
      screen.getByText(/Define iterations in Settings/i),
    ).toBeInTheDocument();
  });

  it("shows conflict chip and CapacityBar for a populated cell", () => {
    render(
      <PlanningBoard
        piId="pi-1"
        revisionId="rev-1"
        iterations={[
          {
            id: "it-1",
            name: "Sprint 1",
            sequence: 1,
            referenceKey: "IT-1",
          },
        ]}
        backlog={[]}
        capabilities={{ canAllocatePi: true }}
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
                    iteration: {
                      id: "it-1",
                      name: "Sprint 1",
                      sequence: 1,
                      referenceKey: "IT-1",
                    },
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
      screen.getAllByText(/Empty — drop work here/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not show allocate drag affordances when read-only scenario", () => {
    render(
      <PlanningBoard
        piId="pi-1"
        revisionId="rev-selected"
        readOnlyScenario
        iterations={[
          {
            id: "it-1",
            name: "Sprint 1",
            sequence: 1,
            referenceKey: "IT-1",
          },
        ]}
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
                    iteration: {
                      id: "it-1",
                      name: "Sprint 1",
                      sequence: 1,
                      referenceKey: "IT-1",
                    },
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
});
