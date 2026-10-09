/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AllocateWorkForm,
  MoveWorkForm,
} from "@/components/pi-planning/move-work-form";

const moveAllocationAction = vi.fn();
const allocateWorkAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/pi-planning", () => ({
  moveAllocationAction: (...args: unknown[]) => moveAllocationAction(...args),
  allocateWorkAction: (...args: unknown[]) => allocateWorkAction(...args),
}));

const iterations = [
  { id: "it-1", name: "Iter 1", sequence: 1 },
  { id: "it-2", name: "Iter 2", sequence: 2 },
];
const teams = [
  {
    id: "team-1",
    name: "Alpha",
    departmentId: "d1",
    departmentName: "Eng",
  },
];

describe("M4D-A allocation form UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates move targets and supports cancel without submitting", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(
      <MoveWorkForm
        piId="pi-1"
        allocationId="alloc-1"
        expectedVersion={3}
        iterations={iterations}
        teams={teams}
        defaultIterationId="it-1"
        defaultTeamId="team-1"
        capabilities={{ canAllocatePi: true }}
        onDone={onDone}
      />,
    );

    expect(
      screen.getByRole("form", { name: "Move allocation" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Target iteration")).toBeInTheDocument();
    expect(screen.getByLabelText("Target team")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(moveAllocationAction).not.toHaveBeenCalled();
  });

  it("prevents duplicate move submission while pending and calls action once", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: { ok: true; data: null }) => void = () => {};
    moveAllocationAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(
      <MoveWorkForm
        piId="pi-1"
        allocationId="alloc-1"
        expectedVersion={3}
        iterations={iterations}
        teams={teams}
        defaultIterationId="it-1"
        defaultTeamId="team-1"
        capabilities={{ canAllocatePi: true }}
      />,
    );

    const save = screen.getByRole("button", { name: "Save move" });
    await user.click(save);
    expect(save).toBeDisabled();
    await user.click(save);
    expect(moveAllocationAction).toHaveBeenCalledTimes(1);
    resolveAction({ ok: true, data: null });
  });

  it("shows allocate labels, estimate hint, and read-only when unauthorized", () => {
    render(
      <AllocateWorkForm
        piId="pi-1"
        revisionId="rev-draft"
        workItemId="wi-1"
        iterations={iterations}
        teams={teams}
        estimateHours="12"
        capabilities={{ canAllocatePi: false }}
      />,
    );

    expect(
      screen.getByRole("form", { name: "Allocate work item" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/estimate 12h/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Iteration")).toBeDisabled();
    expect(screen.getByLabelText("Team")).toBeDisabled();
    expect(screen.getByLabelText("Planned hours")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save allocation" }),
    ).toBeDisabled();
  });

  it("rejects negative planned hours before calling the server action", async () => {
    render(
      <AllocateWorkForm
        piId="pi-1"
        workItemId="wi-1"
        iterations={iterations}
        teams={teams}
        capabilities={{ canAllocatePi: true }}
      />,
    );

    const hours = screen.getByLabelText("Planned hours");
    // Bypass native min=0 UI constraints to exercise app-level validation.
    fireEvent.change(hours, { target: { value: "-4" } });
    fireEvent.submit(screen.getByRole("form", { name: "Allocate work item" }));

    expect(
      await screen.findByText(
        /Planned hours must be zero or a positive number/i,
      ),
    ).toBeInTheDocument();
    expect(allocateWorkAction).not.toHaveBeenCalled();
  });

  it("shows empty guidance when iterations or teams are missing", () => {
    render(
      <AllocateWorkForm
        piId="pi-1"
        workItemId="wi-1"
        iterations={[]}
        teams={teams}
        capabilities={{ canAllocatePi: true }}
      />,
    );
    expect(
      screen.getByText(/Add iterations and participating teams/i),
    ).toBeInTheDocument();
  });
});
