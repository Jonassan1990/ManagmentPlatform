/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Alert, InlineFeedback } from "@/components/ui/alert";

describe("Alert / InlineFeedback", () => {
  it("uses role=alert for error tone", () => {
    render(<Alert tone="error">Something failed</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
  });

  it("uses status for info tone", () => {
    render(<Alert tone="info">Heads up</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Heads up");
  });

  it("supports legacy danger/ok tones", () => {
    const { rerender } = render(<Alert tone="danger">Bad</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Bad");
    rerender(<Alert tone="ok">Good</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Good");
  });

  it("dismisses when dismissible", async () => {
    const user = userEvent.setup();
    render(
      <Alert tone="warning" dismissible>
        Temporary
      </Alert>,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Temporary")).toBeNull();
  });

  it("InlineFeedback alias works", () => {
    render(<InlineFeedback tone="success">Done</InlineFeedback>);
    expect(screen.getByRole("status")).toHaveTextContent("Done");
  });
});
