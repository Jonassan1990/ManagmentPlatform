/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  PiPlanningWorkflowBar,
  PiWorkflowPrimaryActionCard,
} from "@/components/pi-planning/pi-planning-workflow";
import {
  ReviewJourneyNav,
  ReviewStageSection,
} from "@/components/pi-planning/review-stage-section";
import { derivePiPlanningWorkflow } from "@/modules/pi-planning/application/pi-planning-workflow";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("M4D-B Review stage disclosure", () => {
  it("keeps secondary stage collapsed until expanded", async () => {
    const user = userEvent.setup();
    render(
      <ReviewStageSection
        title="Supporting details"
        description="Checklist"
        status="available"
        defaultOpen={false}
      >
        <p>Hidden checklist body</p>
      </ReviewStageSection>,
    );

    expect(screen.queryByText("Hidden checklist body")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Supporting details/i }));
    expect(screen.getByText("Hidden checklist body")).toBeInTheDocument();
  });

  it("renders workflow bar stages and next action", () => {
    const workflow = derivePiPlanningWorkflow({
      piId: "pi-1",
      hasSelection: true,
      approvalState: "NO_PROMOTION",
      canPromote: true,
      promoteDisabledReasons: [],
      canApprove: false,
      approveDisabledReasons: [],
      canBaseline: false,
      baselineDisabledReasons: [],
      canReviewPi: true,
      canBaselinePi: true,
      selectedLabel: "Path B",
    });

    render(
      <>
        <PiPlanningWorkflowBar workflow={workflow} />
        <PiWorkflowPrimaryActionCard workflow={workflow} />
      </>,
    );

    expect(
      screen.getByRole("navigation", { name: "PI planning workflow" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Selected ≠ Applied to current plan/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Next planning action" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Apply selected scenario to current plan/i),
    ).toBeInTheDocument();
  });

  it("preserves journey nav links with context hrefs", () => {
    render(
      <ReviewJourneyNav
        boardHref="/pi/p1/board?from=portfolio"
        compareHref="/pi/p1/compare?from=portfolio"
        reviewHref="/pi/p1/review?from=portfolio"
        baselineHref="/pi/p1/baseline?from=portfolio"
      />,
    );
    expect(screen.getByRole("link", { name: "← Board" })).toHaveAttribute(
      "href",
      "/pi/p1/board?from=portfolio",
    );
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute(
      "href",
      "/pi/p1/compare?from=portfolio",
    );
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
