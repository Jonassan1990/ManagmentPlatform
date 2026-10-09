/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  STATUS_BADGE_LABELS,
  StatusBadge,
  type StatusBadgeVariant,
} from "@/components/ui/status-badge";

describe("StatusBadge", () => {
  it("renders visible text for every semantic variant", () => {
    const variants = Object.keys(STATUS_BADGE_LABELS) as StatusBadgeVariant[];
    for (const status of variants) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(
        screen.getByText(STATUS_BADGE_LABELS[status]),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("allows label override while keeping data-status", () => {
    render(<StatusBadge status="blocked" label="Hard conflict" />);
    const el = screen.getByText("Hard conflict");
    expect(el.closest("[data-status]")).toHaveAttribute(
      "data-status",
      "blocked",
    );
  });
});
