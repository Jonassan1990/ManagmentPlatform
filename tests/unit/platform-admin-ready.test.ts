import { describe, expect, it } from "vitest";
import {
  DEMO_ORG_NAME,
  IT_DEMO_IDS,
} from "@/modules/demo/it-hierarchy-demo";

describe("platform admin ready catalog", () => {
  it("uses stable Industrial IT ids for idempotent upserts", () => {
    expect(IT_DEMO_IDS.org).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(IT_DEMO_IDS.sectionIn).not.toBe(IT_DEMO_IDS.org);
    expect(DEMO_ORG_NAME).toMatch(/Industrial IT/i);
  });
});
