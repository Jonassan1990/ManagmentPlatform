/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField, fieldClassName } from "@/components/ui/forms";

describe("FormField accessibility", () => {
  it("wires aria-required, aria-describedby hint, and required marker from child required", () => {
    render(
      <FormField label="Title" htmlFor="title" hint="Keep it short">
        <input id="title" name="title" required className={fieldClassName} />
      </FormField>,
    );

    const input = screen.getByLabelText(/Title/);
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Keep it short")).toBeInTheDocument();
  });

  it("associates field errors with aria-invalid and aria-describedby", () => {
    render(
      <FormField label="Owner" htmlFor="owner" error="Owner is required">
        <input id="owner" name="owner" className={fieldClassName} />
      </FormField>,
    );

    const input = screen.getByLabelText(/Owner/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Owner is required");
    expect(describedBy).toContain(error.id);
  });
});
