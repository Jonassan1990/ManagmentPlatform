import { describe, expect, it } from "vitest";
import {
  isActiveBlockerIssue,
  isAllowedIssueStatusTransition,
  summarizeProjectIssues,
} from "@/modules/project/application/issue-policy";

describe("project issue policy", () => {
  it("defines active blocker as isBlocker + non-terminal status", () => {
    expect(
      isActiveBlockerIssue({ isBlocker: true, status: "OPEN" }),
    ).toBe(true);
    expect(
      isActiveBlockerIssue({ isBlocker: true, status: "IN_PROGRESS" }),
    ).toBe(true);
    expect(
      isActiveBlockerIssue({ isBlocker: true, status: "RESOLVED" }),
    ).toBe(false);
    expect(
      isActiveBlockerIssue({ isBlocker: true, status: "CLOSED" }),
    ).toBe(false);
    expect(
      isActiveBlockerIssue({ isBlocker: false, status: "OPEN" }),
    ).toBe(false);
  });

  it("allows forward transitions and reopen", () => {
    expect(isAllowedIssueStatusTransition("OPEN", "IN_PROGRESS")).toBe(true);
    expect(isAllowedIssueStatusTransition("IN_PROGRESS", "RESOLVED")).toBe(
      true,
    );
    expect(isAllowedIssueStatusTransition("RESOLVED", "CLOSED")).toBe(true);
    expect(isAllowedIssueStatusTransition("CLOSED", "OPEN")).toBe(true);
    expect(isAllowedIssueStatusTransition("RESOLVED", "IN_PROGRESS")).toBe(
      true,
    );
  });

  it("summarizes open / blockers / critical", () => {
    const summary = summarizeProjectIssues([
      { status: "OPEN", severity: "CRITICAL", isBlocker: true },
      { status: "IN_PROGRESS", severity: "LOW", isBlocker: true },
      { status: "RESOLVED", severity: "CRITICAL", isBlocker: true },
      { status: "CLOSED", severity: "HIGH", isBlocker: false },
    ]);
    expect(summary.openCount).toBe(2);
    expect(summary.activeBlockerCount).toBe(2);
    expect(summary.criticalOpenCount).toBe(1);
  });
});
