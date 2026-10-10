import { describe, expect, it } from "vitest";
import {
  buildManagementAttention,
  completionIndicatorLabel,
  describeProjectNextAction,
  evaluateProjectDeliveryHealth,
  humanizeProjectToken,
  isClosedProject,
  mapHealthBadge,
  mapStatusBadge,
  ownershipBasisLabel,
  resolveProjectOwnerDisplay,
  summarizeDeliveryProgress,
} from "@/modules/project/application/project-presentation";

describe("M5C-C owner display", () => {
  it("prefers linked resource name", () => {
    const owner = resolveProjectOwnerDisplay({
      ownerResource: { id: "r1", name: "Jordan Owner" },
      ownerName: "Snapshot",
    });
    expect(owner).toEqual({
      name: "Jordan Owner",
      basis: "resource_link",
    });
    expect(ownershipBasisLabel(owner.basis)).toMatch(/Linked Resource/i);
  });

  it("falls back to name snapshot then missing", () => {
    expect(
      resolveProjectOwnerDisplay({ ownerName: "  Pat  " }).basis,
    ).toBe("name_snapshot");
    expect(resolveProjectOwnerDisplay({}).basis).toBe("missing");
    expect(ownershipBasisLabel("missing")).toMatch(/Not set/i);
  });
});

describe("M5C-C delivery summary", () => {
  it("counts milestones, work, and issue summary without inventing KPIs", () => {
    const asOf = new Date("2026-06-01T00:00:00.000Z");
    const counts = summarizeDeliveryProgress({
      asOf,
      milestones: [
        { status: "COMPLETED", plannedDate: "2026-01-01" },
        { status: "PLANNED", plannedDate: "2026-01-15" },
        { status: "MISSED", plannedDate: "2026-02-01" },
        { status: "IN_PROGRESS", plannedDate: "2026-07-01" },
      ],
      workItems: [
        { status: "DONE" },
        { status: "BACKLOG" },
        { status: "IN_PROGRESS" },
        { status: "CANCELLED" },
      ],
      issueSummary: {
        openCount: 3,
        activeBlockerCount: 1,
        criticalOpenCount: 2,
      },
    });
    expect(counts.milestonesTotal).toBe(4);
    expect(counts.milestonesComplete).toBe(1);
    expect(counts.milestonesMissed).toBe(2);
    expect(counts.workDone).toBe(2);
    expect(counts.workOpen).toBe(2);
    expect(counts.activeBlockers).toBe(1);
    expect(completionIndicatorLabel(counts)).toMatch(/1\/4 milestones/);
  });

  it("labels empty delivery honestly", () => {
    expect(
      completionIndicatorLabel(
        summarizeDeliveryProgress({
          milestones: [],
          workItems: [],
        }),
      ),
    ).toMatch(/No milestones or work items/i);
  });
});

describe("M5C-C management attention", () => {
  it("surfaces blockers, critical issues, delayed milestones, pending work", () => {
    const asOf = new Date("2026-06-01T00:00:00.000Z");
    const items = buildManagementAttention({
      asOf,
      issues: [
        {
          id: "i1",
          referenceKey: "ISS-1",
          title: "Vendor access",
          status: "OPEN",
          severity: "HIGH",
          isBlocker: true,
        },
        {
          id: "i2",
          referenceKey: "ISS-2",
          title: "Security gap",
          status: "OPEN",
          severity: "CRITICAL",
          isBlocker: false,
        },
        {
          id: "i3",
          referenceKey: "ISS-3",
          title: "Resolved noise",
          status: "RESOLVED",
          severity: "CRITICAL",
          isBlocker: true,
        },
      ],
      milestones: [
        {
          id: "m1",
          referenceKey: "MS-1",
          title: "Go-live",
          status: "PLANNED",
          plannedDate: "2026-01-01",
          criticality: true,
        },
      ],
      workItems: [
        { id: "w1", referenceKey: "WI-1", title: "Task", status: "READY" },
      ],
    });
    expect(items.some((i) => i.kind === "blocker")).toBe(true);
    expect(items.some((i) => i.kind === "critical_issue")).toBe(true);
    expect(items.some((i) => i.kind === "delayed_milestone")).toBe(true);
    expect(items.some((i) => i.kind === "pending_work")).toBe(true);
    expect(items.find((i) => i.id === "blocker-i3")).toBeUndefined();
  });
});

describe("M5C-C next action", () => {
  it("routes create / closed / blockers / delayed / close / work / idle", () => {
    expect(
      describeProjectNextAction({
        hasProject: false,
        projectClosed: false,
        initiativeId: "ini-1",
        activeBlockers: 0,
        delayedMilestones: 0,
        openWork: 0,
      }).kind,
    ).toBe("create_from_pilot");

    expect(
      describeProjectNextAction({
        hasProject: true,
        projectClosed: true,
        initiativeId: "ini-1",
        activeBlockers: 0,
        delayedMilestones: 0,
        openWork: 0,
      }).kind,
    ).toBe("view_closure");

    const blockers = describeProjectNextAction({
      hasProject: true,
      projectClosed: false,
      initiativeId: "ini-1",
      activeBlockers: 2,
      delayedMilestones: 1,
      openWork: 5,
      canEditProject: false,
    });
    expect(blockers.kind).toBe("resolve_blockers");
    expect(blockers.blocked).toBe(true);
    expect(blockers.unavailableReason).toMatch(/permission/i);

    expect(
      describeProjectNextAction({
        hasProject: true,
        projectClosed: false,
        initiativeId: "ini-1",
        activeBlockers: 0,
        delayedMilestones: 1,
        openWork: 0,
        canEditProject: true,
      }).kind,
    ).toBe("update_milestones");

    const closeReady = describeProjectNextAction({
      hasProject: true,
      projectClosed: false,
      initiativeId: "ini-1",
      activeBlockers: 0,
      delayedMilestones: 0,
      openWork: 0,
      closureCanClose: true,
      canCloseProject: true,
    });
    expect(closeReady.kind).toBe("close_project");
    expect(closeReady.unavailableReason ?? null).toBeNull();

    const closeDenied = describeProjectNextAction({
      hasProject: true,
      projectClosed: false,
      initiativeId: "ini-1",
      activeBlockers: 0,
      delayedMilestones: 0,
      openWork: 0,
      closureCanClose: true,
      canCloseProject: false,
    });
    expect(closeDenied.unavailableReason).toMatch(/close permission/i);

    expect(
      describeProjectNextAction({
        hasProject: true,
        projectClosed: false,
        initiativeId: "ini-1",
        activeBlockers: 0,
        delayedMilestones: 0,
        openWork: 3,
        closureCanClose: false,
      }).kind,
    ).toBe("plan_work");

    expect(
      describeProjectNextAction({
        hasProject: true,
        projectClosed: false,
        initiativeId: "ini-1",
        activeBlockers: 0,
        delayedMilestones: 0,
        openWork: 0,
        closureCanClose: false,
      }).kind,
    ).toBe("idle");
  });
});

describe("M5C-C health / status badges & closed detection", () => {
  it("maps badges and closed state", () => {
    expect(mapStatusBadge("ACTIVE").label).toMatch(/Active/i);
    expect(mapHealthBadge("BLOCKED").status).toBeDefined();
    expect(isClosedProject("COMPLETED", false)).toBe(true);
    expect(isClosedProject("ACTIVE", true)).toBe(true);
    expect(isClosedProject("ACTIVE", false)).toBe(false);
    expect(humanizeProjectToken("PARTIALLY_DELIVERED")).toMatch(/Partially/i);
  });

  it("delegates delivery health to existing evaluator", () => {
    const health = evaluateProjectDeliveryHealth({
      id: "p1",
      initiativeId: "i1",
      status: "ACTIVE",
      plannedEnd: new Date("2027-01-01"),
      plannedStart: new Date("2026-01-01"),
      closureOutcome: null,
      issues: [
        {
          id: "iss1",
          status: "OPEN",
          severity: "HIGH",
          isBlocker: true,
        },
      ],
      milestones: [],
      asOf: new Date("2026-06-01"),
    });
    expect(health.classification).toBe("BLOCKED");
  });
});
