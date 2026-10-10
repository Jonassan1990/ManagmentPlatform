/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteFocusMain } from "@/components/shell/route-focus-main";

let pathname = "/portfolio";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("RouteFocusMain", () => {
  it("focuses main content when pathname changes after first render", () => {
    pathname = "/portfolio";
    document.body.innerHTML =
      '<main id="main-content" tabindex="-1"></main>';
    const main = document.getElementById("main-content")!;
    const focusSpy = vi.spyOn(main, "focus");

    const { rerender } = render(<RouteFocusMain />);
    expect(focusSpy).not.toHaveBeenCalled();

    pathname = "/portfolio/explorer";
    rerender(<RouteFocusMain />);
    expect(focusSpy).toHaveBeenCalled();
  });
});
