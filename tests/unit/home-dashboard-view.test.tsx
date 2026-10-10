/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeDashboardView } from "@/components/home/home-dashboard-view";
import {
  modeDescription,
  modeHeadline,
  attributionLabel,
} from "@/components/home/home-labels";
import type {
  HomeDashboardMode,
  HomeDashboardResponse,
  HomeMetricValue,
  HomeSectionMeta,
} from "@/modules/portfolio/domain/home-dashboard";

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

const ORG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function sectionMeta(
  overrides: Partial<HomeSectionMeta> = {},
): HomeSectionMeta {
  return {
    authorizedScope: {
      mode: "organization",
      organizationId: ORG,
      organizationName: "Acme",
    },
    sourceOfTruth: "test",
    availability: { state: "available" },
    drillDown: [],
    asOf: "2026-10-10T12:00:00.000Z",
    ...overrides,
  };
}

function metric(
  key: string,
  label: string,
  value: number | null,
  available = true,
  href: string | null = `/${key}`,
): HomeMetricValue {
  return {
    key,
    label,
    value,
    available,
    href: available ? href : null,
    source: "test",
    unavailableReason: available ? undefined : "Service unavailable",
  };
}

function baseDashboard(
  mode: HomeDashboardMode,
  overrides: Partial<HomeDashboardResponse> = {},
): HomeDashboardResponse {
  return {
    asOf: "2026-10-10T12:00:00.000Z",
    userContext: {
      ...sectionMeta(),
      principalId: "p1",
      displayName: "Alex Manager",
      mode,
      capabilities: {
        canViewApprovals: true,
        canViewDecisions: true,
        canManageGovernancePolicy: false,
        canManageAccess: false,
        canViewPi: true,
        canCreatePi: true,
        canViewInitiatives: true,
        canCreateInitiative: true,
      },
      organizations: [
        {
          id: ORG,
          name: "Acme",
          roleKeys: ["portfolio.manager"],
        },
      ],
      preferredOrganizationId: ORG,
      roleBindings: [
        {
          roleKey: "portfolio.manager",
          roleName: "Portfolio Manager",
          scopeType: "ORGANIZATION",
          organizationId: ORG,
          scopeId: null,
        },
      ],
      linkedResource:
        mode === "employee" || mode === "mixed"
          ? {
              resourceId: "r1",
              name: "Alex",
              organizationId: ORG,
              type: "PERSON",
            }
          : null,
      managerSignals: mode !== "employee",
      hasLinkedResource: mode === "employee" || mode === "mixed",
    },
    availableActions: {
      ...sectionMeta(),
      actions: [
        {
          id: "create-initiative",
          label: "Create Initiative",
          href: "/initiatives/new",
          authorizationBasis: "initiative.create",
          primary: true,
        },
        {
          id: "open-pi-planning",
          label: "Open PI Planning",
          href: "/pi",
          authorizationBasis: "pi.view",
        },
        {
          id: "open-portfolio",
          label: "Open Portfolio",
          href: `/portfolio?organizationId=${ORG}`,
          authorizationBasis: "shell.portfolio",
        },
      ],
    },
    myWork: {
      ...sectionMeta(
        mode === "manager"
          ? {
              availability: {
                state: "no_linked_resource",
                reason: "No ACTIVE Resource is linked.",
              },
            }
          : {},
      ),
      items:
        mode === "manager"
          ? []
          : [
              {
                id: "init-1",
                kind: "initiative",
                referenceKey: "INIT-0001",
                title: "Owned initiative",
                status: "ACTIVE",
                href: "/initiatives/init-1",
                organizationId: ORG,
                attribution: {
                  basis: "resource_link",
                  resourceId: "r1",
                  relationship: "INITIATIVE_BUSINESS_OWNER",
                },
              },
            ],
      totals: {
        initiatives: mode === "manager" ? 0 : 1,
        projects: 0,
        workItems: 0,
        approvals: 0,
        decisions: 0,
        other: 0,
      },
      truncated: false,
    },
    needsAttention: {
      ...sectionMeta(),
      items: [
        {
          id: "delivery-health-attention",
          kind: "delivery_health",
          label: "2 project(s) blocked or at risk",
          detail: null,
          severity: "blocker",
          href: `/portfolio/health?organizationId=${ORG}`,
          organizationId: ORG,
        },
      ],
      counts: {
        blockedOrAtRiskProjects: 2,
        initiativesNeedingAttention: 1,
        waitingForApproval: 3,
        pisNeedingAttention: 0,
      },
      drillDown: [
        {
          id: "health",
          label: "Delivery health",
          href: `/portfolio/health?organizationId=${ORG}`,
        },
      ],
    },
    portfolioSummary: {
      ...sectionMeta(),
      metrics: [
        metric("active-initiatives", "Active Initiatives", 4),
        metric("active-projects", "Active Projects", 2),
        metric("pending-governance", "Pending Governance", 3),
        metric("delayed-projects", "Delayed Projects", 1),
        metric("overloaded-teams", "Overloaded Teams", null, false),
      ],
    },
    activeProjects: {
      ...sectionMeta(),
      rows: [
        {
          projectId: "proj-1",
          initiativeId: "init-1",
          referenceKey: "PRJ-1",
          name: "Blocked delivery",
          href: "/initiatives/init-1?tab=project",
          classification: "BLOCKED",
          departmentName: "Dept A",
        },
      ],
      activeProjectCount: 2,
      blockedOrAtRiskCount: 2,
    },
    currentPi: {
      ...sectionMeta(),
      pi: {
        id: "pi-1",
        referenceKey: "PI-2026.Q4",
        name: "Q4 Planning",
        status: "ACTIVE",
        href: "/pi/pi-1/board",
      },
      metrics: [
        metric("pi-active", "PIs Active", 1, true, "/pi"),
      ],
    },
    resourceCapacity: {
      ...sectionMeta(),
      piId: "pi-1",
      piReferenceKey: "PI-2026.Q4",
      overloadedTeamCount: 1,
      underutilizedTeamCount: 2,
      conflictCount: 0,
      totals: {
        effectiveCapacityHours: 100,
        plannedLoadHours: 120,
        utilization: 1.2,
      },
      drillDown: [
        {
          id: "capacity",
          label: "Resource Planning",
          href: `/portfolio/capacity?organizationId=${ORG}&piId=pi-1`,
        },
      ],
    },
    warnings: [],
    ...overrides,
  };
}

describe("home-labels", () => {
  it("describes modes without inventing roles from names", () => {
    expect(modeHeadline("manager")).toMatch(/Management/i);
    expect(modeDescription("employee")).toMatch(/work you own/i);
    expect(
      attributionLabel({
        basis: "resource_link",
        resourceId: "r1",
        relationship: "PROJECT_OWNER",
      }),
    ).toBe("Project owner");
  });
});

describe("HomeDashboardView — modes", () => {
  it("manager mode prioritizes Needs Attention and Quick Start creates", () => {
    render(<HomeDashboardView dashboard={baseDashboard("manager")} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Welcome, Alex Manager",
    );
    expect(screen.getByText("Management overview")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Needs Attention" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Create Initiative/i }),
    ).toHaveAttribute("href", expect.stringContaining("/initiatives/new"));
    expect(screen.getByText("No linked work identity")).toBeInTheDocument();
  });

  it("employee mode prioritizes My Work and hides manager-only empty emphasis", () => {
    const dash = baseDashboard("employee", {
      userContext: {
        ...baseDashboard("employee").userContext,
        displayName: "Sam Contributor",
        capabilities: {
          canViewApprovals: false,
          canViewDecisions: false,
          canManageGovernancePolicy: false,
          canManageAccess: false,
          canViewPi: true,
          canCreatePi: false,
          canViewInitiatives: true,
          canCreateInitiative: false,
        },
        roleBindings: [
          {
            roleKey: "organization.viewer",
            roleName: "Viewer",
            scopeType: "ORGANIZATION",
            organizationId: ORG,
            scopeId: null,
          },
        ],
        organizations: [
          { id: ORG, name: "Acme", roleKeys: ["organization.viewer"] },
        ],
        managerSignals: false,
      },
      availableActions: {
        ...sectionMeta(),
        actions: [
          {
            id: "open-portfolio",
            label: "Open Portfolio",
            href: "/portfolio",
            authorizationBasis: "shell.portfolio",
          },
          {
            id: "open-pi-planning",
            label: "Open PI Planning",
            href: "/pi",
            authorizationBasis: "pi.view",
          },
        ],
      },
    });

    render(<HomeDashboardView dashboard={dash} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Welcome, Sam Contributor",
    );
    expect(screen.getByText("Your work")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /INIT-0001/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Create Initiative/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Business owner")).toBeInTheDocument();
  });

  it("mixed mode shows attention and my work without duplicate section titles", () => {
    render(<HomeDashboardView dashboard={baseDashboard("mixed")} />);

    expect(
      screen.getByText("Your work & management overview"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Needs Attention" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("heading", { name: "My Work" }),
    ).toHaveLength(1);
    expect(screen.getByText("Business owner")).toBeInTheDocument();
  });

  it("viewer quick start only includes authorized actions", () => {
    const dash = baseDashboard("employee", {
      availableActions: {
        ...sectionMeta(),
        actions: [
          {
            id: "open-portfolio",
            label: "Open Portfolio",
            href: "/portfolio",
            authorizationBasis: "shell.portfolio",
          },
        ],
      },
    });
    render(<HomeDashboardView dashboard={dash} />);
    const quickStart = screen.getByRole("heading", { name: "Quick Start" })
      .closest("section");
    expect(quickStart).toBeTruthy();
    expect(
      within(quickStart as HTMLElement).getByRole("link", {
        name: /Open Portfolio/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Create Initiative/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Review Governance/i }),
    ).not.toBeInTheDocument();
  });
});

describe("HomeDashboardView — empty / unavailable", () => {
  it("shows unavailable KPI as em dash, never as zero", () => {
    render(<HomeDashboardView dashboard={baseDashboard("manager")} />);
    const unavailable = screen.getByLabelText("Overloaded Teams: unavailable");
    expect(within(unavailable).getByText("—")).toBeInTheDocument();
    expect(within(unavailable).queryByText("0")).not.toBeInTheDocument();
    expect(
      within(unavailable).getByText("Service unavailable"),
    ).toBeInTheDocument();
  });

  it("renders empty My Work / no linked resource distinctly", () => {
    render(<HomeDashboardView dashboard={baseDashboard("manager")} />);
    expect(screen.getByText("No linked work identity")).toBeInTheDocument();
    expect(
      screen.getByText(/No ACTIVE Resource is linked/i),
    ).toBeInTheDocument();
  });

  it("renders empty current PI with next step", () => {
    const dash = baseDashboard("manager", {
      currentPi: {
        ...sectionMeta({
          availability: {
            state: "empty",
            reason: "No ACTIVE/REVIEW/BASELINED Program Increment.",
          },
        }),
        pi: null,
        metrics: [],
        drillDown: [{ id: "pi-list", label: "PI Planning", href: "/pi" }],
      },
    });
    render(<HomeDashboardView dashboard={dash} />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "PI Planning" }),
    ).toHaveAttribute("href", expect.stringContaining("/pi"));
  });

  it("shows multi-org warning when present", () => {
    const dash = baseDashboard("manager", {
      warnings: [
        {
          code: "MULTI_ORG_SCOPE",
          message: "Multiple organizations are in scope.",
        },
      ],
      userContext: {
        ...baseDashboard("manager").userContext,
        organizations: [
          { id: ORG, name: "Acme", roleKeys: ["portfolio.manager"] },
          {
            id: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            name: "Beta",
            roleKeys: ["organization.viewer"],
          },
        ],
      },
    });
    render(<HomeDashboardView dashboard={dash} />);
    expect(
      screen.getByText(/Multiple organizations are in scope/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 organizations in scope/i)).toBeInTheDocument();
  });
});

describe("HomeDashboardView — navigation & capacity", () => {
  it("wires attention and KPI drill-downs to real routes", () => {
    render(<HomeDashboardView dashboard={baseDashboard("manager")} />);
    expect(
      screen.getByRole("link", { name: /Blocked \/ at risk: 2/i }),
    ).toHaveAttribute("href", expect.stringContaining("/portfolio/health"));
    expect(
      screen.getByRole("link", { name: /PRJ-1/ }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/initiatives/init-1"),
    );
    expect(
      screen.getByRole("link", { name: "Continue planning" }),
    ).toHaveAttribute("href", expect.stringContaining("/pi/pi-1/board"));
  });

  it("renders capacity bar from server totals", () => {
    render(<HomeDashboardView dashboard={baseDashboard("manager")} />);
    expect(screen.getByText(/Utilization 120%/i)).toBeInTheDocument();
    expect(screen.getByText("Overloaded teams")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Available 100h/i }),
    ).toBeInTheDocument();
  });
});
