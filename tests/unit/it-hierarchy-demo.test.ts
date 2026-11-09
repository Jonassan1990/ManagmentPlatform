import { describe, expect, it } from "vitest";
import {
  DEMO_DEPARTMENT_USERS,
  DEMO_PERSONAS,
  DEMO_PERSONA_PASSWORD,
  IT_DEMO_IDS,
  demoUserOptionLabel,
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

  it("seeds five test users per department as name — role — department", () => {
    const departments = new Set(
      DEMO_DEPARTMENT_USERS.map((user) => user.departmentKey),
    );
    expect(departments.size).toBe(5);
    for (const department of departments) {
      const people = DEMO_DEPARTMENT_USERS.filter(
        (user) => user.departmentKey === department,
      );
      expect(people).toHaveLength(5);
      expect(new Set(people.map((user) => user.functionRole)).size).toBe(5);
    }
    const sample = DEMO_DEPARTMENT_USERS[0]!;
    expect(demoUserOptionLabel(sample)).toBe(
      `${sample.displayName} — ${sample.functionRole} — ${sample.departmentLabel}`,
    );
    expect(getDemoPersona(sample.key)?.principalId).toBe(sample.principalId);
  });

  it("uses unique usernames and principal ids", () => {
    const usernames = new Set(DEMO_PERSONAS.map((persona) => persona.username));
    const ids = new Set(DEMO_PERSONAS.map((persona) => persona.principalId));
    expect(usernames.size).toBe(DEMO_PERSONAS.length);
    expect(ids.size).toBe(DEMO_PERSONAS.length);
  });
});
