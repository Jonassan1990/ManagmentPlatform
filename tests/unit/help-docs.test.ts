import { describe, expect, it } from "vitest";
import { listHelpDocs, getHelpDoc } from "@/modules/help/load-help-docs";

describe("help MDX docs", () => {
  it("lists user guide, design, and development", () => {
    const docs = listHelpDocs();
    expect(docs.map((doc) => doc.slug)).toEqual([
      "user-guide",
      "design",
      "development",
    ]);
    expect(docs[0]?.title).toBe("User guide");
  });

  it("compiles the user guide article", async () => {
    const doc = await getHelpDoc("user-guide");
    expect(doc?.title).toBe("User guide");
    expect(doc?.content).toBeTruthy();
  });
});
