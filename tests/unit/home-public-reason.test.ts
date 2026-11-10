import { describe, expect, it } from "vitest";
import { publicUnavailableReason } from "@/components/home/home-labels";

describe("publicUnavailableReason", () => {
  it("hides prisma connection diagnostics", () => {
    expect(
      publicUnavailableReason(
        "Invalid prisma.project.findMany() invocation: Too many database connections opened. FATAL: too many connections",
      ),
    ).toMatch(/retry/i);
  });

  it("keeps ordinary product reasons", () => {
    expect(
      publicUnavailableReason("No preferred organization for capacity."),
    ).toBe("No preferred organization for capacity.");
  });
});
