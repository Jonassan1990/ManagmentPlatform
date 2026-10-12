/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Button,
  ButtonLink,
  buttonClassName,
} from "@/components/ui/button";

describe("shared Tegel button chrome", () => {
  it("maps variants to the same CSS utility classes app-wide", () => {
    expect(buttonClassName({ variant: "primary" })).toContain("primary-button");
    expect(buttonClassName({ variant: "secondary" })).toContain(
      "secondary-button",
    );
    expect(buttonClassName({ variant: "outline" })).toContain("outline-button");
    expect(buttonClassName({ variant: "ghost" })).toContain("ghost-button");
    expect(buttonClassName({ variant: "destructive" })).toContain(
      "danger-button",
    );
    expect(buttonClassName({ size: "sm" })).toContain("tegel-btn-sm");
  });

  it("renders Button and ButtonLink with matching primary chrome", () => {
    render(
      <>
        <Button>Save</Button>
        <ButtonLink href="/x">Open</ButtonLink>
      </>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "primary-button",
    );
    expect(screen.getByRole("link", { name: "Open" })).toHaveClass(
      "primary-button",
    );
  });
});
