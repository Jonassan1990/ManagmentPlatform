import { describe, expect, it } from "vitest";
import { parseAdminConfigTab } from "@/components/organization/admin-config-tabs";

describe("parseAdminConfigTab", () => {
  it("defaults to confirm roster", () => {
    expect(parseAdminConfigTab(undefined)).toBe("confirm");
    expect(parseAdminConfigTab("nope")).toBe("confirm");
  });

  it("accepts known admin tabs", () => {
    expect(parseAdminConfigTab("hierarchy")).toBe("hierarchy");
    expect(parseAdminConfigTab("people")).toBe("people");
    expect(parseAdminConfigTab("roles")).toBe("roles");
  });
});
