/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkCard } from "@/components/pi-planning/work-card";

const card = {
  allocationId: "a1",
  version: 1,
  plannedHours: "8",
  hasDependencyConflict: true,
  workItem: {
    id: "w1",
    referenceKey: "WI-1",
    title: "Build API",
    type: "STORY",
    status: "READY",
    priority: "HIGH",
    estimateHours: "8",
    project: {
      id: "p1",
      referenceKey: "PRJ-1",
      name: "Platform",
    },
  },
};

describe("WorkCard keyboard affordances", () => {
  it("exposes Details/Move control with expanded semantics and conflict text", async () => {
    const onToggle = vi.fn();
    render(
      <WorkCard
        card={card}
        expanded={false}
        onToggleExpand={onToggle}
        moveSlot={<p>Move form</p>}
      />,
    );

    expect(screen.getByText(/Dependency timing conflict/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", {
      name: /Show details and move options for WI-1/i,
    });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
  });
});
