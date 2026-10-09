/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioDashboardView } from "@/components/portfolio/portfolio-dashboard";
import type {
  DeliveryHealthAttentionResult,
  DeliveryHealthSummary,
  PortfolioSnapshot,
} from "@/modules/portfolio/domain/types";

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

function metric<T>(value: T) {
  return { available: true as const, value };
}

const ORG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const baseSnapshot: PortfolioSnapshot = {
  asOf: "2026-10-09T12:00:00.000Z",
  scope: {
    organizationId: ORG,
    mode: "organization",
  },
  initiatives: metric({
    total: 4,
    byStage: {
      DEMAND: 1,
      REQUIREMENTS: 1,
      PRE_STUDY: 1,
      POC: 0,
      PILOT: 0,
      PROJECT: 1,
    },
    byStatus: { ACTIVE: 4, ON_HOLD: 0, CANCELLED: 0 },
  }),
  projects: metric({
    active: 2,
    onHold: 0,
    completed: 1,
    cancelled: 0,
  }),
  delayedProjects: metric({
    delayedProjects: 1,
    definition: "milestone_missed_or_planned_end_past",
  }),
  issues: metric({
    openIssues: 3,
    criticalOpenIssues: 1,
    activeBlockers: 1,
  }),
  governance: metric({
    waitingForApproval: 2,
    waitingForDecision: 1,
    pendingApprovalRequests: 2,
  }),
  dependencies: metric({
    openDependencies: 2,
    criticalOpenDependencies: 1,
  }),
  experimentation: metric({ activePocs: 1, activePilots: 0 }),
  piCapacity: metric({
    source: "live_capacity_policy",
    piCountConsidered: 1,
    teamIterationRows: 1,
    nearCapacityTeamIterations: 1,
    overloadedTeamIterations: 0,
    teams: [
      {
        teamId: "t1",
        teamName: "Team Alpha",
        departmentId: "d1",
        piId: "p1",
        iterationId: "i1",
        effectiveCapacityHours: 40,
        plannedLoadHours: 36,
        utilization: 0.9,
        band: "near",
      },
    ],
  }),
  ownership: metric([]),
};

const healthSummary: DeliveryHealthSummary = {
  asOf: "2026-10-09T12:00:00.000Z",
  scope: baseSnapshot.scope,
  counts: {
    BLOCKED: 1,
    AT_RISK: 2,
    ON_TRACK: 3,
    COMPLETED: 1,
    CANCELLED: 0,
    UNKNOWN: 0,
  },
  attentionCount: 3,
  totalProjects: 7,
};

const healthAttention: DeliveryHealthAttentionResult = {
  asOf: "2026-10-09T12:00:00.000Z",
  scope: baseSnapshot.scope,
  total: 1,
  page: 1,
  pageSize: 25,
  sortBy: "classification",
  sortDir: "asc",
  classifications: ["BLOCKED", "AT_RISK"],
  attentionCount: 3,
  rows: [
    {
      projectId: "proj-1",
      initiativeId: "init-1",
      referenceKey: "PRJ-1",
      name: "Blocked delivery",
      href: "/initiatives/init-1/project",
      projectStatus: "ACTIVE",
      classification: "BLOCKED",
      closureOutcome: null,
      departmentId: "d1",
      departmentName: "Ops",
      sectionId: "s1",
      sectionName: "Section",
      owner: {
        resourceId: null,
        displayName: "Unassigned",
        source: "legacy",
      },
      plannedEnd: null,
      updatedAt: "2026-10-09T12:00:00.000Z",
      reasons: [
        {
          code: "ACTIVE_BLOCKER_ISSUE",
          severity: "blocker",
          message: "Active blocker issue",
          sourceType: "PROJECT_ISSUE",
          sourceId: "issue-1",
          relevantAt: null,
          relevantStatus: "OPEN",
        },
      ],
    },
  ],
};

describe("M4E-A PortfolioDashboardView", () => {
  it("renders three-level hierarchy headings", () => {
    render(
      <PortfolioDashboardView
        snapshot={baseSnapshot}
        organizationName="Acme"
        departmentName={null}
        healthSummary={healthSummary}
        healthAttention={healthAttention}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /^Executive summary$/i }),
    ).toBeInTheDocument();
    expect(
      document.getElementById("portfolio-management-attention"),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /^Portfolio insights$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText("Level 2")).toBeInTheDocument();
    expect(screen.getByText("Level 3")).toBeInTheDocument();
  });

  it("shows six executive KPI cards with destinations", () => {
    render(
      <PortfolioDashboardView
        snapshot={baseSnapshot}
        organizationName="Acme"
        departmentName={null}
        healthSummary={healthSummary}
        healthAttention={healthAttention}
      />,
    );

    const kpis = screen.getByTestId("portfolio-executive-kpis");
    expect(within(kpis).getByText(/Active initiatives/i)).toBeInTheDocument();
    expect(within(kpis).getByText(/Active projects/i)).toBeInTheDocument();
    expect(within(kpis).getByText(/Delayed projects/i)).toBeInTheDocument();
    expect(within(kpis).getByText(/Blocked projects/i)).toBeInTheDocument();
    expect(within(kpis).getByText(/Pending governance/i)).toBeInTheDocument();
    expect(within(kpis).getByText(/PI capacity status/i)).toBeInTheDocument();
    expect(within(kpis).getByText(/1 near capacity/i)).toBeInTheDocument();
  });

  it("wires attention actions to real destinations with return context", () => {
    render(
      <PortfolioDashboardView
        snapshot={baseSnapshot}
        organizationName="Acme"
        departmentName={null}
        healthSummary={healthSummary}
        healthAttention={healthAttention}
      />,
    );

    const approvals = screen.getByRole("link", {
      name: /Open approvals inbox/i,
    });
    expect(approvals).toHaveAttribute(
      "href",
      expect.stringContaining("/approvals"),
    );
    expect(approvals).toHaveAttribute(
      "href",
      expect.stringContaining("from=portfolio"),
    );

    expect(
      screen.getByRole("link", { name: /Filter blocked/i }),
    ).toHaveAttribute("href", expect.stringContaining("healthFocus=BLOCKED"));

    expect(
      screen.getByRole("link", { name: /Blocked delivery/i }),
    ).toHaveAttribute("href", "/initiatives/init-1/project");
  });

  it("shows empty portfolio state when counts are zero", () => {
    const empty: PortfolioSnapshot = {
      ...baseSnapshot,
      initiatives: metric({
        total: 0,
        byStage: {
          DEMAND: 0,
          REQUIREMENTS: 0,
          PRE_STUDY: 0,
          POC: 0,
          PILOT: 0,
          PROJECT: 0,
        },
        byStatus: { ACTIVE: 0, ON_HOLD: 0, CANCELLED: 0 },
      }),
      projects: metric({
        active: 0,
        onHold: 0,
        completed: 0,
        cancelled: 0,
      }),
    };

    render(
      <PortfolioDashboardView
        snapshot={empty}
        organizationName="Acme"
        departmentName={null}
      />,
    );

    expect(
      screen.getByText(/No portfolio activity in this scope/i),
    ).toBeInTheDocument();
  });

  it("surfaces unavailable capacity without inventing a status", () => {
    const noCap: PortfolioSnapshot = {
      ...baseSnapshot,
      piCapacity: {
        available: false,
        reason: "No PI_VIEW PIs in planning statuses",
      },
    };

    render(
      <PortfolioDashboardView
        snapshot={noCap}
        organizationName="Acme"
        departmentName={null}
      />,
    );

    expect(screen.getAllByText(/Capacity unavailable/i).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText(/No PI_VIEW PIs in planning statuses/i).length,
    ).toBeGreaterThan(0);
  });

  it("keeps ownership behind progressive disclosure", () => {
    render(
      <PortfolioDashboardView
        snapshot={baseSnapshot}
        organizationName="Acme"
        departmentName={null}
        healthSummary={healthSummary}
      />,
    );

    const summaryEl = document.querySelector("details > summary");
    expect(summaryEl).toBeTruthy();
    expect(summaryEl?.textContent).toMatch(/Ownership references/i);
  });
});
