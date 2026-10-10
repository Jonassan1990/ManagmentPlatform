/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteFocusMain } from "@/components/shell/route-focus-main";

const pathRef = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathRef.current,
}));

describe("RouteFocusMain (M4F-D)", () => {
  afterEach(() => {
    pathRef.current = "/";
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not focus main on the initial path (keeps skip link first-Tab reachable)", () => {
    document.body.innerHTML = `<main id="main-content">Home</main>`;
    const main = document.getElementById("main-content")!;
    const focus = vi.spyOn(main, "focus");

    const { rerender } = render(<RouteFocusMain />);
    // Simulate Strict Mode re-running the effect for the same path.
    rerender(<RouteFocusMain />);
    expect(focus).not.toHaveBeenCalled();

    pathRef.current = "/initiatives";
    rerender(<RouteFocusMain />);
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
