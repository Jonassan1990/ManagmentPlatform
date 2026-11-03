import { describe, expect, it } from "vitest";
import {
  parseOrgUiMode,
  withOrgMode,
} from "@/modules/organization/application/org-ui-mode";

describe("org-ui-mode", () => {
  it("defaults to view", () => {
    expect(parseOrgUiMode(undefined)).toBe("view");
    expect(parseOrgUiMode("view")).toBe("view");
    expect(parseOrgUiMode("other")).toBe("view");
  });

  it("accepts config", () => {
    expect(parseOrgUiMode("config")).toBe("config");
    expect(parseOrgUiMode(["config"])).toBe("config");
  });

  it("appends mode=config only in config mode", () => {
    expect(withOrgMode("/organization/1", "view")).toBe("/organization/1");
    expect(withOrgMode("/organization/1", "config")).toBe(
      "/organization/1?mode=config",
    );
    expect(withOrgMode("/organization/1?x=1", "config")).toBe(
      "/organization/1?x=1&mode=config",
    );
    expect(withOrgMode("/organization/1#org-chart", "config")).toBe(
      "/organization/1?mode=config#org-chart",
    );
  });
});
