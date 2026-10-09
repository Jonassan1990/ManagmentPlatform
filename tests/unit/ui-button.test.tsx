/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders accessible name and native button type", () => {
    render(<Button type="submit">Save plan</Button>);
    const btn = screen.getByRole("button", { name: "Save plan" });
    expect(btn).toHaveAttribute("type", "submit");
  });

  it("disables when loading and exposes aria-busy", () => {
    render(
      <Button loading variant="primary">
        Saving
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Saving" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("does not appear actionable when disabled", () => {
    render(
      <Button disabled variant="destructive">
        Delete
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("supports variants without crashing", () => {
    const { rerender } = render(<Button variant="ghost">G</Button>);
    expect(screen.getByRole("button")).toBeTruthy();
    rerender(<Button variant="outline">O</Button>);
    expect(screen.getByRole("button", { name: "O" })).toBeTruthy();
  });
});
