/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildHealthHubHref,
  DeliveryHealthAttentionList,
  DeliveryHealthCountsSection,
} from "@/components/portfolio/delivery-health";
import type {
  DeliveryHealthAttentionResult,
  DeliveryHealthSummary,
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

const ORG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const DEPT = "dddddddd-eeee-4fff-8aaa-bbbbbbbbbbbb";

const summary: DeliveryHealthSummary = {
  asOf: "2026-10-09T12:00:00.000Z",
  scope: { organizationId: ORG, mode: "organization" },
  totalProjects: 3,
  attentionCount: 2,
  counts: {
    BLOCKED: 1,
    AT_RISK: 1,
    ON_TRACK: 1,
    COMPLETED: 0,
    CANCELLED: 0,
    UNKNOWN: 0,
  },
};

const attention: DeliveryHealthAttentionResult = {
  asOf: summary.asOf,
  scope: summary.scope,
  total: 1,
  page: 1,
  pageSize: 25,
  sortBy: "classification",
  sortDir: "asc",
  classifications: ["BLOCKED", "AT_RISK"],
  attentionCount: 2,
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

describe("buildHealthHubHref", () => {
  it("preserves organization, department, and healthFocus", () => {
    expect(
      buildHealthHubHref({
        organizationId: ORG,
        departmentId: DEPT,
        healthFocus: "BLOCKED",
      }),
    ).toBe(
      `/portfolio/health?organizationId=${ORG}&departmentId=${DEPT}&healthFocus=BLOCKED`,
    );
  });

  it("omits null focus so Clear returns to the hub", () => {
    expect(
      buildHealthHubHref({ organizationId: ORG, healthFocus: null }),
    ).toBe(`/portfolio/health?organizationId=${ORG}`);
  });
});

describe("DeliveryHealthCountsSection M4E-D", () => {
  it("routes classification chips to the health hub (not Portfolio)", () => {
    render(
      <DeliveryHealthCountsSection
        summary={summary}
        organizationId={ORG}
        departmentId={DEPT}
        healthFocus="BLOCKED"
      />,
    );
    const blocked = screen.getAllByRole("link").find((a) =>
      (a.getAttribute("href") ?? "").includes("healthFocus=BLOCKED"),
    );
    expect(blocked).toBeTruthy();
    expect(blocked).toHaveAttribute(
      "href",
      expect.stringContaining("/portfolio/health"),
    );
    expect(blocked).toHaveAttribute(
      "href",
      expect.stringContaining(`departmentId=${DEPT}`),
    );
  });
});

describe("DeliveryHealthAttentionList M4E-D", () => {
  it("shows empty state and clear-focus when filtered to zero rows", () => {
    render(
      <DeliveryHealthAttentionList
        attention={{ ...attention, total: 0, rows: [] }}
        organizationId={ORG}
        healthFocus="AT_RISK"
      />,
    );
    expect(
      screen.getByText(/No projects in this attention view/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Clear health focus/i }),
    ).toHaveAttribute("href", `/portfolio/health?organizationId=${ORG}`);
  });

  it("links Explain to the health explanation with projectId", () => {
    render(
      <DeliveryHealthAttentionList
        attention={attention}
        organizationId={ORG}
      />,
    );
    const explain = screen.getAllByRole("link", { name: /Explain/i })[0];
    expect(explain).toHaveAttribute(
      "href",
      expect.stringContaining("projectId=proj-1"),
    );
    expect(explain).toHaveAttribute(
      "href",
      expect.stringContaining("/portfolio/health"),
    );
  });
});
