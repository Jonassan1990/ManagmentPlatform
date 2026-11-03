import { describe, expect, it } from "vitest";
import {
  USER_GUIDE_INTRO,
  USER_GUIDE_SECTIONS,
} from "@/modules/guide/user-guide";

describe("user guide content", () => {
  it("has a clear intro and ordered sections", () => {
    expect(USER_GUIDE_INTRO.title).toBe("User guide");
    expect(USER_GUIDE_SECTIONS.length).toBeGreaterThanOrEqual(5);
    expect(USER_GUIDE_SECTIONS[0]?.id).toBe("start");
    expect(USER_GUIDE_SECTIONS.some((section) => section.id === "organization")).toBe(
      true,
    );
  });

  it("keeps steps short and actionable", () => {
    for (const section of USER_GUIDE_SECTIONS) {
      expect(section.steps.length).toBeGreaterThan(0);
      for (const step of section.steps) {
        expect(step.title.length).toBeGreaterThan(2);
        expect(step.body.length).toBeGreaterThan(20);
        expect(step.body.length).toBeLessThan(400);
      }
    }
  });
});
