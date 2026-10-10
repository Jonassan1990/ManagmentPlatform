/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveRegion } from "@/components/ui/live-region";

describe("LiveRegion", () => {
  it("announces polite status messages for assistive tech", () => {
    render(<LiveRegion message="Showing 3 of 12 departments." />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Showing 3 of 12 departments.");
  });

  it("renders nothing when message is empty", () => {
    const { container } = render(<LiveRegion message="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
