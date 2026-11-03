import { describe, expect, it } from "vitest";
import {
  DEMO_PERSONAS,
  DEMO_PERSONA_PASSWORD,
  IT_DEMO_IDS,
  getDemoPersona,
} from "@/modules/demo/it-hierarchy-demo";

describe("IT hierarchy demo catalog", () => {
  it("covers org, section, INF parent, and INFB child personas", () => {
    expect(getDemoPersona("org-admin")?.scopeType).toBe("ORGANIZATION");
    expect(getDemoPersona("in-manager")?.scopeId).toBe(IT_DEMO_IDS.sectionIn);
    expect(getDemoPersona("inf-manager")?.scopeId).toBe(IT_DEMO_IDS.deptInf);
    expect(getDemoPersona("infb-manager")?.scopeId).toBe(IT_DEMO_IDS.deptInfb);
    expect(DEMO_PERSONAS).toHaveLength(7);
    expect(DEMO_PERSONA_PASSWORD.length).toBeGreaterThan(8);
  });

  it("uses unique usernames and principal ids", () => {
    const usernames = new Set(DEMO_PERSONAS.map((persona) => persona.username));
    const ids = new Set(DEMO_PERSONAS.map((persona) => persona.principalId));
    expect(usernames.size).toBe(DEMO_PERSONAS.length);
    expect(ids.size).toBe(DEMO_PERSONAS.length);
  });
});
