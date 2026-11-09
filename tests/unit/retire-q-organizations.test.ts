import { describe, expect, it } from "vitest";
import { IT_DEMO_IDS } from "@/modules/demo/it-hierarchy-demo";
import {
  isIndustrialItOrganization,
  isQOrganizationName,
} from "@/modules/organization/application/retire-q-organizations";

describe("retire Q organizations", () => {
  it("matches the Q hierarchy codes and Scania", () => {
    for (const name of ["Q", "QD", "QDEO", "QE", "QED", "QEDI", "Scania"]) {
      expect(isQOrganizationName(name)).toBe(true);
    }
    expect(isQOrganizationName("Quality Systems")).toBe(false);
    expect(isQOrganizationName("I — Industrial IT")).toBe(false);
    expect(isQOrganizationName("INF")).toBe(false);
  });

  it("keeps Industrial IT even when the id is the seeded organization", () => {
    expect(
      isIndustrialItOrganization(IT_DEMO_IDS.org, "I — Industrial IT"),
    ).toBe(true);
    expect(isIndustrialItOrganization("other", "I — Industrial IT")).toBe(true);
    expect(isIndustrialItOrganization("other", "Q")).toBe(false);
  });
});
