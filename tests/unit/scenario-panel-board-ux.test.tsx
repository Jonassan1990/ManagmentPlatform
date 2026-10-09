/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ScenarioModeBanner,
  ScenarioPanel,
  type ScenarioListItem,
} from "@/components/pi-planning/scenario-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/pi-planning", () => ({
  archiveScenarioAction: vi.fn(),
  cloneScenarioAction: vi.fn(),
  createScenarioFromCurrentAction: vi.fn(),
  markScenarioReadyAction: vi.fn(),
  renameScenarioAction: vi.fn(),
  reopenScenarioAction: vi.fn(),
}));

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

const scenarios: ScenarioListItem[] = [
  {
    id: "rev-current",
    key: "CURRENT",
    label: "Current plan",
    isCurrent: true,
    status: "ACTIVE_PLAN",
    version: 1,
    kind: "CURRENT",
  },
  {
    id: "rev-draft",
    key: "SCN-1",
    label: "Alt staffing",
    isCurrent: false,
    status: "DRAFT",
    version: 2,
    kind: "SCENARIO",
  },
  {
    id: "rev-selected",
    key: "SCN-2",
    label: "Selected path",
    isCurrent: false,
    status: "SELECTED",
    version: 1,
    kind: "SCENARIO",
  },
];

describe("M4D-A ScenarioPanel board UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows planning context, capacity summary, and scenario chips with StatusBadge", () => {
    render(
      <ScenarioPanel
        piId="pi-1"
        piStatus="PLANNING"
        activeRevisionId="rev-current"
        activeRevision={{
          id: "rev-current",
          key: "CURRENT",
          label: "Current plan",
          isCurrent: true,
          status: "ACTIVE_PLAN",
        }}
        scenarios={scenarios}
        capacitySummary={{
          availableHours: 100,
          committedHours: 40,
          overloadSlots: 0,
          blockerConflictCount: 0,
          teamSlotCount: 4,
        }}
        capabilities={{ canAllocatePi: true }}
      />,
    );

    const context = screen.getByRole("region", { name: "Planning context" });
    expect(context).toBeInTheDocument();
    expect(
      within(context).getAllByText("CURRENT plan").length,
    ).toBeGreaterThan(0);
    expect(within(context).getByText(/PI · Planning/i)).toBeInTheDocument();
    expect(
      within(context).getByRole("img", { name: /Available 100h/i }),
    ).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Scenario list" });
    expect(within(list).getByText("CURRENT")).toBeInTheDocument();
    expect(within(list).getByText("Alt staffing")).toBeInTheDocument();
    expect(within(list).getByText("Selected for review")).toBeInTheDocument();
  });

  it("keeps Compare/Review visible while collapsing manage scenarios on CURRENT", () => {
    render(
      <ScenarioPanel
        piId="pi-1"
        activeRevisionId="rev-current"
        activeRevision={{
          id: "rev-current",
          key: "CURRENT",
          label: null,
          isCurrent: true,
          status: "ACTIVE_PLAN",
        }}
        scenarios={scenarios}
        capabilities={{ canAllocatePi: true }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Compare scenarios" }),
    ).toHaveAttribute("href", expect.stringContaining("/pi/pi-1/compare"));
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      expect.stringContaining("/pi/pi-1/review"),
    );
    expect(
      screen.queryByRole("button", { name: "Create scenario" }),
    ).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /Manage scenarios/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("hides mutating scenario actions for viewers but keeps selector and nav", async () => {
    const user = userEvent.setup();
    render(
      <ScenarioPanel
        piId="pi-1"
        activeRevisionId="rev-draft"
        activeRevision={{
          id: "rev-draft",
          key: "SCN-1",
          label: "Alt staffing",
          isCurrent: false,
          status: "DRAFT",
        }}
        scenarios={scenarios}
        capabilities={{ canAllocatePi: false }}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Manage scenarios/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    await user.click(toggle);

    expect(
      screen.getByText(/require planning permission/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create scenario" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Compare scenarios" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      expect.stringContaining("revisionId=rev-draft"),
    );
  });

  it("surfaces conflict warnings from service summary without inventing capacity", () => {
    render(
      <ScenarioPanel
        piId="pi-1"
        activeRevisionId="rev-current"
        activeRevision={{
          id: "rev-current",
          key: "CURRENT",
          label: null,
          isCurrent: true,
          status: "ACTIVE_PLAN",
        }}
        scenarios={scenarios}
        capacitySummary={{
          availableHours: null,
          committedHours: 0,
          overloadSlots: 2,
          blockerConflictCount: 3,
          teamSlotCount: 0,
        }}
      />,
    );

    expect(
      screen.getByRole("img", { name: /Capacity unavailable/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/3 blocker conflict/i)).toBeInTheDocument();
  });

  it("links scenario chips with revisionId for non-CURRENT", () => {
    render(
      <ScenarioPanel
        piId="pi-1"
        activeRevisionId="rev-current"
        scenarios={scenarios}
        preserveQuery={{ from: "portfolio" }}
      />,
    );

    const draftLink = screen.getByRole("link", { name: /Alt staffing/i });
    expect(draftLink.getAttribute("href")).toContain("revisionId=rev-draft");
    expect(draftLink.getAttribute("href")).toContain("from=portfolio");

    const currentLink = screen.getByRole("link", { name: /^CURRENT/i });
    expect(currentLink.getAttribute("href")).not.toContain("revisionId=");
  });
});

describe("ScenarioModeBanner clarity", () => {
  it("does not equate selected with approved", () => {
    render(
      <ScenarioModeBanner
        revision={{
          id: "r1",
          key: "SCN",
          label: "Path A",
          isCurrent: false,
          status: "SELECTED",
        }}
      />,
    );
    expect(screen.getByText(/Selected for review/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not mean the plan is approved/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Approved$/i)).not.toBeInTheDocument();
  });
});
