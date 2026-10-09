/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioCapacityDashboard } from "@/components/portfolio/portfolio-capacity-dashboard";
import type {
  PortfolioPiCapacityResult,
  PortfolioPiListItem,
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const ORG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const PI = "11111111-2222-4333-8444-555555555555";
const DEPT = "dddddddd-eeee-4fff-8aaa-bbbbbbbbbbbb";
const TEAM = "tttttttt-uuuu-4vvv-8www-xxxxxxxxxxxx";
const TEAM2 = "yyyyyyyy-zzzz-4aaa-8bbb-cccccccccccc";

function hours(
  available: number,
  committed: number,
  band: "none" | "under" | "ok" | "near" | "overload" = "ok",
) {
  return {
    availableHours: available,
    committedHours: committed,
    remainingHours: available - committed,
    utilization: available > 0 ? committed / available : null,
    band,
  };
}

const pis: PortfolioPiListItem[] = [
  {
    piId: PI,
    referenceKey: "PI-26.3",
    name: "Autumn PI",
    status: "ACTIVE",
    lifecycle: "ACTIVE",
    sectionId: null,
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-11-30T00:00:00.000Z",
    href: `/pi/${PI}`,
    hasCurrentRevision: true,
    baselineCount: 1,
    latestBaselineVersion: 2,
  },
];

function readyCapacity(
  overrides?: Partial<
    Extract<PortfolioPiCapacityResult["capacity"], { state: "ready" }>
  >,
): PortfolioPiCapacityResult {
  const ready = {
    state: "ready" as const,
    meta: {
      piId: PI,
      referenceKey: "PI-26.3",
      name: "Autumn PI",
      status: "ACTIVE" as const,
      startDate: "2026-09-01T00:00:00.000Z",
      endDate: "2026-11-30T00:00:00.000Z",
      revision: {
        id: "rev-1",
        key: "CURRENT",
        version: 3,
        isCurrent: true as const,
      },
      source: "live_capacity_policy" as const,
    },
    totals: hours(200, 180, "near"),
    departments: [
      {
        departmentId: DEPT,
        departmentName: "Operations",
        ...hours(200, 180, "near"),
      },
    ],
    teams: [
      {
        teamId: TEAM,
        teamName: "Platform",
        departmentId: DEPT,
        iterationId: "it-1",
        iterationName: "It1",
        ...hours(80, 100, "overload"),
      },
      {
        teamId: TEAM2,
        teamName: "Support",
        departmentId: DEPT,
        iterationId: "it-1",
        iterationName: "It1",
        ...hours(120, 80, "ok"),
      },
    ],
    overloadedTeams: [
      {
        teamId: TEAM,
        teamName: "Platform",
        departmentId: DEPT,
        iterationId: "it-1",
        iterationName: "It1",
        ...hours(80, 100, "overload"),
      },
    ],
    underutilizedTeams: [],
    resources: {
      page: 1,
      pageSize: 100,
      total: 2,
      rows: [
        {
          resourceId: "r-shared",
          resourceName: "Shared Dev",
          teamId: TEAM,
          iterationId: "it-1",
          membershipAllocationPercent: 50,
          ...hours(40, 50, "overload"),
        },
        {
          resourceId: "r-shared",
          resourceName: "Shared Dev",
          teamId: TEAM2,
          iterationId: "it-1",
          membershipAllocationPercent: 50,
          ...hours(40, 20, "ok"),
        },
      ],
    },
    projectCommitments: [
      {
        projectId: "proj-1",
        initiativeId: "init-1",
        referenceKey: "PRJ-1",
        name: "Core delivery",
        href: "/initiatives/init-1/project",
        committedHours: 60,
        workItemCount: 2,
        allocationCount: 3,
      },
    ],
    conflicts: [
      {
        type: "CAPACITY_OVERLOAD",
        severity: "WARNING" as const,
        message: "Team Platform exceeds capacity",
        subjectType: "TEAM",
        subjectId: TEAM,
        relatedIds: [],
      },
    ],
    baselineComparison: {
      available: true as const,
      baselineId: "base-1",
      versionNumber: 2,
      capturedAt: "2026-09-15T00:00:00.000Z",
      revisionIdCaptured: "rev-0",
      baselineCommittedHours: 150,
      liveCommittedHours: 180,
      deltaHours: 30,
    },
    dataQuality: {
      missingCapacityInputs: false,
      notes: [],
    },
    ...overrides,
  };
  return {
    asOf: "2026-10-09T12:00:00.000Z",
    scope: { organizationId: ORG, mode: "organization" },
    capacity: ready,
  };
}

const baseProps = {
  organizationName: "Acme Org",
  organizations: [{ id: ORG, name: "Acme Org" }],
  departments: [{ id: DEPT, name: "Operations" }],
  organizationId: ORG,
  piId: PI,
  pis,
  capacity: readyCapacity(),
};

describe("PortfolioCapacityDashboard M4E-B UX", () => {
  it("renders A/B/C/D sections with CURRENT and baseline labels", () => {
    render(<PortfolioCapacityDashboard {...baseProps} />);

    expect(screen.getByTestId("capacity-planning-context")).toBeTruthy();
    expect(screen.getByTestId("capacity-summary")).toBeTruthy();
    expect(screen.getByTestId("capacity-hierarchy")).toBeTruthy();
    expect(screen.getByTestId("capacity-management-attention")).toBeTruthy();

    expect(screen.getByText(/CURRENT live/i)).toBeTruthy();
    expect(screen.getByText(/Approved baseline v2/i)).toBeTruthy();
    expect(screen.getByText(/Authoritative commitments/i)).toBeTruthy();
    expect(
      screen.getAllByText(/draft scenario/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows capacity KPIs from service totals", () => {
    render(<PortfolioCapacityDashboard {...baseProps} />);
    const kpis = screen.getByTestId("capacity-kpis");
    expect(within(kpis).getByText("Available hours")).toBeTruthy();
    expect(within(kpis).getByText("200h")).toBeTruthy();
    expect(within(kpis).getByText("Committed hours")).toBeTruthy();
    expect(within(kpis).getByText("180h")).toBeTruthy();
    expect(within(kpis).getByText("Overloaded teams")).toBeTruthy();
    expect(within(kpis).getByText("Planning conflicts")).toBeTruthy();
  });

  it("lists overloaded teams and expands hierarchy on inspect", () => {
    render(<PortfolioCapacityDashboard {...baseProps} />);
    const attention = screen.getByTestId("capacity-management-attention");
    expect(
      within(attention).getAllByText("Platform").length,
    ).toBeGreaterThan(0);

    fireEvent.click(
      within(attention).getByRole("button", { name: /Inspect team/i }),
    );

    expect(
      screen.getByRole("button", {
        name: /Hide .* team/i,
      }),
    ).toBeTruthy();
    expect(screen.getAllByText("Shared Dev").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/membership 50%/i).length).toBeGreaterThan(0);
  });

  it("expands department via keyboard-accessible toggle", () => {
    render(<PortfolioCapacityDashboard {...baseProps} />);
    const toggle = screen.getByRole("button", {
      name: /View .* team/i,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const hierarchy = screen.getByTestId("capacity-hierarchy");
    expect(
      within(hierarchy).getAllByText("Platform").length,
    ).toBeGreaterThan(0);
    expect(
      within(hierarchy).getAllByText("Support").length,
    ).toBeGreaterThan(0);
    expect(
      within(hierarchy).getAllByText("Shared Dev").length,
    ).toBe(2);
  });

  it("filters overloaded-only and keeps hierarchy readable", () => {
    render(<PortfolioCapacityDashboard {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Overloaded only/i));
    const hierarchy = screen.getByTestId("capacity-hierarchy");
    // Team name appears in expanded hierarchy (not only the filter <option>).
    expect(
      within(hierarchy).getAllByText("Platform").length,
    ).toBeGreaterThan(0);
    expect(
      within(hierarchy).queryAllByText("Support", { selector: "p" }),
    ).toHaveLength(0);
  });

  it("shows project commitments from CURRENT revision", () => {
    render(<PortfolioCapacityDashboard {...baseProps} />);
    expect(screen.getByText(/PRJ-1 · Core delivery/i)).toBeTruthy();
    expect(screen.getByText("60h")).toBeTruthy();
  });

  it("handles no PI selected with PI chips", () => {
    render(
      <PortfolioCapacityDashboard
        {...baseProps}
        piId={undefined}
        capacity={null}
      />,
    );
    expect(screen.getByText(/No PI selected/i)).toBeTruthy();
    expect(screen.getByTestId("capacity-pi-chips")).toBeTruthy();
    expect(screen.getByRole("button", { name: /PI-26.3 · ACTIVE/i })).toBeTruthy();
    expect(screen.queryByTestId("capacity-kpis")).toBeNull();
  });

  it("handles unavailable capacity without inventing zero hours", () => {
    render(
      <PortfolioCapacityDashboard
        {...baseProps}
        capacity={{
          asOf: "2026-10-09T12:00:00.000Z",
          scope: { organizationId: ORG, mode: "organization" },
          capacity: {
            state: "unavailable",
            reason: "No participating departments for this PI.",
          },
        }}
      />,
    );
    expect(screen.getByText(/No participating departments/i)).toBeTruthy();
    expect(screen.queryByTestId("capacity-kpis")).toBeNull();
  });

  it("distinguishes zero committed from unavailable", () => {
    render(
      <PortfolioCapacityDashboard
        {...baseProps}
        capacity={readyCapacity({
          totals: hours(100, 0, "under"),
          projectCommitments: [],
          overloadedTeams: [],
          conflicts: [],
          teams: [
            {
              teamId: TEAM2,
              teamName: "Support",
              departmentId: DEPT,
              iterationId: "it-1",
              iterationName: "It1",
              ...hours(100, 0, "under"),
            },
          ],
          resources: { page: 1, pageSize: 100, total: 0, rows: [] },
        })}
      />,
    );
    const kpis = screen.getByTestId("capacity-kpis");
    expect(within(kpis).getByText("0h")).toBeTruthy();
    expect(within(kpis).getByText(/valid empty load/i)).toBeTruthy();
  });

  it("shows unavailable baseline comparison reason", () => {
    render(
      <PortfolioCapacityDashboard
        {...baseProps}
        capacity={readyCapacity({
          baselineComparison: {
            available: false,
            reason: "No approved baseline for this PI.",
          },
        })}
      />,
    );
    expect(screen.getByText(/No approved baseline/i)).toBeTruthy();
  });

  it("surfaces missing capacity data in management attention", () => {
    render(
      <PortfolioCapacityDashboard
        {...baseProps}
        capacity={readyCapacity({
          dataQuality: {
            missingCapacityInputs: true,
            notes: ["2 resources lack capacityHoursPerWeek."],
          },
        })}
      />,
    );
    const attention = screen.getByTestId("capacity-management-attention");
    expect(
      within(attention).getByText("Missing capacity data"),
    ).toBeTruthy();
    expect(
      within(attention).getByText(/2 resources lack capacityHoursPerWeek/i),
    ).toBeTruthy();
  });

  it("documents shared-resource policy without inventing formulas", () => {
    render(<PortfolioCapacityDashboard {...baseProps} />);
    expect(screen.getByText(/Shared resource policy/i)).toBeTruthy();
    expect(
      screen.getByText(/must not have full capacity counted independently/i),
    ).toBeTruthy();
  });
});
